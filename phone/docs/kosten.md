# Kosten KI-Telefon-Bot pro Betrieb und Monat
Stand: 24.10.2026, alle Preise am 24.10.2026 abgerufen. Julio ist Kleinunternehmer (§19 UStG) und kann **keine Vorsteuer abziehen**. Deshalb rechne ich mit **Bruttokosten** (netto × 1,19).
Achtung: Auch bei Rechnungen von US-Anbietern (Twilio, Telnyx, Vapi, Retell, ElevenLabs) muss Julio die deutsche USt im Reverse-Charge-Verfahren (§13b UStG) selbst abführen und kann sie nicht abziehen. Deshalb rechne ich auch dort +19 %. Das bitte mit dem Steuerberater kurz bestätigen.
Wechselkurs: 1 € = 1,1193 US-$ (EZB-Referenzkurs 23.10.2026, https://data.ecb.europa.eu/data/datasets/EXR/EXR.D.USD.EUR.SP00.A).

## 1. Einzelpreise (belegt)
### Telefonie
| Anbieter | Preis | Quelle |
|---|---|---|
| sipgate trunking 2 | 0 €/Monat (laut sipgate.de/preise und meetergo-Test 06.10.2026). Auf sipgatetrunking.de/tarife stehen dagegen **9,95 €/Monat**, die Angaben widersprechen sich, **vor Buchung prüfen**. Ortsrufnummern buchbar, neue Nummer laut Preisseite ca. 4,95–7,95 €/Monat netto. Eingehende Gespräche: kein Minutenpreis genannt | https://www.sipgate.de/preise, https://www.sipgatetrunking.de/tarife, https://help.sipgate.de/trunking/kann-ich-minutenpakete-fuer-meinen-trunk-buchen |
| sipgate.io (API, Webhooks) | Add-on 4,16 € bzw. 25,17 €/Monat netto, Webhooks ab 100 frei, dann ab 4,9 ct je Aufruf (Suchsnippet) | https://www.sipgate.de/preise, https://www.sipgate.io/preise |
| sipgate Flow (Telefonie + STT + TTS, eigene Logik per Webhook) | Kleinstes Paket 2.500 Min. für 249,95 € (9,9 ct/Min.), monatlich kündbar | https://www.sipgate.de/flow |
| Twilio DE | Ortsnummer 1,35 $/Monat, eingehend 0,0100 $/Min. Nur für **Unternehmen**, mit Gewerbeanmeldung. **Die Adresse muss im Vorwahlbereich liegen** (für 03641 also Jena) und zur Gewerbeanmeldung passen | https://www.twilio.com/en-us/voice/pricing/de, https://www.twilio.com/en-us/guidelines/de/regulatory |
| Twilio: Weitergabe von Nummern | Twilio **verbietet**, deutsche Twilio-Nummern an Endkunden „unterzuvergeben, zu vermieten oder zu verkaufen“ | https://www.twilio.com/en-us/legal/numbering-requirements |
| Telnyx | Nummer ab 1,00 $/Monat, eingehend ab 0,0032 $/Min. (SIP) bzw. +0,002 $/Min. Voice API. Vorwahl 03641 ist auf der Länderseite nicht gelistet (dort stehen z. B. 0345 Halle und 0365 Gera), **Verfügbarkeit prüfen** | https://telnyx.com/pricing/elastic-sip, https://telnyx.com/pricing/voice-api, https://telnyx.com/phone-numbers/germany |
| Vonage | Preis nur im Kundenkonto einsehbar. Weiterleitung an SIP oder App kostenlos, an ein Telefon fallen beide Strecken an | https://api.support.vonage.com/hc/en-us/articles/204015203 |
| Rufumleitung beim Betrieb (Telekom Business) | „Bei Nichtmelden“ einstellbar (z. B. nach 25 s). Die Umleitung selbst kostet nichts, es gilt der Preis einer abgehenden Verbindung, **bei einer Festnetz-Flat also meist 0 €**. Ziel sollte eine **Festnetznummer** sein, kein Handy | https://www.telekom.de/hilfe/internet-telefonie/telefonie/anrufweiterleitungen, https://loomira.ai/de/blog/rufumleitung-telekom |

### Sprache und KI (für den Eigenbau)
| Baustein | Preis | Quelle |
|---|---|---|
| STT Mistral Voxtral Mini Transcribe Realtime 3 (EU, Frankreich) | 0,008 $/Audiominute, Deutsch unterstützt | https://docs.mistral.ai/models/voxtral-mini-transcribe-realtime-3-0 |
| STT Deepgram Nova-3 Deutsch, EU-Endpunkt | 0,0048 $/Min. (Aktionspreis), regulär 0,0077 $/Min. | https://deepgram.com/pricing, https://developers.deepgram.com/reference/regional-endpoints.mdx |
| STT Azure (Region Germany West Central) | ca. 1 $/Audiostunde, also ca. 0,017 $/Min. (Drittquelle) | https://knowara.com/ai-tools/voice/microsoft-azure-ai-speech/, Regionen: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/regions |
| TTS Mistral Voxtral TTS 3, deutsche Stimme „Heidi“ | 13 $ pro 1 Mio. Zeichen | https://docs.mistral.ai/models/voxtral-mini-tts-3-0.md, https://docs.mistral.ai/inference/pricing |
| TTS Azure Neural (Germany West Central) | ca. 16 $ pro 1 Mio. Zeichen (Drittquelle) | wie Azure oben |
| LLM IONOS AI Model Hub, Mistral Small 24B (Deutschland) | 0,10 €/0,30 € pro 1 Mio. Input-/Output-Token netto | siehe ../docs/technik-und-kosten.md (docs.ionos.com, gültig ab 15.10.2026) |
| Server Hetzner | läuft schon für den Chat-Assistenten. Für Audio empfehle ich CX33 statt CX23, Aufpreis ca. **+3,60 €/Monat** für alle Betriebe zusammen | ../docs/technik-und-kosten.md |

### Fertige Voice-Plattformen
| Plattform | Preis | Quelle |
|---|---|---|
| **sipgate sona** (DE, eigene KI in Europa, ISO 27001) | **Free 0 €: 500 Min., 1 gleichzeitiger Anruf, nur Deutsch, 3 Playbooks, E-Mail-Benachrichtigung, Weiterverbinden, keine Webhooks/API.** Starter 69,95 € netto: 1.000 Min., 2 gleichzeitig, Webhooks/API. Darüber 0,12 €/Min. Berechnet wird nur aktive Gesprächszeit | https://sona.sipgate.de/preise/, https://help.sipgate.com/tarife-and-kosten/sipgate-sona-tarife-and-kosten |
| IONOS KI-Telefonassistent | 39 €/Monat inkl. MwSt. mit 30 Anrufen, dann 0,49 €/Anruf. 69 € für 100 Anrufe, 99 € unbegrenzt (Suchsnippet) | https://www.ionos.de/momentum/ki-telefonassistent |
| Vapi (USA) | 0,05 $/Min. Plattform + STT/LLM/TTS/Telefonie zum Einkaufspreis, zusammen ca. 0,08–0,14 $/Min. | https://vapi.ai/pricing, https://micdrop.dev/blog/vapi-pricing |
| Retell AI (USA) | 0,07–0,31 $/Min., typisch ca. 0,11–0,13 $/Min. | https://www.retellai.com/pricing |
| ElevenLabs Agents | 0,08 $/Min. + LLM. Pläne: Creator 22 $ (275 Min.), Pro 99 $ (1.238 Min.) | https://elevenlabs.io/pricing/agents |
| Synthflow | nur auf Anfrage, Enterprise ab 30.000 $/Jahr, EU-Region vorhanden | https://docs.synthflow.ai/pay-as-you-go.mdx, https://docs.synthflow.ai/customer-region.md |
| fonio Partner/Reseller | Laut Suchsnippet Solo 1.000 Min. für 99 €, Team 3.000 Min. für 299 €, White Label ca. 750 €/Monat. **Nicht direkt bestätigt, auf Anfrage.** fonio-Telefonie läuft über Twilio | https://fonio.info/de/partner-program/co-branding, https://reseller-portal.fonio.ai/, https://www.fonio.ai/de/preise |

## 2. Beispielrechnung pro Betrieb und Monat (brutto, meine Schätzung)
Annahmen (geschätzt): Der Bot spricht ca. 50 % der Zeit mit ca. 12 Zeichen pro Sekunde, das sind ca. 360 TTS-Zeichen pro Gesprächsminute. Pro Minute ca. 12.000 Input- und 400 Output-Token, weil der Gesprächsverlauf jedes Mal mitgeschickt wird. STT läuft die ganze Gesprächszeit. Eine Nummer pro Betrieb.

| Variante | 50 Min. | 150 Min. | 300 Min. | Bemerkung |
|---|---|---|---|---|
| **A: sipgate sona Free** (Konto auf den Betrieb) | **0 €** | **0 €** | **0 €** | bis 500 Min., dann 0,14 €/Min. brutto. Nur 1 Anruf gleichzeitig |
| B: sipgate sona Starter | 83,24 € | 83,24 € | 83,24 € | lohnt erst mit Webhooks oder mehreren Gesprächen gleichzeitig |
| **C: Eigenbau Telnyx + Voxtral + Mistral (IONOS)** | **ca. 2,10 €** | **ca. 4,15 €** | **ca. 7,25 €** | dazu Server-Anteil ca. 1–4 €. Davon Telefonie 0,23/0,70/1,39 €, Nummer 0,89 €, STT 0,36/1,07/2,14 €, TTS 0,21/0,63/1,25 € (netto) |
| C': Eigenbau mit Twilio | ca. 2,70 € | ca. 5,30 € | ca. 9,15 € | + Server-Anteil |
| D: Vapi (Standard-Mix) | ca. 4,70 € | ca. 14 € | ca. 28 € | US-Anbieter, DSGVO aufwendiger |
| E: Retell | ca. 5,90 € | ca. 17,50 € | ca. 35 € | US-Anbieter |
| F: ElevenLabs Agents (Creator-Plan, 275 Min.) | ca. 23,40 € | ca. 23,40 € | ca. 27 € | Plan pro Konto, nicht pro Betrieb |
| G: sipgate Flow | ab 297 € Paket | | | erst ab ca. 15–20 Betrieben sinnvoll |

Ergänzend (Schätzung):
- E-Mail-Zusammenfassung über den bestehenden Server: 0 €.
- SMS ca. 5–10 ct pro SMS, **Preis noch nicht geprüft**. Ich empfehle E-Mail, optional Telegram (0 €).
- Rufumleitung beim Betrieb: meist 0 € bei Festnetz-Flat.

**Fazit:** Die Technik kostet pro Betrieb **0–10 €/Monat**. Der echte Aufwand ist Julios bzw. Cheffchens Zeit für Einrichtung und Pflege. Geschätzt 2–4 Std. Einrichtung pro Betrieb und ca. 30–60 Min. Pflege pro Monat.

## 3. Wie viele Minuten sind realistisch? (Schätzung)
Ein Handwerksbetrieb mit 5–15 verpassten Anrufen pro Woche à 1,5–2,5 Min. kommt auf ca. 30–150 Min./Monat. 300 Min. sind schon viel. Das muss der Pilot zeigen.
