# KI-Chat-Assistent (Website)

Zwei Teile:

- `widget/jenaisystems-chat.js` – das Chatfenster für die Website des Kunden. Eine Datei, keine Abhängigkeiten,
  keine Cookies, nichts wird im Browser gespeichert. Vor der ersten Nachricht erscheint ein Hinweis
  („Hier antwortet eine KI …“, Datenschutz-Link). Unten stehen immer „Anrufen“ und „E-Mail“ als Ausweg.
- `worker/` – ein kleines Programm für **Cloudflare Workers**. Es nimmt die Frage entgegen, hängt den Prompt und das
  Wissen des Kunden an und fragt ein Sprachmodell. **Standard: Cloudflare Workers AI** (gleiches Konto, kostenloses
  Tageskontingent, kein KI-Schlüssel nötig). Alternativ jeder OpenAI-kompatible Anbieter (z. B. Mistral).

## Einbinden beim Kunden
```html
<script src="https://IHR-WORKER.workers.dev/jenaisystems-chat.js" data-client="kunden-id"
        data-endpoint="https://IHR-WORKER.workers.dev" defer></script>
```
Die Domain der Kundenseite muss im Fragebogen unter „Website-Adressen“ stehen, sonst lehnt der Worker ab.

## Demo-Modus (z. B. JenAiSystems-Website)
```html
<script src="jenaisystems-chat.js" data-client="jenaisystems" data-demo="beispiel"
        data-main-label="JenAiSystems" data-demo-label="Demo: Bäckerei" data-endpoint="https://IHR-WORKER.workers.dev" defer></script>
<button data-jenaisystems-open="demo" data-jenaisystems-ask="Habt ihr glutenfreies Brot?">Demo ausprobieren</button>
```
- Im Chatfenster erscheint ein Umschalter. Jeder Assistent hat einen eigenen Verlauf. Der Demo-Betrieb ist immer als
  „erfunden“ gekennzeichnet (Kopfzeile, Hinweis im Verlauf, Fußzeile ohne echte Kontaktwege).
- Der Worker behandelt beide Kunden-IDs getrennt (eigene Monats- und Minutenlimits, `limit_monat`/`limit_minute` im Fragebogen).
  Die Website-Domain muss bei beiden Kunden unter „Website-Adressen“ stehen.
- Schnellfragen: `chat_vorschlaege` im Fragebogen (höchstens 4).

## Schutz vor Kosten und Missbrauch
- Nur erlaubte Domains (CORS + Prüfung im Worker)
- Höchstens 8 Fragen pro Minute und Besucher (pro Worker-Instanz, also grob)
- Monatsgrenze pro Kunde (`limit_monat` im Fragebogen) und eine Gesamtgrenze `GLOBAL_MONTHLY_CAP`.
  Zuverlässig zählt das nur mit einem KV-Speicher (`USAGE`, siehe `wrangler.toml.example`).
  Laut Cloudflare-Doku (Stand Okt. 2026) erlaubt der Free-Plan 100.000 Worker-Anfragen pro Tag, aber nur
  1.000 KV-Schreibvorgänge pro Tag und 1 pro Sekunde auf denselben Schlüssel. Jede Chat-Antwort schreibt 2 Zähler,
  also reicht der Free-Plan für grob 500 Chat-Antworten pro Tag über alle Kunden. Darüber: Paid-Plan oder Durable Objects (prüfen).
- Nur die letzten 8 Nachrichten, je höchstens 800 Zeichen, gehen an das Modell. Antworten höchstens 350 Token.
- Der System-Prompt kommt immer vom Server; Besucher können ihn nicht mitschicken.

## Modell und Gratis-Kontingent (Cloudflare Workers AI)
- Modell: `@cf/mistralai/mistral-small-3.1-24b-instruct` (Mistral Small 3.1, 24B, gut auf Deutsch, 128k Kontext).
  Ersatzmodell bei Fehlern: `@cf/meta/llama-3.3-70b-instruct-fp8-fast`. Beide laut Cloudflare-Katalog (Okt. 2026) verfügbar.
- Gratis: 10.000 Neurons pro Tag (Reset 00:00 UTC). Mistral Small 3.1 kostet ≈ 31.876 Neurons pro Million Eingabe-Token
  und ≈ 50.488 pro Million Ausgabe-Token.
