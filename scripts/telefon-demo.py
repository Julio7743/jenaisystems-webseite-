"""Erzeugt die Telefon-Demo (Text-Simulation) für die JenAiSystems-Website aus der Offline-Engine P0.
Aufruf (aus dem Repo-Ordner): python3 scripts/telefon-demo.py  -> JSON auf stdout
Es wird nichts versendet und nichts gespeichert. Betrieb: die ERFUNDENE Beispiel-Bäckerei."""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "phone" / "p0"))
from telefonbot.config import lade  # noqa: E402
from telefonbot.cli import run  # noqa: E402
from telefonbot.summary import email_text  # noqa: E402
from telefonbot.szenarien import SZENARIEN  # noqa: E402

AUSWAHL = [
    ("baeckerei", "Tortenbestellung"),
    ("notfall", "Notfall: 112-Hinweis"),
    ("keine_ki", "Möchte nicht mit einer KI sprechen"),
]

cfg = lade(str(ROOT / "clients" / "beispiel" / "telefon.json"))
out = []
for key, titel in AUSWAHL:
    b = run(cfg, SZENARIEN[key], None, quiet=True)
    mail = "\n".join(z for z in email_text(b).splitlines() if not z.startswith("Zeit:"))
    out.append({
        "id": key,
        "titel": titel,
        "verlauf": [{"rolle": "bot" if r == "bot" else "anrufer", "text": t or "(Stille)"} for r, t, _ in b.log],
        "zusammenfassung": mail.strip(),
    })
print(json.dumps({"betrieb": cfg["firma"], "szenarien": out}, ensure_ascii=False))
