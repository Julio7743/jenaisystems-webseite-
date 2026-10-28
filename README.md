# JenAiSystems

Alles für die Agentur JenAiSystems an einem Ort: die eigene Website, der KI-Chat-Assistent für Kunden-Websites,
der KI-Telefonassistent und der Fragebogen, mit dem ein neuer Kunde eingerichtet wird.

> **Stand 24.10.2026: Nichts davon ist online.** Es gibt keine Konten bei Cloudflare, Mistral oder Telefonanbietern,
> und es wurde nichts bezahlt. Alles läuft nur lokal zum Testen.

## Marke

- **Name:** JenAiSystems (JEN = Joint Evolution Network)
- **Mission:** Turn intelligence into action.
- **Leitgedanke:** Intelligence that moves things forward.
- **Claim:** Beyond intelligence. Into action.
- **Prinzipien:** Judgment · Execution · Navigation
- Markenstrategie und Texte: `brand/` und `content/`

## Veröffentlichung der Website

Nur der Ordner `site/` wird veröffentlicht (GitHub Pages, Workflow `.github/workflows/pages.yml`, Domain `jenaisystems.com` in `site/CNAME`).
Alles andere im Repo (Kunden, Preise, Telefon-Doku, Rechtsfragen) wird **nicht** ausgeliefert, ist aber sichtbar, wenn das Repo öffentlich ist.

## Was liegt wo?

| Ordner | Inhalt |
|---|---|
| `site/` | Die JenAiSystems-Website (Entwurf, noch nicht veröffentlicht) mit eigenem KI-Assistenten, Demo-Modus (erfundene Bäckerei) und Telefon-Demo als Text-Simulation. **Das Repo ist die Quelle**; `/workspace/jenaisystems/` auf dem Rechner ist nur eine Kopie |
| `assistant/widget/` | Das Chatfenster, das auf Kunden-Websites eingebaut wird |
| `assistant/worker/` | Das Programm im Hintergrund, das die Fragen an das KI-Modell weitergibt (für Cloudflare Workers) |
| `phone/` | Der KI-Telefonassistent. Phase P0 (offline) ist fertig, P1/P2 sind Vorlagen. Spezifikation in `phone/docs/` |
| `onboarding/` | Der Fragebogen für neue Kunden und der Generator, der daraus Wissen und Prompts macht |
| `clients/` | Ein Ordner pro Kunde. `clients/jenaisystems/` ist der Assistent der JenAiSystems-Website (Wissen nur aus der Website). `clients/beispiel/` ist eine **erfundene** Bäckerei für Tests und den Demo-Modus |
| `demo/` | Demo-Seite mit eingebautem Chat (Beispiel-Bäckerei) |
| `scripts/` | Hilfsprogramme: Testserver, Screenshots, Bauschritte |
| `test/` | Automatische Tests |
| `docs/screenshots/` | Bilder von Chat und Fragebogen |

## So kommt ein neuer Kunde dazu (Schritt für Schritt)

1. **Fragebogen schicken:** `onboarding/fragebogen.html` an den Kunden geben (Datei oder später als Link).
   Er füllt ihn aus und klickt auf „Antworten herunterladen“. Am besten gehen Sie die Fragen 30–60 Minuten
   gemeinsam am Telefon oder per Videocall durch.
2. **Ordner anlegen:** die Datei als `clients/<kurzname>/antworten.json` speichern.
3. **Generieren:** `npm run generate -- clients/<kurzname>/antworten.json`
   Das Programm prüft Pflichtfelder und zeigt Hinweise. Danach liegen dort `wissen.md`, `chat-prompt.md`,
   `client.json` und, falls gewünscht, `telefon.json` und `telefon-prompt.md`.
4. **Lesen und prüfen:** `wissen.md` und `chat-prompt.md` durchlesen. Stimmt alles? Steht nichts drin, was der
   Kunde nicht sagen darf (z. B. Gesundheitsversprechen)? Den Kunden die Wissensdatei bestätigen lassen.
5. **In den Worker übernehmen:** `npm run build:worker`
6. **Testen:** `npm run dev`, dann http://localhost:8787/demo/ öffnen (Übungsmodus ohne echtes KI-Modell).
   Für den Telefonassistenten: `cd phone/p0 && python3 -m telefonbot.cli --config ../../clients/<kurzname>/telefon.json`
