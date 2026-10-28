# Konzept KI-Telefon-Bot „Telefon-Assistent“ – Beispiel: Malerbetrieb Muster, Jena (fiktiv)
Stand: 24.10.2026

## 1. Ablauf
1. Ein Kunde ruft die normale Nummer des Betriebs an (z. B. 03641 …).
2. Geht nach **20–25 s** niemand ran, oder **außerhalb der Öffnungszeiten** (Zeitsteuerung der Telefonanlage), leitet der Anschluss des Betriebs auf die Bot-Nummer um. Das passiert über die Umleitung „bei Nichtmelden“ oder zeitgesteuert.
3. Der Bot meldet sich **mit KI-Hinweis**, fragt das Anliegen ab und prüft, ob ein **Notfall** vorliegt.
4. Er nimmt die Pflichtfelder auf und **liest sie zur Bestätigung vor**, vor allem Nummer und Adresse.
5. Er verabschiedet sich mit einer **realistischen Rückrufzusage**, z. B. „Wir melden uns am nächsten Werktag“, ohne festen Termin.
6. Spätestens 1 Minute nach Auflegen bekommt der Betrieb eine **E-Mail-Zusammenfassung**, bei Dringlichkeit „hoch“ zusätzlich SMS oder Telegram. Abends erscheint der Anruf in der Tageszusammenfassung des Anfrage-Assistenten.
7. **Kein Audio wird gespeichert.** Das Transkript wird nach 30 Tagen gelöscht.

## 2. Begrüßung (fester Text, mit KI-Hinweis, nicht abschaltbar)
> „Guten Tag, Sie sind beim Malerbetrieb Muster in Jena. Ich bin der **digitale Telefon-Assistent – eine künstliche Intelligenz**. Gerade ist leider niemand persönlich erreichbar. Ich notiere Ihr Anliegen schriftlich für das Team, **das Gespräch wird nicht aufgenommen**. Infos zum Datenschutz finden Sie auf maler-muster.de/datenschutz. Bei Lebensgefahr wählen Sie bitte sofort die 112. – Worum geht es bei Ihnen?“

Variante außerhalb der Zeiten: „… Unser Büro ist wieder ab Montag 7 Uhr besetzt …“

Wenn der Anrufer keine KI möchte: „Kein Problem. Sie können eine kurze Nachricht hinterlassen, die ich wörtlich notiere, oder es zu unseren Bürozeiten Montag bis Freitag von 7 bis 16 Uhr wieder versuchen.“ Dann nur Name und Rückrufnummer aufnehmen, oder auflegen, wenn er das möchte.

## 3. Fragen (Reihenfolge flexibel, die KI fragt nur nach, was fehlt)
| # | Feld | Beispiel-Frage | Pflicht |
|---|---|---|---|
| 1 | anliegen | „Worum geht es – streichen, tapezieren, Fassade, Lackieren oder etwas anderes?“ | ja |
| 2 | notfall-check | wird aus dem Anliegen erkannt, bei Unsicherheit: „Ist das dringend, gibt es z. B. einen Wasserschaden oder eine Gefahr?“ | ja |
| 3 | details | „Um welche Räume oder Flächen geht es ungefähr?“ (max. 2 Rückfragen) | nein |
| 4 | ort | „In welchem Ort bzw. welcher Straße ist das Objekt?“ | ja (PLZ/Ort reicht) |
| 5 | name | „Wie ist Ihr Name?“ | ja |
| 6 | rueckruf | „Unter welcher Nummer erreichen wir Sie am besten?“, dann **Ziffern einzeln wiederholen** | ja |
| 7 | erreichbarkeit | „Wann passt ein Rückruf?“ | nein |
| 8 | wunschtermin | „Gibt es einen Wunschzeitraum für die Arbeiten?“ | nein |
| 9 | email | nur wenn der Anrufer es möchte | nein |

Am Ende: „Ich fasse zusammen: … Stimmt das so?“ Dann gibt es eine Korrekturschleife (max. 2).

