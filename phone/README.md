# Telefonassistent (KI nimmt Anrufe an)

Der Telefonassistent nimmt Anrufe an, wenn im Betrieb niemand rangeht oder außerhalb der Öffnungszeiten. Er notiert
Anliegen, Name und Rückrufnummer und erzeugt eine Zusammenfassung für den Betrieb.

**Stand: Phase P0 ist fertig (offline, ohne Konten, ohne Kosten). P1 und P2 sind nur als Vorlage beschrieben.**

| Phase | Was | Konten / Kosten | Stand |
|---|---|---|---|
| **P0 offline** | Gesprächslogik, Notfallregeln, Zusammenfassung, Tests, Konsole | keine | ✅ fertig, 16 von 16 Text-Tests grün |
| P1 Sprache am Rechner | Mikrofon/Lautsprecher + Spracherkennung, Sprachausgabe, Sprachmodell über API | API-Konten (z. B. Mistral, IONOS) – nur mit Julios Freigabe | 📄 Vorlage: `p1-vorlage/` |
| P2 echtes Telefon | Rufnummer / SIP-Anbieter → Bot | Telefonie-Konto + Nummer – nur mit Julios Freigabe | 📄 Vorlage: `p2-vorlage/` |

Grundlage ist die Spezifikation in `docs/` (Kopie aus dem Arbeitsordner, unverändert):
`konzept.md` (Ablauf, Fragen, Notfälle), `recht.md` (Pflichten), `technik.md`, `kosten.md`, `bau-spezifikation.md`
(Architektur, Testfälle) und die ursprüngliche Demo `referenz-telefon_demo.py`.

## Feste Regeln (nicht abschaltbar, siehe docs/recht.md)
- **KI-Hinweis in der Begrüßung** („eine künstliche Intelligenz … das Gespräch wird nicht aufgenommen“) – AI Act Art. 50.
- **Kein Audio wird gespeichert**, nirgends (§ 201 StGB). Nur Text, Transkripte höchstens 30 Tage.
- **112-Hinweis** in der Begrüßung. Bei Feuer, Verletzten, Lebensgefahr: sofort „legen Sie auf und wählen Sie die 112“.
  Bei Gasgeruch: Gebäude verlassen + Entstörungsdienst. Der Bot ist **kein** Notdienst.
- **Der Bot ruft nie selbst an** (keine ausgehenden Anrufe, UWG § 7). Rückrufe macht der Betrieb.
- **Keine Preise, keine Terminzusagen, keine Garantien** am Telefon. Keine Bank-, Geburts- oder Gesundheitsdaten notieren (werden maskiert).
- Kein Durchstellen an Dritte (TKG-Frage offen, siehe recht.md §4).

## P0 ausprobieren (nur Python 3, nichts installieren)
```bash
cd phone/p0
python3 -m unittest -v                         # alle Abnahmetests
python3 -m telefonbot.cli --szenario standard  # Beispielgespräch Malerbetrieb (fiktiv)
python3 -m telefonbot.cli --config ../../clients/beispiel/telefon.json --szenario baeckerei
python3 -m telefonbot.cli --config ../../clients/beispiel/telefon.json   # selbst tippen wie am Telefon
```
Szenarien: standard, notfall, gas, wasser, preis, laminat, keine_ki, korrektur, sensibel, stille, spam, baeckerei.

## Woher kommt die Konfiguration eines Betriebs?
Aus dem Fragebogen (`onboarding/`). `npm run generate -- clients/<kunde>/antworten.json` schreibt
`clients/<kunde>/telefon.json` (für diese Engine) und `clients/<kunde>/telefon-prompt.md` (Prompt-Vorlage für P1).
Ein handgeschriebenes Beispiel für einen Handwerksbetrieb liegt in `p0/beispiele/maler-muster.json`.

## Aufbau P0 (`p0/telefonbot/`)
| Datei | Aufgabe |
|---|---|
| `engine.py` | Zustandsautomat: Begrüßung → Anliegen → Aufnahme → Bestätigung (≤ 2 Korrekturen) → Abschied; KI-Ablehnung, Stille, max. 6 Min., Spam |
| `notfall.py` | Notfallregeln (Wortlisten, die Regel gewinnt immer) |
| `extract.py` | Nummer (E.164) und Vorlesen in Zweiergruppen, PLZ, Name, Ort, Maskierung sensibler Daten |
| `llm.py` | Schnittstelle für ein Sprachmodell ab P1 – mit Zeitlimit; bei Fehler/Timeout feste Fragen (Fallback) |
| `summary.py` | E-Mail-Text, Event-JSON, Benachrichtigungsplan (E-Mail immer, Sofortnachricht nur bei HOCH/Notfall, nie bei Spam) |
| `store.py` | SQLite für Anrufe und Transkripte + Lösch-Job (30 Tage) |
| `cli.py`, `szenarien.py` | Konsole und Testgespräche |

Abweichungen von der Spezifikation: JSON statt YAML/pydantic und `unittest` statt `pytest` (keine Installation
nötig; die Tests laufen auch mit pytest). In P0 wird nichts versendet – E-Mail und Sofortnachricht werden nur erzeugt.

## Testergebnis P0
T01–T16 aus `docs/bau-spezifikation.md` §6 sind als Text-Tests umgesetzt und grün, dazu 6 Leitplanken-Tests.
P1-L1 (Latenz) und P1-Q1 (Spracherkennung) brauchen echte Sprache und API-Konten und sind in P0 als „übersprungen“ markiert.
