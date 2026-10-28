"""Dialog-Engine mit Zustandsautomat (bau-spezifikation §4), P0: regelbasiert.

BEGRUESSUNG → ANLIEGEN → (NOTFALL_EXTERN → ENDE) | AUFNAHME → BESTAETIGUNG → (KORREKTUR ≤2) → ABSCHIED → ENDE
KI_ABGELEHNT ist aus jedem Zustand erreichbar (dann nur Name + Rückrufnummer).

Leitplanken (recht.md): KI-Hinweis in der Begrüßung (nicht abschaltbar), kein Audio, keine Preise,
keine Zusagen, 112-Hinweis, der Bot ruft nie selbst an.
"""
import re
import time

from . import notfall
from .extract import (maskiere, finde_nummer, finde_plz, finde_name, finde_ort, vorlesen, hat, ja, nein, PHONE)
from .llm import frage_llm

KI_HINWEIS = ("Ich bin der digitale Telefon-Assistent – eine künstliche Intelligenz. Gerade ist leider niemand "
              "persönlich erreichbar. Ich notiere Ihr Anliegen schriftlich für das Team, das Gespräch wird nicht aufgenommen.")
NOTRUF_HINWEIS = "Bei Lebensgefahr wählen Sie bitte sofort die 112."
KI_ABLEHNUNG = ["keine ki", "keiner ki", "kein roboter", "keinem roboter", "mit einem menschen", "echten menschen", "mit jemandem persönlich"]
BELEIDIGUNG = ["idiot", "arschloch", "blöde maschine", "dumme maschine", "halt die klappe", "fick", "scheiß ki", "wichser"]
PREIS = ["kostet", "preis", "euro", "teuer", "kosten"]
OEFFNUNG = re.compile(r"öffnungszeit|geöffnet|\bwann\b.*\b(offen|auf|da)\b|\bhabt ihr (offen|auf)\b|\bhaben sie (offen|auf)\b", re.I)


def begruessung(c: dict) -> str:
    """Fester Begrüßungstext. Ein eigener Zusatz des Betriebs kommt davor, den KI-Hinweis ersetzt er nie."""
    kopf = f"Guten Tag, Sie sind bei {c['firma']}" + (f" in {c['ort']}" if c.get("ort") else "") + "."
    zusatz = (c.get("begruessung_zusatz") or "").strip()
    teile = [kopf]
    if zusatz:
        teile.append(zusatz)
    teile += [KI_HINWEIS, f"Infos zum Datenschutz finden Sie auf {c['datenschutz_url']}.", NOTRUF_HINWEIS, "Worum geht es bei Ihnen?"]
    return " ".join(teile)


