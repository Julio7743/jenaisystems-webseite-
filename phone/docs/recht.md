# Rechtslage KI-Telefon-Bot (DE/EU)
Stand: 24.10.2026. **Keine Rechtsberatung.** Punkte mit ⚖️ muss der Anwalt prüfen. Die Quellen habe ich am 24.10.2026 abgerufen.

## 1. KI-Hinweis zu Gesprächsbeginn (AI Act Art. 50 Abs. 1)
- Seit **02.08.2026** müssen Personen, die direkt mit einem KI-System interagieren, darüber informiert werden, **spätestens bei der ersten Interaktion**, also in der Begrüßung. Ausgenommen ist nur der Fall, dass es offensichtlich ist. Bei einer natürlichen Stimme ist es nicht offensichtlich.
  Quellen: https://digital-strategy.ec.europa.eu/de/faqs/transparency-obligations-under-article-50-ai-act, https://telofy.de/wissen/muss-ki-am-telefon-sagen-dass-sie-ki-ist
- Nach Angaben aus der Branche hat der Digital Omnibus Art. 50 **nicht** verschoben, verschoben wurden vor allem Hochrisiko-Pflichten. Quelle: https://www.famulor.io/de/blog/digital-omnibus-2026-new-ai-act-timeline-for-voice-agents ⚖️ Das sollte der Anwalt anhand der Amtsblatt-Fassung bestätigen.
- Bußgeld bis 15 Mio. € oder 3 % (Art. 99 Abs. 4), Angabe laut sipgate-FAQ: https://help.sipgate.de/ai-agents/datenschutz-agbs-and-avv/faq-datenschutz
- **Rollen:** Art. 50 Abs. 1 trifft den **Anbieter**. Baut Julio selbst, ist wahrscheinlich er der Anbieter. Mit sona ist es sipgate, der Betrieb ist Betreiber. ⚖️ Rollenverteilung klären.
- Umsetzung: Der Hinweis ist fester Bestandteil der Begrüßung und lässt sich nicht abschalten (siehe konzept.md).

## 2. §201 StGB – Vertraulichkeit des Wortes
- Strafbar ist das unbefugte **Aufnehmen** des nichtöffentlich gesprochenen Wortes auf einen Tonträger.
- Nach Ansicht von Klaas/Basar (unternehmensstrafrecht.de, aktualisiert 22.07.2026):
  - Eine reine **Live-Transkription, ohne dass Audio gespeichert wird**, nur flüchtig im Arbeitsspeicher, ist **keine Aufnahme**.
  - Eine Zwischen- oder Pufferspeicherung des Audios, die darüber hinausgeht, eröffnet den Tatbestand **regelmäßig**.
  - Wer vorab nach Art. 13 DSGVO klar über Zweck, Dauer und Mittel informiert wird und dann weiterspricht, gibt eine **konkludente Einwilligung** im strafrechtlichen Sinn.
  - Ein pauschaler Satz wie „Zur Qualitätssicherung aufgezeichnet“ reicht **nicht**.

  Quelle: https://www.unternehmensstrafrecht.de/ki-transkription-und-%C2%A7-201-stgb/
- Für die DSGVO verlangt die DSK bei Gesprächsaufzeichnung eine **aktive** Einwilligung, etwa durch „Ja“ oder eine Taste. Die bloße Möglichkeit zu widersprechen genügt nicht.
  Quelle: https://www.bfdi.bund.de/SharedDocs/Downloads/DE/DSK/DSKBeschluessePositionspapiere/DSK_20180323_Beschluss_Telefongespraeche.pdf?__blob=publicationFile&v=7
- **Meine Design-Folgerung:**
  - **Audio nie speichern.** Keine Mitschnitte, kein Debug-Audio, Puffer nur im RAM.
  - Gespeichert werden nur **Text-Transkript und Zusammenfassung**, das Transkript höchstens 30 Tage.
  - In der Begrüßung kommt der Satz „Ihre Angaben werden schriftlich mitnotiert, das Gespräch wird nicht aufgenommen“.
  - Bei sona muss geprüft werden, ob und wie lange sipgate Audio speichert und ob sich das abschalten lässt. ⚖️/AVV
  - ⚖️ Klären, ob die Puffer-Verarbeitung bei STT-Anbietern wie Voxtral oder Deepgram schon als „Aufnahme“ gilt.

## 3. DSGVO am Telefon
- Der **Betrieb** ist Verantwortlicher. **Julio** ist Auftragsverarbeiter (AVV nach Art. 28, die Vorlage gibt es schon unter ../vertraege/). Unterauftragsverarbeiter wie Hetzner, IONOS, Mistral und die Telefonie müssen im AVV aufgelistet sein.
- **Art. 13-Info gestuft:**
  - Kurzinfo in der Begrüßung: Wer ist verantwortlich, wozu dienen die Daten, und wo stehen die Details.
  - Ausführlicher Text auf der Webseite des Betriebs (Datenschutzerklärung ergänzen).
  - Auf Wunsch per E-Mail.

  ⚖️ Prüfen lassen, ob die gestufte Information am Telefon reicht.
