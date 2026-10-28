"""Abnahmetests T01–T16 (Text-Ebene, P0) aus phone/docs/bau-spezifikation.md §6, plus Leitplanken-Tests.
P1-L1 (Latenz) und P1-Q1 (Spracherkennung) brauchen Sprache/API und werden in P0 übersprungen.
Start:  cd phone/p0 && python3 -m unittest -v        (oder: pytest, falls installiert)
"""
import datetime as dt
import os
import pathlib
import re
import tempfile
import time
import unittest

from telefonbot.config import lade, pruefe, ConfigFehler
from telefonbot.engine import Bot, begruessung
from telefonbot.summary import email_text, event, benachrichtigungen
from telefonbot.store import Store
from telefonbot.szenarien import SZENARIEN

HIER = pathlib.Path(__file__).resolve().parent.parent
REPO = HIER.parent.parent
CFG = lade(HIER / "beispiele" / "maler-muster.json")


def run(name=None, eingaben=None, cfg=CFG, **kw):
    b = Bot(cfg, **kw)
    b.start()
    for u in (eingaben if eingaben is not None else SZENARIEN[name]):
        if b.ende:
            break
        b.hear(u)
    return b


def bot_text(b):
    return " ".join(t for r, t, _ in b.log if r == "bot")


class Abnahme(unittest.TestCase):
    def test_T01_standard(self):
        b = run("standard")
        a = b.a
        self.assertEqual(a["rueckruf"], "+491761234567")
        self.assertTrue(a["rueckruf_bestaetigt"])
        self.assertEqual(a["name"], "Max Muster")
        self.assertEqual(a["plz"], "07743")
        self.assertIn("streichen", a["anliegen"])
        self.assertTrue(any("Ich fasse zusammen" in t and "0176 12 34 56 7" in t for r, t, _ in b.log if r == "bot"))
        self.assertIn("Dringlichkeit: normal", email_text(b))
        self.assertEqual(benachrichtigungen(b), ["email"])

    def test_T02_begruessung_ki_hinweis_vor_erster_frage(self):
        g = begruessung(CFG)
        erste_frage = g.index("?")
        self.assertRegex(g[:erste_frage], r"künstliche Intelligenz")
        self.assertRegex(g[:erste_frage], r"nicht aufgenommen")
        self.assertRegex(g[:erste_frage], r"\b112\b")
        # Eigener Zusatz darf den KI-Hinweis nicht ersetzen
        g2 = begruessung({**CFG, "begruessung_zusatz": "Schön, dass Sie anrufen!"})
        self.assertIn("künstliche Intelligenz", g2)
        self.assertIn("nicht aufgenommen", g2)

    def test_T03_feuer_112_und_ende(self):
        b = run("notfall")
        self.assertTrue(b.ende)
        self.assertEqual(b.a["dringlichkeit"], "notfall_extern")
        self.assertIn("112", b.log[-1][1])
        self.assertIsNone(b.a["name"]); self.assertIsNone(b.a["rueckruf"])  # keine weitere Datenaufnahme
        self.assertEqual(sum(1 for r, *_ in b.log if r == "anrufer"), 1)

    def test_T04_gas(self):
        b = run("gas")
        self.assertTrue(b.ende)
        self.assertIn("Gebäude", b.log[-1][1])
        self.assertIn(CFG["gas_entstoerung_nummer"], b.log[-1][1])

    def test_T05_wasserschaden(self):
        b = run("wasser")
        self.assertEqual(b.a["dringlichkeit"], "hoch")
        self.assertIn("Hauptwasserhahn", bot_text(b))
        self.assertIn("Installateur", bot_text(b))
        self.assertTrue(b.a["rueckruf_bestaetigt"])
        self.assertIn("telegram", benachrichtigungen(b))

    def test_T06_keine_preise(self):
        b = run("preis")
        self.assertIsNone(re.search(r"\d+\s*(€|euro)", bot_text(b), re.I))
        self.assertIn("Preise kann ich", bot_text(b))

    def test_T07_nicht_im_angebot(self):
        b = run("laminat")
        self.assertTrue(b.a["nicht_im_angebot"])
        self.assertIn("nicht zu unseren Leistungen", bot_text(b))

    def test_T08_ki_abgelehnt(self):
        b = run("keine_ki")
        self.assertTrue(b.a["ki_abgelehnt"])
        self.assertIn("Bürozeiten", b.log[2][1])
        self.assertEqual(b.a["name"], "Max Muster")
        self.assertEqual(b.a["rueckruf"], "+491761234567")
        self.assertIsNone(b.a["anliegen"]); self.assertIsNone(b.a["plz"])  # nur Name + Nummer
        self.assertTrue(b.ende)

    def test_T09_korrektur_nummer(self):
        b = run("korrektur")
        self.assertEqual(b.a["rueckruf"], "+491767654321")
        self.assertIn("0176 76 54 32 1", email_text(b))
        self.assertNotIn("0176 12 34 56 7", email_text(b))

    def test_T10_sensible_daten_maskiert(self):
        b = run("sensibel")
        alles = email_text(b) + str(event(b))
        for verboten in ("DE89", "3704", "Diabetes", "diabetes"):
            self.assertNotIn(verboten, alles)
        self.assertIn("[entfernt]", b.a["anliegen"])

    def test_T11_zweimal_stille(self):
        b = run("stille", anrufer_nummer="+491761112223")
        self.assertTrue(b.ende)
        self.assertEqual(b.ende_grund, "stille")
        self.assertIn("rufen Sie gern noch einmal an", b.log[-1][1])
        z = email_text(b)
        self.assertIn("0176 11 12 22 3", z)  # Anruf wird trotzdem gemeldet, mit Anrufernummer
        self.assertIn("nicht bestätigt", z)

    def test_T12_llm_timeout_fallback(self):
        class LangsamesLLM:
            aufrufe = 0
            def extrahiere(self, text, anfrage):
                LangsamesLLM.aufrufe += 1
                time.sleep(1.0)
                return {"name": "FALSCH"}
        t0 = time.monotonic()
        b = run("standard", llm=LangsamesLLM(), llm_timeout=0.1)
        self.assertTrue(b.fallback_genutzt)
        self.assertEqual(LangsamesLLM.aufrufe, 1)  # danach nur noch feste Fragen
        self.assertEqual(b.a["name"], "Max Muster")
        self.assertTrue(b.a["rueckruf_bestaetigt"])
        self.assertLess(time.monotonic() - t0, 1.0)

    def test_T13_max_dauer(self):
        zeit = [0.0]
        b = Bot(CFG, uhr=lambda: zeit[0])
        b.start()
        zeit[0] = 60; b.hear("Ich möchte mein Wohnzimmer streichen lassen.")
        zeit[0] = 420; r = b.hear("Und dann wollte ich noch erzählen …")  # 7 Minuten
        self.assertTrue(b.ende)
        self.assertEqual(b.ende_grund, "max_dauer")
        self.assertIn("Auf Wiederhören", r)
        zeit[0] = 359; b2 = Bot(CFG, uhr=lambda: zeit[0]); zeit[0] = 0; b2.start(); zeit[0] = 359
        b2.hear("Ich möchte streichen lassen."); self.assertFalse(b2.ende)

    def test_T14_kein_audio_auf_platte(self):
        start = time.time() - 1
        with tempfile.TemporaryDirectory() as d:
            alt = os.getcwd(); os.chdir(d)
            try:
                for n in SZENARIEN:
                    if n != "baeckerei":
                        run(n)
            finally:
                os.chdir(alt)
            audio = re.compile(r"\.(wav|ogg|mp3|flac|opus|webm|m4a|raw|pcm)$", re.I)
            for wurzel in (pathlib.Path(d), REPO, pathlib.Path(tempfile.gettempdir())):
                for p in wurzel.rglob("*"):
                    try:
                        if p.is_file() and audio.search(p.name) and p.stat().st_mtime > start and "node_modules" not in p.parts:
                            self.fail(f"Audiodatei gefunden: {p}")
                    except (PermissionError, FileNotFoundError):
                        pass
        # Kein Modul darf Audio-Bibliotheken laden oder Dateien mit Audio-Endung schreiben
        for py in (HIER / "telefonbot").glob("*.py"):
            src = py.read_text("utf-8")
            self.assertNotRegex(src, r"import (wave|pyaudio|sounddevice|soundfile)", py.name)

    def test_T15_loeschjob_30_tage(self):
        s = Store(":memory:")
        jetzt = dt.datetime(2026, 11, 30, tzinfo=dt.timezone.utc)
        alt, neu = event(run("standard")), event(run("laminat"))
        s.speichere(alt, jetzt - dt.timedelta(days=31))
        s.speichere(neu, jetzt - dt.timedelta(days=29))
        self.assertEqual(s.loesch_job(30, jetzt), 1)
        self.assertEqual(s.anzahl_transkripte(), 1)

    def test_T16_spam(self):
        b = run("spam")
        self.assertIn("freundlich", b.log[2][1])  # erst Warnung
        self.assertTrue(b.ende)
        self.assertTrue(b.a["spam"])
        self.assertNotIn("telegram", benachrichtigungen(b))

    @unittest.skip("P1-L1 Latenz: braucht Sprachpipeline + API-Konten (Phase P1, nicht freigegeben)")
    def test_P1_L1_latenz(self):
        pass

    @unittest.skip("P1-Q1 Deutsch-Erkennung: braucht Spracherkennung (Phase P1, nicht freigegeben)")
    def test_P1_Q1_spracherkennung(self):
        pass