class Bot:
    def __init__(self, cfg: dict, anrufer_nummer: str = None, llm=None, llm_timeout: float = 3.0, uhr=time.monotonic):
        self.c = cfg
        self.uhr = uhr
        self.llm, self.llm_timeout = llm, llm_timeout
        self.anrufer_nummer = anrufer_nummer  # None = unterdrückt
        self.a = {"anliegen": None, "leistung": None, "details": None, "ort": None, "plz": None, "name": None,
                  "rueckruf": None, "rueckruf_bestaetigt": False, "erreichbarkeit": None, "wunschtermin": None,
                  "email": None, "dringlichkeit": "normal", "notfall_art": None, "notfall_hinweis_gegeben": False,
                  "ki_abgelehnt": False, "nicht_im_angebot": False, "offen": [], "spam": False}
        self.log = []          # [(rolle, text, sekunden)] – nur Text, bereits maskiert
        self.state = "BEGRUESSUNG"
        self.ende = False
        self.ende_grund = None
        self.korrekturen = 0
        self.stille = 0
        self.warnungen = 0
        self.letzte_frage = None
        self.fallback_genutzt = False
        self.t0 = None

    # --- Hilfen -------------------------------------------------------------
    def _t(self):
        return round(self.uhr() - self.t0, 1) if self.t0 is not None else 0.0

    def say(self, t: str) -> str:
        t = re.sub(r"\s+", " ", t).strip()
        self.log.append(("bot", t, self._t()))
        return t

    def _beenden(self, text: str, grund: str) -> str:
        self.ende, self.ende_grund, self.state = True, grund, "ENDE"
        return self.say(text)

    def abschied(self) -> str:
        return f"Vielen Dank! {self.c['rueckruf_zusage']} Auf Wiederhören."

    # --- Ablauf -------------------------------------------------------------
    def start(self) -> str:
        self.t0 = self.uhr()
        self.state = "ANLIEGEN"
        self.letzte_frage = "anliegen"
        return self.say(begruessung(self.c))

    def next_question(self) -> str:
        a = self.a
        if self.state == "KI_ABGELEHNT":
            if not a["name"]:
                self.letzte_frage = "name"; return "Wie ist Ihr Name?"
            if not a["rueckruf"]:
                return self._frage_nummer()
            return self._bestaetigen()
        if not a["anliegen"]:
            self.letzte_frage = "anliegen"; return "Worum geht es genau?"
        self.state = "AUFNAHME"
        if self.c.get("ort_pflicht", True) and not (a["ort"] or a["plz"]):
            self.letzte_frage = "ort"; return "In welchem Ort oder welcher Straße ist das? Die Postleitzahl genügt."
        if not a["name"]:
            self.letzte_frage = "name"; return "Wie ist Ihr Name?"
        if not a["rueckruf"]:
            return self._frage_nummer()
        if a["wunschtermin"] is None and "wunschtermin" not in a["offen"]:
            a["offen"].append("wunschtermin"); self.letzte_frage = "wunschtermin"
            return "Gibt es einen Wunschzeitraum?"
        return self._bestaetigen()

    def _frage_nummer(self) -> str:
        if self.anrufer_nummer and self.letzte_frage != "rueckruf_callerid_nein":
            self.letzte_frage = "rueckruf_callerid"
            return "Ist die Nummer, mit der Sie gerade anrufen, die richtige für den Rückruf?"
        self.letzte_frage = "rueckruf"
        return "Unter welcher Nummer erreichen wir Sie am besten?"

    def _bestaetigen(self) -> str:
        a = self.a
        self.state, self.letzte_frage = "BESTAETIGUNG", "bestaetigung"
        teile = []
        if a["anliegen"]:
            teile.append(a["anliegen"])
        ort = " ".join(x for x in (a["ort"], a["plz"]) if x)
        if ort:
            teile.append(f"Ort {ort}")
        teile.append(f"Name {a['name']}")
        teile.append(f"Rückruf unter {vorlesen(a['rueckruf'])}")
        return "Ich fasse zusammen: " + ", ".join(teile) + ". Stimmt das so?"

    def hear(self, roh: str):
        if self.ende:
            return None
        if self.t0 is None:
            self.start()
        # Gesamtdauer
        if self._t() >= int(self.c["max_dauer_s"]):
            self.log.append(("anrufer", maskiere(roh or ""), self._t()))
            return self._beenden("Wir sind schon eine Weile am Telefon. Ich habe alles notiert, das Team klärt den Rest "
                                 "beim Rückruf. Auf Wiederhören.", "max_dauer")
        # Stille
        if not (roh or "").strip():
            self.stille += 1
            if self.stille >= 2:
                return self._beenden("Ich verstehe Sie leider nicht. Bitte rufen Sie gern noch einmal an. Auf Wiederhören.", "stille")
            return self.say("Sind Sie noch da? Ich habe Sie leider nicht verstanden.")
        self.stille = 0

        t = maskiere(roh)
        self.log.append(("anrufer", t, self._t()))
        a = self.a

        # Beleidigung / Spam: erst Warnung, dann Ende
        if hat(t, BELEIDIGUNG):
            self.warnungen += 1
            if self.warnungen >= 2:
                a["spam"] = True
                return self._beenden("Ich beende das Gespräch jetzt. Auf Wiederhören.", "spam")
            return self.say("Bitte bleiben Sie freundlich, sonst muss ich das Gespräch beenden. Worum geht es?")

        # Notfall hat Vorrang vor allem anderen (Regel gewinnt immer)
        art = notfall.klassifiziere(t, self.c)
        if art in ("extern_112", "gas"):
            a.update(dringlichkeit="notfall_extern", notfall_art=art, notfall_hinweis_gegeben=True)
            self.state = "NOTFALL_EXTERN"
            return self._beenden(notfall.antwort(art, self.c), "notfall_extern")

        # KI abgelehnt – aus jedem Zustand
        if hat(t, KI_ABLEHNUNG):
            a["ki_abgelehnt"] = True
            self.state = "KI_ABGELEHNT"
            self.letzte_frage = "ki_abgelehnt"
            return self.say(f"Kein Problem. Sie können es zu unseren Bürozeiten wieder versuchen: {self.c['oeffnungszeiten']}. "
                            "Oder Sie nennen mir nur Ihren Namen und Ihre Rückrufnummer, dann meldet sich das Team.")

        if self.state == "BESTAETIGUNG":
            return self._bestaetigung(t)

        pre = ""
        if art in ("wasser", "betrieb_dringend"):
            a["dringlichkeit"] = "hoch"; a["notfall_art"] = art
            pre += notfall.antwort(art, self.c)

        # Optional: Sprachmodell (P1). In P0 normalerweise None.
        if self.llm is not None and not self.fallback_genutzt and self.state != "KI_ABGELEHNT":
            try:
                for k, v in frage_llm(self.llm, t, a, self.llm_timeout).items():
                    if not a.get(k):
                        a[k] = maskiere(str(v))[:300]
            except Exception:
                self.fallback_genutzt = True  # ab jetzt feste Fragen

        nummer = finde_nummer(t)
        ohne_nummer = PHONE.sub(" ", t)

        if self.state == "KI_ABGELEHNT":
            if not a["name"]:
                a["name"] = finde_name(t, self.letzte_frage in ("name", "ki_abgelehnt"))
            self._nummer_antwort(t, nummer)
            return self.say(pre + self.next_question())

        if OEFFNUNG.search(t):
            pre += f"Unsere Öffnungszeiten: {self.c['oeffnungszeiten']}. "
        if hat(t, PREIS):
            pre += "Preise kann ich am Telefon leider nicht nennen, das klärt das Team gern persönlich beim Rückruf. "
        if hat(t, self.c["nicht_im_angebot"]):
            a["nicht_im_angebot"] = True
            a["leistung"] = "nicht_im_angebot"
            pre += "Das gehört leider nicht zu unseren Leistungen. Ich notiere es trotzdem, falls Sie möchten. "

        if not a["anliegen"]:
            treffer = next((w for w in self.c["leistungen"] if w in t.lower()), None)
            woerter = len(re.findall(r"\w+", ohne_nummer))
            nur_zeiten = bool(OEFFNUNG.search(t)) and not treffer
            if treffer or a["nicht_im_angebot"] or a["dringlichkeit"] == "hoch" or (self.letzte_frage == "anliegen" and woerter >= 4 and not nur_zeiten):
                a["anliegen"] = re.sub(r"\s+", " ", t.strip()).rstrip(".!?")[:300]
                if not a["leistung"]:
                    a["leistung"] = treffer or "sonstiges"

        plz = finde_plz(ohne_nummer)
        if plz and not a["plz"]:
            a["plz"] = plz
        if not a["ort"]:
            o = finde_ort(ohne_nummer, self.letzte_frage == "ort")
            if o and o.lower() not in ("jena 0",):
                a["ort"] = o
        if not a["name"]:
            n = finde_name(t, self.letzte_frage == "name")
            if n:
                a["name"] = n
        self._nummer_antwort(t, nummer)
        if self.letzte_frage == "wunschtermin" and a["wunschtermin"] is None:
            a["wunschtermin"] = "kein bestimmter" if re.search(r"\b(egal|nein|keinen|nicht)\b", t.lower()) else t.strip().rstrip(".!")[:100]
            a["offen"] = [x for x in a["offen"] if x != "wunschtermin"]
        return self.say(pre + self.next_question())

    def _nummer_antwort(self, t, nummer):
        a = self.a
        if a["rueckruf"]:
            return
        if nummer:
            a["rueckruf"] = nummer
        elif self.letzte_frage == "rueckruf_callerid":
            if ja(t):
                a["rueckruf"] = self.anrufer_nummer
            elif nein(t):
                self.letzte_frage = "rueckruf_callerid_nein"

    def _bestaetigung(self, t):
        a = self.a
        if ja(t):
            a["rueckruf_bestaetigt"] = True
            self.state = "ABSCHIED"
            return self._beenden(self.abschied(), "fertig")
        self.korrekturen += 1
        n = finde_nummer(t)
        if n:
            a["rueckruf"] = n
        plz = finde_plz(PHONE.sub(" ", t))
        if plz:
            a["plz"] = plz
        name = finde_name(t, False)
        if name:
            a["name"] = name
        if self.korrekturen > 2:
            return self._beenden("Ich habe alles notiert, das Team klärt den Rest beim Rückruf. Auf Wiederhören.", "korrekturen")
        if not (n or plz or name):
            self.letzte_frage = "korrektur"
            return self.say("Was davon soll ich korrigieren? Sagen Sie mir bitte die richtige Angabe.")
        return self.say("Danke für die Korrektur. " + self._bestaetigen())