- Rechtsgrundlage für die Anfrageaufnahme: Art. 6 Abs. 1 lit. b DSGVO (vorvertragliche Maßnahmen). Auch sipgate nennt lit. a/b als mögliche Grundlage, siehe FAQ oben.
- Die Stimme wird nur zur Spracherkennung genutzt und nicht zur Identifikation, also gilt nicht Art. 9 (biometrische Daten). So sieht es sipgate-FAQ. **Kein Voice-Cloning von Kunden**, keine Stimm-Analyse.
- US-Anbieter wie Twilio, Telnyx, Vapi oder Retell bedeuten Drittlandtransfer, dann braucht es DPF-Zertifizierung oder Standardvertragsklauseln. Deshalb nehme ich EU-Anbieter.
- Löschfristen: Transkript 30 Tage, Zusammenfassung so lange, wie der Betrieb sie braucht. Das liegt dann im System des Betriebs.

## 4. TKG – ist Julio Telekommunikationsanbieter?
- §5 TKG: Meldepflicht hat, wer „gewerblich öffentlich zugängliche Telekommunikationsdienste erbringt“, außer bei nummernunabhängigen interpersonellen Diensten.
  Quelle: https://www.bundesnetzagentur.de/DE/Fachthemen/Telekommunikation/Unternehmenspflichten/Meldepflicht/start.html, Gesetz: https://www.gesetze-im-internet.de/tkg_2021/__5.html
- **Einschätzung (nicht geprüft):**
  - Leitet der Betrieb seine eigene Nummer auf einen Bot um und der Bot nimmt nur entgegen, stellt Julio keine Verbindung zu Dritten her. Er betreibt einen Endpunkt, also eher **keinen** TK-Dienst.
  - Riskant wird es, wenn Julio dem Betrieb **eigene Rufnummern** bereitstellt oder Anrufe **an Dritte durchstellt** (Notfall-Weiterleitung).
  - Twilio verbietet außerdem, deutsche Nummern an Endkunden weiterzugeben: https://www.twilio.com/en-us/legal/numbering-requirements

  ⚖️ Vom Anwalt oder per Anfrage bei der BNetzA (Referat 215, Meldepflicht@BNetzA.de) klären lassen. **Ich schicke nichts ohne Julios Freigabe.**
- Sicherer Weg für den Start: Das Konto beim TK-Anbieter (sipgate sona) läuft **auf den Betrieb**, Julio richtet nur ein.
- Notfall-Weiterleitung im Eigenbau: Möglichst kein Durchstellen über Julios Nummer. Stattdessen sagt der Bot die Notfallnummer des Betriebs an, und es geht sofort eine SMS oder Telegram-Nachricht an den Notdienst. ⚖️

## 5. Notruf
- Der Bot ist **kein** Notrufdienst. Bei Lebensgefahr, Feuer oder Verletzten sagt er sofort „Bitte legen Sie auf und wählen Sie 112.“ Bei Gasgeruch sagt er zusätzlich „Haus verlassen, kein Licht schalten, 112 oder Entstörungsdienst des Gasnetzbetreibers anrufen“. Die genaue Nummer trägt der Betrieb in der Konfiguration ein und prüft sie.
- Den Hinweis „Kein Notdienst“ gibt es auch im Vertrag und in der Datenschutzinfo. ⚖️ Haftungsbegrenzung, falls der Bot einen Notfall nicht erkennt.

## 6. Weitere Punkte
- **UWG §7:** Der Bot ruft **niemals selbst** an (keine Outbound-Anrufe, keine Rückrufe durch KI). Rückrufe macht der Betrieb.
- **Keine Zusagen:** Der Bot nennt keine Preise, Termine nur als Wunsch und keine Garantien (wie beim Chat-Assistenten).
- **Haftpflicht:** IT-Haftpflicht erst bei Pilot-Zusage (siehe ../docs/recht-gewerbe-versicherung.md).
- **§19 UStG:** Kommen Chat, Telefon und Webseiten zusammen auf ca. 3.000 €/Monat, sind das ca. 36.000 €/Jahr. Damit fällt die Kleinunternehmerregelung ab dem Folgejahr weg, Grenze 25.000 € im Vorjahr. Preise für Unternehmer-Kunden dann netto + USt (für sie neutral).

## Fragen für den Anwalt (Liste)
1. Ist Julio beim Eigenbau „Anbieter“ nach Art. 50 AI Act? Reicht der vorgesehene Begrüßungstext?
2. Ist eine Live-Transkription mit Pufferung beim STT-Anbieter eine „Aufnahme“ nach §201 StGB? Reicht die informierte Weiterführung des Gesprächs?
3. Reicht die gestufte Art. 13-Info am Telefon?
4. Meldepflicht nach §5 TKG beim Eigenbau, mit und ohne Notfall-Durchstellen?
5. Haftungsausschluss für nicht erkannte Notfälle und falsch notierte Daten im Dienstvertrag.
