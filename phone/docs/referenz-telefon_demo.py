#!/usr/bin/env python3
"""Offline-Text-Demo KI-Telefon-Bot (fiktiver Malerbetrieb Muster, Jena).
Simuliert den Gesprächsablauf aus konzept.md per Konsole – OHNE KI, OHNE Internet,
regelbasiert (wie die Fallback-Logik im echten Bot). Kein Audio, keine Speicherung außer
optional der Zusammenfassung (--out).

  python3 telefon_demo.py                 # interaktiv
  python3 telefon_demo.py --szenario standard|notfall|gas|wasser|preis|laminat|keine_ki
  python3 telefon_demo.py --test          # alle Szenarien als Selbsttest
"""
import argparse, datetime as dt, json, re, sys, pathlib

CFG = json.loads((pathlib.Path(__file__).with_name("maler-muster.json")).read_text("utf-8"))

def begruessung(c):
    return (f"Guten Tag, Sie sind beim {c['firma']} in {c['ort']}. Ich bin der digitale Telefon-Assistent – "
            "eine künstliche Intelligenz. Gerade ist leider niemand persönlich erreichbar. Ich notiere Ihr "
            "Anliegen schriftlich für das Team, das Gespräch wird nicht aufgenommen. Infos zum Datenschutz "
            f"finden Sie auf {c['datenschutz_url']}. Bei Lebensgefahr wählen Sie bitte sofort die 112. "
            "– Worum geht es bei Ihnen?")

def has(text, words): t = text.lower(); return any(w in t for w in words)

PHONE = re.compile(r"(\+?\d[\d\s/\-]{6,}\d)")
PLZ = re.compile(r"\b(0\d{4})\b")
SENSIBEL = re.compile(r"\bDE\d{2}[\d ]{12,30}\b|\biban\b|diagnose|krankheit", re.I)

def norm_phone(s):
    d = re.sub(r"[^\d+]", "", s)
    if d.startswith("0"): d = "+49" + d[1:]
    return d

def vorlesen(e164):
    d = e164.replace("+49", "0")
    vw = 4 if d.startswith("01") else (5 if d.startswith("036") else 4)
    r = d[vw:]
    return d[:vw] + " " + " ".join(r[i:i+2] for i in range(0, len(r), 2))