class Leitplanken(unittest.TestCase):
    def test_bot_ruft_nie_selbst_an(self):
        for n in SZENARIEN:
            t = bot_text(run(n)).lower()
            self.assertNotRegex(t, r"\bich rufe\b|\bwerde (sie|dich) (an|zurück)rufen|\bich melde mich\b", n)
        src = " ".join(p.read_text("utf-8") for p in (HIER / "telefonbot").glob("*.py"))
        self.assertNotRegex(src, r"def (dial|anrufen|call_out|outbound)")

    def test_notfallhinweis_112_immer_in_begruessung(self):
        self.assertIn("112", begruessung({**CFG, "begruessung_zusatz": "Hallo"}))

    def test_rauch_nicht_in_brauche(self):
        b = run(eingaben=["Ich brauche einen neuen Anstrich im Flur."])
        self.assertFalse(b.ende)

    def test_config_aufbewahrung_max_30(self):
        with self.assertRaises(ConfigFehler):
            pruefe({**CFG, "transkript_aufbewahrung_tage": 90})

    def test_notfall_listen_nicht_abschaltbar(self):
        c = pruefe({**CFG, "notfall": {"extern_112": [], "gas": []}})
        self.assertIn("feuer", c["notfall"]["extern_112"])

    def test_generierte_kundenconfig_baeckerei(self):
        p = REPO / "clients" / "beispiel" / "telefon.json"
        if not p.exists():
            self.skipTest("clients/beispiel/telefon.json fehlt – erst npm run generate:beispiel")
        cfg = lade(p)
        b = run("baeckerei", cfg=cfg)
        self.assertIn("Beispiel-Bäckerei", b.log[0][1])
        self.assertIn("künstliche Intelligenz", b.log[0][1])
        self.assertEqual(b.a["leistung"], "geburtstagstorte")
        self.assertTrue(b.a["rueckruf_bestaetigt"])
        self.assertIn("nächsten Werktag", b.log[-1][1])
        self.assertIsNone(re.search(r"\d+\s*(€|euro)", bot_text(b), re.I))


if __name__ == "__main__":
    unittest.main()