## 4. Leitplanken
- **Keine Preise, keine Terminzusagen, keine Garantien, keine Fachberatung.** Antwort: „Das klärt der Meister gern persönlich beim Rückruf.“
- Leistungen außerhalb des Angebots (z. B. Laminat): „Das bieten wir leider nicht an.“ Trotzdem aufnehmen, wenn der Anrufer es möchte.
- Keine Bankdaten, Geburtsdaten oder Gesundheitsdaten abfragen. Wenn der Anrufer so etwas nennt, wird es **nicht** in die Zusammenfassung übernommen.
- Maximale Gesprächsdauer 6 Min. Danach höflich abschließen.
- Bei Beleidigungen oder Spam nach einer Warnung höflich beenden, Markierung „Spam“.
- Der Bot ruft **nie** selbst an.

## 5. Notfall-Regeln
| Erkennung (Beispiele) | Reaktion des Bots | Benachrichtigung |
|---|---|---|
| Lebensgefahr, Feuer, Verletzte, „Notarzt“ | „Bitte legen Sie sofort auf und wählen Sie die **112**.“ Gespräch beenden | E-Mail „Notfall-Hinweis gegeben“ |
| Gasgeruch | „Bitte verlassen Sie das Gebäude, betätigen Sie keine Schalter und rufen Sie von draußen die 112 oder den Gas-Entstörungsdienst an.“ (Nummer aus der Konfiguration, vom Betrieb geprüft) | wie oben |
| Wasserschaden / Rohrbruch | „Drehen Sie wenn möglich den Hauptwasserhahn zu. Für einen Rohrbruch ist ein Installateur-Notdienst zuständig, ein Malerbetrieb ist hier nicht der richtige Ansprechpartner.“ Dann aufnehmen | Dringlichkeit „hoch“ |
| Dringender Fall des Betriebs selbst (z. B. Baustelle offen, Gerüst, Folgeschaden nach eigenen Arbeiten) | Wenn `notdienst.aktiv` gilt und die Zeit im Notdienstfenster liegt: „Ich gebe das sofort an unseren Bereitschaftsdienst weiter.“ | sofort SMS/Telegram an die Notdienst-Nummer + E-Mail. Durchstellen nur nach Freigabe durch den Anwalt (TKG), siehe recht.md |
| alles andere | normale Aufnahme | E-Mail, Tageszusammenfassung |

## 6. Zusammenfassungsformat (E-Mail, Betreff + Text, zusätzlich JSON für das System)
**Betreff:** `[Telefon] HOCH – Wasserfleck Decke nach Rohrbruch – Fr. Beispiel, 07745 Jena – Rückruf 0176…`

```
Neuer Anruf über den Telefon-Assistenten
Zeit: Fr, 24.10.2026, 17:42 Uhr (Dauer 2:31 Min.)
Dringlichkeit: HOCH (Folgeschaden nach Rohrbruch)
Anliegen: Decke im Bad nach Wasserschaden streichen, Fleck ca. 1 m²
Ort: Musterweg 5, 07745 Jena
Name: Erika Beispiel
Rückruf: 0176 7654321 (bestätigt), am besten werktags ab 16 Uhr
Wunschzeitraum: nächste 2 Wochen
Hinweise des Bots: Installateur war schon da, Decke muss erst trocknen
Offen: Trocknungszeit, Größe genau
Notfall-Hinweis gegeben: nein
---
Kein Audio gespeichert. Transkript bis 23.11.2026 im Portal.
```

## 7. Konfiguration pro Betrieb (Kurzfassung, vollständig in bau-spezifikation.md)
- Firmenname
- Begrüßungsvarianten
- Öffnungszeiten
- Leistungen ja/nein
- Notdienst-Fenster und Nummer
- Gas-Entstörungsnummer
- E-Mail-Empfänger
- Datenschutz-URL
- Stimme
- maximale Dauer