- Rechnung JenAiSystems-Assistent: Prompt + Wissen ≈ 5.500 Token, dazu Verlauf ≈ 500, Antwort ≈ 150
  → ≈ 200 Neurons pro Antwort → **≈ 50 Antworten pro Tag** (grob 15–25 Gespräche). Bäckerei-Demo (kleinerer Prompt)
  ≈ 70 Neurons → ≈ 140 Antworten pro Tag. Beide teilen sich das Kontingent.
- `GLOBAL_DAILY_CAP = "45"` hält das Kontingent sicher ein. Danach zeigt der Chat freundlich E-Mail und Telefon.
  Mehr Kapazität: Wissen kürzen (halber Prompt ≈ doppelte Antworten) oder Workers Paid (5 $/Monat + 0,011 $ pro 1.000 Neurons).
- Datennutzung laut Cloudflare (developers.cloudflare.com/workers-ai/platform/data-usage, Stand 16.10.2026):
  Eingaben und Ausgaben werden **nicht zum Training** verwendet und nach der Antwort **nicht gespeichert**
  (keine Speicherung, solange man kein Logging/KV dafür einschaltet). Cloudflare ist ein US-Unternehmen –
  Auftragsverarbeitung (DPA ist Teil der Cloudflare-Bedingungen) und Drittlandübermittlung in der Datenschutzerklärung nennen.

## Datenschutz
- Standard: **nichts wird gespeichert**. Fehler werden ohne Inhalte protokolliert.
- Optional: anonymes Fragen-Log für den Monatsbericht. Nur wenn beim Kunden `fragen_auswerten = ja` UND im Worker
  `LOG_QUESTIONS = "true"` UND KV gebunden. E-Mail, Telefon und IBAN werden vorher entfernt, Löschung nach 90 Tagen.
  Muss in der Datenschutzerklärung des Kunden stehen.
- Der Modell-Anbieter verarbeitet die Fragen. Dafür braucht es einen Auftragsverarbeitungsvertrag (AVV) mit dem
  Anbieter und einen Satz in der Datenschutzerklärung. Mistral (Frankreich) ist voreingestellt – Serverstandort und AVV
  vor Vertragsabschluss beim Anbieter prüfen.

## Anbieter wechseln
Jeder Anbieter mit OpenAI-kompatibler Schnittstelle geht. Nur drei Einstellungen:
`LLM_BASE_URL`, `LLM_MODEL` (in `wrangler.toml`) und der geheime `LLM_API_KEY`.
Voreingestellt: `https://api.mistral.ai/v1` und `mistral-small-latest` (laut Mistral-Doku im Oktober 2026 = Mistral Small 4).

## Lokal testen (ohne Konto)
- Workers AI läuft nur bei Cloudflare (auch `wrangler dev` braucht dafür ein Konto). Ohne Konto: Tests mit
  gefälschtem Modell (`npm test`, Datei `test/worker.test.mjs`) und `npx wrangler deploy --dry-run` (prüft das Paket).
- `npm run dev` startet einen Testserver mit „Übungs-Modell“ (sucht nur Stichworte im Wissen, kein echtes KI-Modell).
- Mit dem echten Cloudflare-Laufzeitsystem: `npx wrangler dev` im Ordner `worker/` (braucht kein Konto für lokal).
  `LLM_BASE_URL=http://localhost:8787/mock-llm/v1` zeigt dabei auf das Übungs-Modell des Testservers.

## Veröffentlichen (erst nach Julios Freigabe)
1. Kostenloses Cloudflare-Konto (Workers Free-Plan). Kein weiteres KI-Konto nötig.
2. `cd assistant/worker && cp wrangler.toml.example wrangler.toml` (Workers AI ist dort schon eingetragen)
3. Optional KV für zuverlässige Zähler: `npx wrangler kv namespace create USAGE`, ID eintragen
4. Mit API-Token: `CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… npx wrangler deploy` (Token nie einchecken)
5. Worker-Adresse in `site/main.js` (`CHAT_ENDPOINT`) und in der CSP (`connect-src`) von `site/index.html` eintragen
6. Datenschutzerklärung: Abschnitt KI-Chat ausfüllen (Cloudflare Workers AI als Empfänger)
- Alternative Mistral & Co.: `LLM_PROVIDER = "openai"`, `LLM_BASE_URL`, `LLM_MODEL`, `npx wrangler secret put LLM_API_KEY`.