class Bot:
    def __init__(self, c=CFG):
        self.c, self.a, self.log = c, {"anliegen": None, "ort": None, "plz": None, "name": None,
                "rueckruf": None, "rueckruf_bestaetigt": False, "wunschtermin": None,
                "dringlichkeit": "normal", "notfall_hinweis_gegeben": False, "ki_abgelehnt": False,
                "nicht_im_angebot": False, "offen": []}, []
        self.state, self.ende, self.korrekturen = "ANLIEGEN", False, 0

    def say(self, t): self.log.append(("Bot", t)); return t

    def start(self): return self.say(begruessung(self.c))

    def notfall(self, t):
        n = self.c["notfall"]
        if has(t, n["extern_112"]):
            self.a.update(dringlichkeit="notfall_extern", notfall_hinweis_gegeben=True); self.ende = True
            return "Bitte legen Sie sofort auf und wählen Sie die 112. Ich gebe dem Team Bescheid, dass Sie angerufen haben."
        if has(t, n["gas"]):
            self.a.update(dringlichkeit="notfall_extern", notfall_hinweis_gegeben=True); self.ende = True
            return ("Bitte verlassen Sie sofort das Gebäude, betätigen Sie keine Schalter und rufen Sie von draußen "
                    f"die 112 oder den Gas-Entstörungsdienst unter {self.c['gas_entstoerung_nummer']} an.")
        if has(t, n["wasser"]):
            self.a["dringlichkeit"] = "hoch"
            return ("Wenn noch Wasser läuft: Drehen Sie bitte den Hauptwasserhahn zu – für den Rohrbruch selbst ist ein "
                    "Installateur-Notdienst zuständig. Um den Schaden an Wand oder Decke kümmern wir uns gern. ")
        if has(t, n["betrieb_dringend"]):
            self.a["dringlichkeit"] = "hoch"
            return "Das klingt dringend, ich markiere es für das Team als dringend. "
        return ""

    def next_question(self):
        a = self.a
        if not a["anliegen"]: return "Worum geht es – streichen, tapezieren, Fassade oder Lackieren?"
        if not (a["ort"] or a["plz"]): return "In welchem Ort oder welcher Straße ist das Objekt?"
        if not a["name"]: return "Wie ist Ihr Name?"
        if not a["rueckruf"]: return "Unter welcher Nummer erreichen wir Sie am besten?"
        if a["wunschtermin"] is None and "wunschtermin" not in a["offen"]:
            a["offen"].append("wunschtermin"); return "Gibt es einen Wunschzeitraum für die Arbeiten?"
        self.state = "BESTAETIGUNG"
        return ("Ich fasse zusammen: " + a["anliegen"] + f", Ort {a['ort'] or ''} {a['plz'] or ''}".rstrip() +
                f", Name {a['name']}, Rückruf unter {vorlesen(a['rueckruf'])}. Stimmt das so?")

    def hear(self, t):
        self.log.append(("Anrufer", t))
        if SENSIBEL.search(t):
            t = SENSIBEL.sub("[entfernt]", t)
        if has(t, ["keine ki", "keiner ki", "mit einem menschen", "echten menschen"]):
            self.a["ki_abgelehnt"] = True
            return self.say("Kein Problem. Sie können es zu unseren Bürozeiten, " + self.c["oeffnungszeiten"] +
                            ", wieder versuchen – oder Sie nennen mir nur Name und Rückrufnummer, dann ruft das Team zurück.")
        if self.state == "BESTAETIGUNG":
            if has(t, ["ja", "stimmt", "genau", "richtig"]) and not has(t, ["nein"]):
                self.a["rueckruf_bestaetigt"] = True; self.ende = True
                return self.say("Vielen Dank! Das Team meldet sich am nächsten Werktag bei Ihnen. Auf Wiederhören.")
            self.korrekturen += 1; self.state = "ANLIEGEN"
            m = PHONE.search(t)
            if m: self.a["rueckruf"] = norm_phone(m.group(1))
            if self.korrekturen > 2:
                self.ende = True; return self.say("Ich habe alles notiert, das Team klärt den Rest beim Rückruf. Auf Wiederhören.")
            return self.say("Danke für die Korrektur. " + self.next_question())
        pre = self.notfall(t)
        if self.ende: return self.say(pre)
        if has(t, ["kostet", "preis", "euro", "teuer"]):
            pre += "Preise kann ich am Telefon leider nicht nennen – das klärt der Meister gern persönlich beim Rückruf. "
        if has(t, self.c["nicht_im_angebot"]):
            self.a["nicht_im_angebot"] = True
            pre += "Das gehört leider nicht zu unseren Leistungen. Ich notiere es trotzdem, falls Sie möchten. "
        a = self.a
        if not a["anliegen"] and (has(t, self.c["leistungen"] + self.c["nicht_im_angebot"]) or a["dringlichkeit"] == "hoch"):
            a["anliegen"] = re.sub(r"\s+", " ", t.strip()).rstrip(".!")[:300]
        m = PHONE.search(t)
        if m and not a["rueckruf"]: a["rueckruf"] = norm_phone(m.group(1))
        p = PLZ.search(t)
        if p: a["plz"] = p.group(1)
        mo = re.search(r"\b(?i:in|aus)\s+([A-ZÄÖÜ][\wäöüß\-]+(?:\s[A-ZÄÖÜ][\wäöüß\-]+)?)", t)
        if mo and not a["ort"] and not a["anliegen"] == t: a["ort"] = mo.group(1)
        mn = re.search(r"(?:ich bin|mein name ist|ich heiße|hier ist)\s+([A-ZÄÖÜ][\wäöüß\-]+(?:\s[A-ZÄÖÜ][\wäöüß\-]+)?)", t, re.I)
        if mn: a["name"] = mn.group(1)
        elif a["anliegen"] and (a["ort"] or a["plz"]) and not a["name"] and not m and re.fullmatch(r"[A-ZÄÖÜ][\wäöüß\-]+(\s[A-ZÄÖÜ][\wäöüß\-]+)?", t.strip()):
            a["name"] = t.strip()
        if "wunschtermin" in a["offen"] and a["wunschtermin"] is None and not m and a["name"] and a["rueckruf"] is not None:
            pass
        if a["offen"] == ["wunschtermin"] and a["wunschtermin"] is None and self.log[-2][1].startswith("Gibt es einen Wunsch"):
            a["wunschtermin"] = t.strip(); a["offen"] = []
        return self.say(pre + self.next_question())

    def zusammenfassung(self, start=None):
        a, start = self.a, start or dt.datetime(2026, 10, 24, 17, 42)
        dr = {"normal": "normal", "hoch": "HOCH", "notfall_extern": "NOTFALL – 112/Entstörung empfohlen"}[a["dringlichkeit"]]
        betreff = f"[Telefon] {dr.split(' ')[0]} – {(a['anliegen'] or 'Anruf ohne Anliegen')[:50]} – {a['name'] or 'ohne Namen'}"
        z = [f"Betreff: {betreff}", "", "Neuer Anruf über den Telefon-Assistenten (DEMO, fiktiv)",
             f"Zeit: {start:%d.%m.%Y, %H:%M} Uhr", f"Dringlichkeit: {dr}",
             f"Anliegen: {a['anliegen'] or '–'}", f"Ort: {(a['ort'] or '')} {(a['plz'] or '')}".rstrip() or "Ort: –",
             f"Name: {a['name'] or '–'}",
             f"Rückruf: {vorlesen(a['rueckruf']) if a['rueckruf'] else '–'}" + (" (bestätigt)" if a["rueckruf_bestaetigt"] else ""),
             f"Wunschzeitraum: {a['wunschtermin'] or '–'}",
             f"Nicht im Angebot: {'ja' if a['nicht_im_angebot'] else 'nein'}",
             f"KI abgelehnt: {'ja' if a['ki_abgelehnt'] else 'nein'}",
             f"Notfall-Hinweis gegeben: {'ja' if a['notfall_hinweis_gegeben'] else 'nein'}", "---",
             f"Kein Audio gespeichert. Transkript wird nach {self.c['transkript_aufbewahrung_tage']} Tagen gelöscht."]
        return "\n".join(z)

