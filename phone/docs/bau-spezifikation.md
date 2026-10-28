# Bau-Spezifikation: KI-Telefon-Bot (Prototyp) – für Cheffchen
Stand: 24.10.2026 · Ziel: Prototyp, den Julio mit seinem eigenen Handy anrufen kann. Kein echter Kundenbetrieb.
**Regeln:**
- Keine Konten anlegen, nichts kaufen, keine Nummer buchen und nichts veröffentlichen ohne Julios ausdrückliche Freigabe.
- Phase 0 läuft **vollständig offline**.
- Hintergrund: konzept.md (Gesprächsablauf), recht.md (Pflichten), technik.md (Begründung), kosten.md.

## 0. Phasen
| Phase | Inhalt | Konten/Ausgaben nötig |
|---|---|---|
| **P0 offline** | Dialog-Engine + Zustandsautomat + Zusammenfassung, Konsole (`demo/telefon_demo.py` ist die Referenz), Unit-Tests | keine |
| P1 Sprache lokal | Pipecat-Pipeline mit Mikrofon/Lautsprecher am Rechner, STT/TTS/LLM über API | Mistral- und IONOS-API-Keys (Julio-Freigabe, Centbeträge) |
| P2 Telefon | SIP-Eingang (sipgate trunking oder Telnyx) → LiveKit SIP → Agent | Telefonie-Konto + Nummer (Julio-Freigabe; Gewerbe-Nachweis mit Jena-Adresse nötig) |
| Alternative P2' | sipgate sona Free konfigurieren (kein Code; Playbook aus konzept.md) | sona-Konto **auf den Betrieb** |

## 1. Architektur
```
Anrufer ──PSTN──> Anschluss Betrieb ──(Umleitung bei Nichtmelden 20–25 s / zeitgesteuert)──> Bot-Nummer
   │                                                                             │ SIP
   │                                                                   [LiveKit SIP] (Hetzner, Docker)
   │                                                                             │ WebRTC-Room
   │                                                                   [Agent-Worker: Pipecat]
   │                                       Silero VAD → STT (Voxtral Realtime, de) → Dialog-Engine
   │                                       Dialog-Engine ⇄ LLM (IONOS Mistral Small 24B, Tool-Calls)
   │                                       Dialog-Engine → TTS (Voxtral TTS, Stimme konfigurierbar) → Anrufer
   │                                                                             │ call_ended(event)
   │                                                                   [FastAPI „anfrage-core“ (bestehend)]
   │                                                         SQLite pro Betrieb · E-Mail (SMTP) · Telegram · Tageszusammenfassung
```
Wichtig:
- **Kein Audio-Recording** in LiveKit (Egress deaktiviert). Kein Audio auf die Platte, auch nicht in Logs.
- Ein Worker pro Anruf. Konfiguration nach der gewählten Nummer (`called_number` → `betrieb_id`).
- Gleichzeitige Anrufe pro Betrieb begrenzen (Default 2). Ist das Limit erreicht, wird der Anruf freundlich angenommen und eine Rückrufnachricht aufgenommen, oder die SIP-Verbindung wird mit 486 Busy abgelehnt. Bei Busy geht der Anruf auf die Mailbox des Betriebs, falls dort so eingestellt.

## 2. Komponenten
| Modul | Datei (Vorschlag) | Aufgabe |
|---|---|---|
| Konfig-Loader | `config/betriebe/<id>.yaml` + `config_loader.py` | Schema-Validierung (pydantic) |
| Dialog-Engine | `dialog/engine.py` | Zustandsautomat (siehe §4), ruft LLM nur für Extraktion/Formulierung |
| Notfall-Klassifikator | `dialog/notfall.py` | **Regelbasiert zuerst** (Schlüsselwortliste in Konfig), LLM nur zusätzlich; Regel gewinnt immer |
| Extraktion | `dialog/extract.py` | LLM Structured Output → `Anfrage`-Schema; Telefonnummer-Normalisierung per Regex (E.164), PLZ-Prüfung |
| Prompt | `dialog/prompts.py` | System-Prompt aus Konfig gerendert (Leitplanken aus konzept.md §4) |
| Pipeline | `voice/pipeline.py` | Pipecat: Transport ↔ VAD ↔ STT ↔ Engine ↔ TTS; Barge-in an; Füllsatz bei Tool-Latenz > 700 ms |
| TTS-Cache | `voice/tts_cache.py` | Begrüßung, Notfallsätze, Abschied vorab synthetisieren (Text-Hash → WAV im RAM/Disk; das ist Bot-Audio, kein Anrufer-Audio) |
| Fallback | `dialog/fallback.py` | Wenn LLM > 3 s oder Fehler: feste Fragen der Reihe nach, Freitext übernehmen |
| Benachrichtigung | `notify/email.py`, `notify/telegram.py` | E-Mail an Betrieb; Telegram nur bei `HOCH` / Notfall |
| Persistenz | `store.py` | SQLite: `calls`, `transcripts` (TTL 30 Tage, täglicher Lösch-Job) |
| Admin-CLI | `cli.py` | `betrieb add/test`, `call simulate <szenario.yaml>` |

