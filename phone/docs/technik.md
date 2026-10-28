# Technik-Empfehlung KI-Telefon-Bot
Stand 24.10.2026. Wo „Schätzung“ steht, ist der Wert nicht gemessen.

## Empfehlung in einem Satz
**Pilot mit sipgate sona Free (0 €, deutscher Anbieter, KI in Europa), das Konto läuft auf den Betrieb. Parallel baut Cheffchen einen eigenen Prototyp (Pipecat auf Hetzner + Mistral/IONOS) und testet ihn mit Julios Handy. Auf den Eigenbau wechseln erst, wenn 3 oder mehr Betriebe zahlen.**

## Vergleich
| Kriterium | sipgate sona (Plattform) | Eigenbau Pipecat/LiveKit auf Hetzner | Vapi / Retell / ElevenLabs |
|---|---|---|---|
| Startkosten für Julio | 0 € (Free, Konto des Betriebs) | ca. 1 $/Nummer + Centbeträge, Server läuft schon | Testguthaben 5–10 $, danach Minutenpreise |
| Kosten bei 150 Min. | 0 € | ca. 4 € + Server-Anteil (Schätzung) | ca. 14–24 € |
| Latenz (Schätzung) | gut, sipgate nennt < 100 ms für STT/TTS (Flow-Seite) | ca. 0,8–1,5 s pro Antwort mit Voxtral + Mistral Small. Muss gemessen werden | ca. 0,6–1,2 s, gut optimiert |
| Qualität Deutsch | Kernmarkt Deutschland, sollte gut sein, im Pilot prüfen | Voxtral TTS hat eine deutsche Stimme („Heidi“). Qualität unbekannt, ElevenLabs gilt als besser, aber teurer | sehr gut mit ElevenLabs-Stimmen |
| Aufwand Bau | 2–4 Std. pro Betrieb, Klick-Konfiguration | Prototyp ca. 3–6 Tage, danach ca. 1–2 Std. pro Betrieb | 1–2 Tage |
| DSGVO / Serverstandort | DE/EU, AVV mit sipgate, ISO 27001, kein Training mit Kundendaten | voll in der Hand: Hetzner DE, IONOS DE, Mistral FR. Telnyx/Twilio sind US-Firmen (Telefonie-Strecke), eine EU-Alternative ist sipgate trunking | US-Firmen, Drittlandtransfer (DPF/SCC prüfen) |
| AVV | Betrieb ↔ sipgate direkt | Betrieb ↔ Julio, Julio ↔ Hetzner/IONOS/Mistral/Telefonie (Unterauftragsverarbeiter) | Kette über US-Anbieter |
| Anbindung Anfrage-Assistent | Free: nur E-Mail-Benachrichtigung. Starter (69,95 €): Webhooks/API | voll integrierbar (gleiche Datenbank, Tageszusammenfassung, Angebotsentwurf) | Webhooks |
| Abhängigkeit | hoch (Tarife können sich ändern, Free hat Grenzen) | gering | hoch |

## Warum zuerst sona Free
1. **0 € Budget:** Julio zahlt nichts, und die Laufzeit des Betriebs bei sipgate ist monatlich kündbar.
2. **Recht einfacher:**
   - sipgate ist ein bei der BNetzA gemeldeter TK-Anbieter.
   - Der KI-Hinweis ist technisch fest eingebaut (laut sipgate-FAQ).
   - Der AVV läuft direkt zwischen Betrieb und sipgate.
   - Julio braucht keine eigenen Nummern und ist kein TK-Anbieter.
3. **Schnell:** In wenigen Stunden ist ein echter Pilot erreichbar.

**Grenzen von Free:**
- nur 1 Anruf gleichzeitig
- nur Deutsch
- 3 Playbooks
- keine Webhooks

Die Zusammenfassung kommt also als sona-E-Mail und nicht direkt in Julios Tageszusammenfassung. Ob Free gewerblich mit Einrichtung durch einen Dienstleister genutzt werden darf, steht nicht auf der Preisseite. **Die AGB müssen geprüft werden, bevor ein Konto angelegt wird (Julios Freigabe nötig).**

## Warum langfristig Eigenbau
- **Marge:** 2–10 € Kosten statt 83 € (sona Starter) pro Betrieb, wenn Webhooks gebraucht werden.
- **Ein Produkt:** Telefon, Chat und E-Mail landen in derselben Tageszusammenfassung und im selben Angebotsentwurf. Das ist Julios Alleinstellungsmerkmal gegenüber HERO, plancraft und IONOS.
- **Kontrolle:** Kein Audio wird gespeichert, siehe recht.md (§201 StGB). Das lässt sich im eigenen Code garantieren.

## Eigenbau-Stack (Vorschlag)
| Schicht | Wahl | Alternative |
|---|---|---|
| Telefonie | **sipgate trunking** (DE, SIP) mit Ortsnummer 03641 auf Julios Gewerbe als *Weiterleitungsziel* | Telnyx (SIP, ab 0,0032 $/Min.). Twilio ist teurer, und die Nummern dürfen nicht an Endkunden weitergegeben werden |
| Medien/SIP | **LiveKit Server + LiveKit SIP** selbst gehostet (Docker) auf Hetzner. Ports 5060 und RTP 10000–20000 | Pipecat mit WebSocket-Transport (Telnyx/Twilio Media Streams), dann ohne eigenen SIP-Server |
| Agent-Framework | **Pipecat** (Python, BSD-2) oder LiveKit Agents (Python, Apache-2.0) | – |
| VAD/Turn-Taking | Silero VAD (lokal) | – |
| STT | **Mistral Voxtral Realtime** (EU), `language=de` | Deepgram Nova-3 EU-Endpunkt |
| LLM | **IONOS AI Model Hub, Mistral Small 24B** (DE), Tool-Calls / Structured Output | Mistral La Plateforme |
| TTS | **Voxtral TTS 3**, Stimme „Heidi“ | Azure Neural, Region Germany West Central |
| Zusammenfassung | bestehender FastAPI-Dienst, E-Mail per SMTP, optional Telegram | SMS (Preis offen) |

Doku-Quellen (abgerufen 24.10.2026):
- https://docs.livekit.io/transport/self-hosting/sip-server/
- https://docs.livekit.io/telephony/accepting-calls/workflow-setup/
- https://docs.pipecat.ai/api-reference/server/services/transport/livekit
- https://docs.mistral.ai/models/voxtral-mini-transcribe-realtime-3-0
- https://docs.mistral.ai/models/voxtral-mini-tts-3-0.md
- https://www.sipgate.de/flow

**Latenz-Ziel:** Antwortbeginn höchstens 1,5 s nach Sprechende (Schätzung, im Test messen). Tricks:
- Die Antwort wird gestreamt.
- Ein kurzer Füllsatz („Einen Moment …“) kommt nur bei Tool-Calls.
- Begrüßung und feste Sätze werden einmal vorab synthetisiert und gecacht.

**Ausfall-Fallback:**
- Fällt das LLM aus, läuft ein fester Skript-Ablauf (Fragen der Reihe nach, ohne LLM).
- Fällt der ganze Server aus, sollte die Umleitung beim Betrieb auf die Mailbox gehen. Ob der Anschluss des Betriebs eine zweite Umleitung erlaubt, z. B. eine Kette Bot → Mailbox, ist noch nicht geprüft. **Plan B mit dem Betrieb absprechen.**
