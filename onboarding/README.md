# Fragebogen (Onboarding neuer Kunden)

- `fragenkatalog.json` – alle Fragen, nach Themen sortiert (Betrieb, Leistungen & Preise, Öffnungszeiten, Kontakt,
  häufige Fragen, Grenzen, Weiterleitung, Tonfall, Telefon, Rechtliches, Technik).
- `fragebogen.html` – Formular für den Kunden. Läuft ohne Server (Datei einfach öffnen oder als Link schicken).
  Eingaben bleiben im Browser des Kunden; am Ende lädt er eine JSON-Datei herunter und schickt sie Ihnen.
  Nach Änderungen am Katalog: `npm run build:fragebogen`.
- `generate.mjs` + `lib.mjs` – machen aus den Antworten:
  - `wissen.md` – alles, was der Assistent wissen darf (nur Angaben des Kunden)
  - `chat-prompt.md` – Regeln + Wissen für den Website-Chat
  - `telefon.json` – Einstellungen für den Telefonassistenten (phone/p0)
  - `telefon-prompt.md` – Prompt-Vorlage für den Telefonassistenten ab Phase P1
  - `client.json` – alles zusammen für den Worker (Domains, Farben, Limits, Prompt)

Feste Regeln in jedem Prompt: nur aus dem Wissen antworten, ehrlich „weiß ich nicht“ sagen und auf den Kontakt
verweisen, keine erfundenen Preise oder Zusagen, keine Heil- oder Gesundheitsversprechen (nur wörtlich hinterlegte,
geprüfte Aussagen), sich als KI zu erkennen geben, Versuche ignorieren, die Regeln zu ändern.