## 3. Schnittstellen
### 3.1 Datenmodell `Anfrage` (JSON-Schema-Kern)
```json
{
  "anliegen": "string (≤300 Zeichen)",
  "leistung": "enum: streichen|tapezieren|lackieren|fassade|boden|sonstiges|nicht_im_angebot",
  "details": "string|null",
  "ort": {"strasse": "string|null", "plz": "string(5)|null", "ort": "string|null"},
  "name": "string",
  "rueckruf": "string (E.164, z.B. +491761234567)",
  "rueckruf_bestaetigt": "bool",
  "erreichbarkeit": "string|null",
  "wunschtermin": "string|null",
  "email": "string|null",
  "dringlichkeit": "enum: normal|hoch|notfall_extern",
  "notfall_hinweis_gegeben": "bool",
  "ki_abgelehnt": "bool",
  "offen": ["string"],
  "spam": "bool"
}
```
### 3.2 Event an anfrage-core
`POST /api/v1/telefon/anrufe` (Bearer-Token je Worker, nur intern/localhost)
```json
{"betrieb_id":"maler-muster","call_id":"uuid","start":"2026-10-24T17:42:10+02:00","dauer_s":151,
 "anrufer_nummer":"+49176…|null","anfrage":{…Anfrage…},"transkript":[{"rolle":"bot|anrufer","text":"…","t":0.0}]}
```
Antwort `201 {"id": …}`. Dann E-Mail versenden (Format konzept.md §6) und bei `hoch` zusätzlich Telegram.
### 3.3 LLM-Aufruf
OpenAI-kompatible Chat-Completions (IONOS AI Model Hub). Pro Turn: System-Prompt + bisherige Turns + aktueller `Anfrage`-Stand. Tools:
- `update_anfrage(felder)`
- `notfall_melden(art)`
- `gespraech_beenden(grund)`

Temperatur 0,3, max. 120 Output-Token pro Turn. Endpunkt und Modellname kommen aus env, **nie im Code**.
### 3.4 Env
`IONOS_API_KEY, IONOS_BASE_URL, LLM_MODEL, MISTRAL_API_KEY, STT_MODEL=voxtral-mini-transcribe-realtime-3-0, TTS_MODEL=voxtral-mini-tts-3, LIVEKIT_URL/API_KEY/SECRET, SMTP_*, TELEGRAM_BOT_TOKEN`. Secrets kommen nur in `.env` (chmod 600), nicht ins Repo.

## 4. Zustandsautomat
`BEGRUESSUNG → ANLIEGEN → (NOTFALL_EXTERN → ENDE) | (NOTFALL_BETRIEB → AUFNAHME) | AUFNAHME → BESTAETIGUNG → (KORREKTUR ≤2 → BESTAETIGUNG) → ABSCHIED → ENDE`
- `KI_ABGELEHNT` ist aus jedem Zustand erreichbar. Danach werden nur Name und Rückrufnummer aufgenommen, oder das Gespräch wird beendet.
- Timeouts:
  - 8 s Stille: Nachfrage
  - 2× Stille: „Ich verstehe Sie leider nicht, bitte rufen Sie gern nochmal an“, dann ENDE
  - Gesamtdauer 6 Min.: Abschluss
- Rückrufnummer:
  - Bei unterdrückter Nummer immer fragen.
  - Sonst fragen: „Ist die Nummer, mit der Sie anrufen, die richtige?“
  - Ziffern in Zweiergruppen vorlesen.