7. **Speichern:** `git add clients/<kurzname> assistant/worker/src/clients.generated.js && git commit -m "Kunde <kurzname>"`
8. **Live schalten** (erst wenn Konten da sind, siehe unten): `npx wrangler deploy` im Ordner `assistant/worker`,
   dann den Einbau-Code aus `assistant/README.md` auf der Kunden-Website einfügen.
9. **Pflege:** Ändert sich etwas (Öffnungszeiten, Preise), die `antworten.json` anpassen und ab Schritt 3 wiederholen.

## Der eigene Assistent auf der JenAiSystems-Website

- **Wissen:** `clients/jenaisystems/antworten.json`. Alles darin stammt von der Website. Ändert sich die Website
  (Preise, Leistungen, FAQ), diese Datei mitpflegen und `npm run generate:jenaisystems` ausführen.
- **Demo-Modus:** Im Chatfenster schaltet „Demo: Bäckerei“ auf die erfundene Beispiel-Bäckerei um (eigener Verlauf,
  deutlich als erfunden gekennzeichnet). Der Abschnitt „Live-Demo“ (`#demo`) hat Knöpfe, die direkt eine Frage stellen.
- **Telefon-Demo:** Beispielanrufe der Offline-Engine P0 als Text-Simulation. Erzeugt mit `npm run build:site`
  (kopiert auch das Widget nach `site/jenaisystems-chat.js`). Der Test prüft, dass `site/` aktuell ist.
- **Limits:** Beide Assistenten zählen getrennt. JenAiSystems: 1000 Anfragen/Monat, 8/Minute. Demo: 300/Monat, 5/Minute.
- **Vor dem Livegang:** Worker veröffentlichen und in `site/index.html` beim Chat-Script `data-endpoint` setzen,
  Datenschutzerklärung um den Chat ergänzen (Platzhalter `#chat` in `site/datenschutz.html`).
- **Screenshots:** `npm run dev`, dann z. B.
  `node scripts/screenshot.mjs http://localhost:8787/site/ docs/screenshots/site-chat-preisfrage.png 1280 0 800 scripts/shots/chat-preis.js`
  (weitere Abläufe in `scripts/shots/`).

## Tests

```bash
npm test            # Node-Tests (Generator, Worker) + Telefon-Tests (Python)
npm run dev         # lokaler Testserver: /demo/, /onboarding/fragebogen.html, /site/
```
Benötigt Node 20 oder neuer und Python 3. Es muss nichts installiert werden.

## Was später nötig ist (nichts davon ist angelegt)

| Wofür | Was | Kosten |
|---|---|---|
| Chat-Assistent online | Cloudflare-Konto (Workers) | Free-Plan: 100.000 Anfragen/Tag laut Cloudflare-Doku, Okt. 2026 (prüfen) |
| KI-Antworten | Konto bei einem Modell-Anbieter, z. B. Mistral (Frankreich), plus AVV | nach Verbrauch. Laut Mistral-Doku im Okt. 2026: Mistral Small 4 kostet 0,15 $ pro 1 Mio. Eingabe-Token und 0,60 $ pro 1 Mio. Ausgabe-Token. Vor Abschluss prüfen |
| Telefonassistent P1 | API-Konten für Sprache und Modell | siehe `phone/docs/kosten.md`, vor Abschluss prüfen |
| Telefonassistent P2 | Telefonie-Konto und Nummer, oder sipgate sona auf den Betrieb | siehe `phone/docs/kosten.md` und `phone/p2-vorlage/` |
| Website online | Domain `jenaisystems.com` und Hosting (z. B. Cloudflare Pages) | Domain ca. 1 € pro Monat (Anbieter vergleichen) |

Rechtliches vor dem ersten echten Kunden:
- AVV mit jedem Kunden und mit den Anbietern
- Datenschutzerklärung des Kunden um Chat und Telefon ergänzen
- KI-Hinweis (AI Act Art. 50) ist eingebaut
- Offene Fragen für den Anwalt stehen in `phone/docs/recht.md`

## Sicherheit
- Geheimnisse wie API-Schlüssel gehören **nie** ins Repo. `.env`, `.dev.vars` und `wrangler.toml` sind in `.gitignore`.
  Schlüssel setzt man mit `npx wrangler secret put …`.
- Audiodateien sind im Repo gesperrt. Der Telefonassistent speichert nie Audio.