SZENARIEN = {
    "standard": ["Ich möchte mein Wohnzimmer streichen lassen, ca. 20 Quadratmeter.", "In Jena, 07743, Musterweg 5.",
                 "Mein Name ist Max Muster", "0176 1234567", "Am liebsten im November", "Ja, stimmt."],
    "notfall": ["Hilfe, es brennt in der Küche!"],
    "gas": ["Hier riecht es nach Gas im Flur"],
    "wasser": ["Wir hatten einen Rohrbruch, jetzt ist ein Wasserfleck an der Decke im Bad, der muss gestrichen werden.",
               "In Jena 07745", "Ich bin Erika Beispiel", "Unter 0176 7654321", "Nächste zwei Wochen", "Ja genau"],
    "preis": ["Was kostet es ungefähr, eine Fassade zu streichen?", "Aus Isserstedt, 07751", "Hier ist Paul Probe",
              "03641 123456", "Frühjahr", "ja"],
    "laminat": ["Können Sie Laminat verlegen?", "In Jena 07749", "Mein Name ist Lea Test", "0151 2223334", "egal", "ja"],
    "keine_ki": ["Ich will mit keiner KI reden."],
}

def run(name, quiet=False):
    b = Bot(); out = [b.start()]
    for u in SZENARIEN[name]:
        if b.ende: break
        out.append(b.hear(u))
    if not quiet:
        for r, t in b.log: print(f"{r:>8}: {t}")
        print("\n" + b.zusammenfassung())
    return b

def selftest():
    ok = True
    def check(c, msg):
        nonlocal ok; print(("OK   " if c else "FAIL ") + msg); ok &= c
    b = run("standard", True); g = b.log[0][1]
    check("künstliche Intelligenz" in g and "nicht aufgenommen" in g, "T02 KI-Hinweis + 'nicht aufgenommen' in Begrüßung")
    check(b.a["rueckruf"] == "+491761234567" and b.a["rueckruf_bestaetigt"] and b.a["name"] == "Max Muster" and b.a["plz"] == "07743", "T01 Standard: Pflichtfelder vollständig")
    b = run("notfall", True); check(b.a["dringlichkeit"] == "notfall_extern" and "112" in b.log[-1][1] and b.ende, "T03 Feuer → 112, Ende")
    b = run("gas", True); check("Gebäude" in b.log[-1][1] and b.ende, "T04 Gas → Gebäude verlassen, Ende")
    b = run("wasser", True); check(b.a["dringlichkeit"] == "hoch" and "Hauptwasserhahn" in b.log[2][1] and b.a["rueckruf_bestaetigt"], "T05 Wasserschaden → hoch + Hinweis")
    b = run("preis", True); bot = " ".join(t for r, t in b.log if r == "Bot")
    check(not re.search(r"\d+\s*(€|euro)", bot, re.I) and "Preise kann ich" in bot, "T06 keine Preisnennung")
    b = run("laminat", True); check(b.a["nicht_im_angebot"], "T07 Laminat → nicht im Angebot")
    b = run("keine_ki", True); check(b.a["ki_abgelehnt"] and "Bürozeiten" in b.log[-1][1], "T08 KI abgelehnt → Alternative")
    print("\nALLE BESTANDEN" if ok else "\nFEHLER"); return ok

if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--szenario", choices=SZENARIEN); ap.add_argument("--test", action="store_true")
    ap.add_argument("--out", help="Zusammenfassung zusätzlich als Textdatei speichern")
    x = ap.parse_args()
    if x.test: sys.exit(0 if selftest() else 1)
    if x.szenario: b = run(x.szenario)
    else:
        b = Bot(); print("Bot:", b.start(), "\n(Tippen Sie wie am Telefon; 'ende' beendet.)")
        while not b.ende:
            u = input("Sie: ").strip()
            if u.lower() == "ende": break
            print("Bot:", b.hear(u))
        print("\n" + b.zusammenfassung())
    if x.out: pathlib.Path(x.out).write_text(b.zusammenfassung(), "utf-8")