## 5. Konfiguration pro Betrieb (`config/betriebe/maler-muster.yaml`)
Die Referenz liegt in `demo/maler-muster.json`, Felder siehe unten.
```yaml
id: maler-muster
firma: "Malerbetrieb Muster"
ort: "Jena"
bot_nummer: "+493641XXXXXXX"         # Platzhalter
stimme: "voice_481"                   # Voxtral „Heidi“ (prüfen)
oeffnungszeiten: {mo-fr: "07:00-16:00"}
datenschutz_url: "maler-muster.de/datenschutz"
leistungen: [streichen, tapezieren, lackieren, fassade, spachteln]
nicht_im_angebot: [laminat, fliesen, elektro, sanitaer]
notdienst: {aktiv: false, fenster: null, telegram_chat_id: null, nummer_ansage: null}
gas_entstoerung_nummer: "<vom Betrieb eintragen und prüfen>"
notfall_schluesselwoerter:
  extern_112: [feuer, brennt, rauch, verletzt, bewusstlos, notarzt, lebensgefahr]
  gas: [gas, gasgeruch, riecht nach gas]
  wasser: [rohrbruch, wasserschaden, wasser läuft, überschwemmt]
  betrieb_dringend: [gerüst, baustelle offen, nach ihren arbeiten]
empfaenger: {email: ["anfragen@maler-muster.de"], telegram: []}
max_dauer_s: 360
transkript_aufbewahrung_tage: 30
begruessung_ueberschreiben: null      # KI-Hinweis wird IMMER vorangestellt, nicht abschaltbar
```

## 6. Testfälle (Abnahme; P0 als Unit-Test mit Text, P1/P2 mit Sprache)
| ID | Szenario | Erwartung |
|---|---|---|
| T01 | Standard: „Wohnzimmer streichen, 20 m², Jena 07743, Max Muster, 0176 1234567“ | alle Pflichtfelder, Bestätigung vorgelesen, E-Mail Dringlichkeit normal |
| T02 | Begrüßung | Text enthält „künstliche Intelligenz“ und „nicht aufgenommen“ **vor** der ersten Frage (Regex-Test) |
| T03 | „Es brennt in der Küche“ | sofort 112-Hinweis, Ende, `notfall_extern`, keine weitere Datenaufnahme |
| T04 | „Hier riecht es nach Gas“ | Gas-Satz mit konfigurierter Nummer, Ende |
| T05 | Rohrbruch, Wasser an der Decke | Wasserhahn-Hinweis + Hinweis Installateur, Aufnahme, Dringlichkeit `hoch`, Telegram |
| T06 | „Was kostet das ungefähr?“ | keine Zahl in der Antwort (Regex `\d+\s*(€|euro)` darf nicht matchen) |
| T07 | „Können Sie Laminat verlegen?“ | „nicht im Angebot“, Aufnahme optional |
| T08 | „Ich will mit keiner KI reden“ | Option Nachricht/Bürozeiten, `ki_abgelehnt=true`, nur Name+Nummer |
| T09 | Nummer falsch verstanden, Korrektur „nein, 0176 7654321“ | korrigierte Nummer in Zusammenfassung |
| T10 | Anrufer nennt IBAN/Gesundheitsdaten | nicht in Zusammenfassung/Transkript-Felder (Maskierung) |
| T11 | 2× Stille | höflicher Abbruch, Anruf trotzdem gemeldet (mit Nummer falls vorhanden) |
| T12 | LLM-Timeout (Mock) | Fallback-Fragen, Zusammenfassung trotzdem vollständig |
| T13 | 7 Min. Gespräch | Abschluss bei 6 Min. |
| T14 | Prüfung Datensparsamkeit | nach Anruf **keine** Audiodatei auf Disk (`find / -newer start -name '*.wav' -o -name '*.ogg'` außer TTS-Cache-Ordner) |
| T15 | Transkript älter 30 Tage | Lösch-Job entfernt es |
| T16 | Spam/Beleidigung | Warnung, dann Ende, `spam=true`, keine Telegram-Nachricht |
| P1-L1 | Latenz | Median Antwortbeginn ≤ 1,5 s, p90 ≤ 2,5 s über 20 Turns (messen & protokollieren) |
| P1-Q1 | Deutsch-Qualität | 10 Testsätze mit Jenaer Straßennamen/PLZ, ≥ 9 korrekt erkannt |

## 7. Lieferumfang des Prototyps
- Repo-Ordner `telefon-bot/src/` mit README (Start lokal), `pytest` grün für T01–T16 (Text-Ebene).
- Kurzes Messprotokoll mit Latenz und Erkennungsquote, sobald P1 freigegeben ist.
- Ein Konfig-Beispiel und eine Liste der Konten, die nötig wären. **Angelegt wird keins.**
