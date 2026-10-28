"""Konsole: python3 -m telefonbot.cli [--config DATEI] [--szenario NAME] [--anrufer +49…] [--out ORDNER]
Ohne --szenario: interaktiv (tippen wie am Telefon, leere Zeile = Stille, 'ende' beendet).
Es wird nichts versendet. --out schreibt E-Mail-Text und Event-JSON in einen lokalen Ordner."""
import argparse
import pathlib

from .config import lade
from .engine import Bot
from .summary import email_text, als_json, benachrichtigungen
from .szenarien import SZENARIEN

HIER = pathlib.Path(__file__).resolve().parent.parent
STANDARD_CFG = HIER / "beispiele" / "maler-muster.json"


def run(cfg, eingaben, anrufer=None, quiet=False):
    b = Bot(cfg, anrufer_nummer=anrufer)
    b.start()
    for u in eingaben:
        if b.ende:
            break
        b.hear(u)
    if not quiet:
        for r, t, s in b.log:
            print(f"{'Bot' if r == 'bot' else 'Anrufer':>8}: {t if t else '(Stille)'}")
    return b


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default=str(STANDARD_CFG))
    ap.add_argument("--szenario", choices=sorted(SZENARIEN))
    ap.add_argument("--anrufer", help="Anrufernummer (leer = unterdrückt)")
    ap.add_argument("--out", help="Ordner für Zusammenfassung (lokal, wird nicht versendet)")
    x = ap.parse_args()
    cfg = lade(x.config)
    if x.szenario:
        b = run(cfg, SZENARIEN[x.szenario], x.anrufer)
    else:
        b = Bot(cfg, anrufer_nummer=x.anrufer)
        print("Bot:", b.start(), "\n(Tippen Sie wie am Telefon; leere Zeile = Stille; 'ende' beendet.)")
        while not b.ende:
            u = input("Sie: ")
            if u.strip().lower() == "ende":
                break
            r = b.hear(u)
            if r:
                print("Bot:", r)
    print("\n" + email_text(b))
    print("Benachrichtigung (P0: nur simuliert):", ", ".join(benachrichtigungen(b)))
    if x.out:
        o = pathlib.Path(x.out); o.mkdir(parents=True, exist_ok=True)
        (o / "zusammenfassung.txt").write_text(email_text(b), "utf-8")
        (o / "anruf.json").write_text(als_json(b), "utf-8")
        print("Geschrieben nach", o)


if __name__ == "__main__":
    main()
