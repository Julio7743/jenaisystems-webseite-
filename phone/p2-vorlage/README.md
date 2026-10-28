# Vorlage P2: Echte Telefonnummer (NICHT eingerichtet)

**Nichts davon ist gebucht.** Jede Buchung braucht Julios ausdrückliche Freigabe. Rufnummern verlangen meist einen
Gewerbenachweis mit Adresse im Vorwahlbereich (siehe `../docs/kosten.md`).

## Weg A (Empfehlung für den Start, `../docs/technik.md`): Plattform auf den Betrieb
sipgate sona (Free) – Konto läuft **auf den Betrieb**, Julio richtet nur ein. Vorher AGB prüfen (gewerbliche Einrichtung
durch Dienstleister?) und klären, ob/wie lange Audio gespeichert wird (`../docs/recht.md` §2). Die Gesprächsregeln aus
`../docs/konzept.md` werden dort als Playbook eingetragen; diese Engine wird dann nicht gebraucht.

## Weg B (Eigenbau, wenn ≥ 3 Betriebe zahlen)
```
Anschluss des Betriebs ──Umleitung bei Nichtmelden (20–25 s) / zeitgesteuert──> Bot-Nummer
  ──SIP──> LiveKit SIP (eigener Server) ──> Agent (Pipecat, P1) ──> Engine aus p0/
```
- SIP-Eingang laut Spezifikation: sipgate trunking oder Telnyx (Preise in kosten.md, widersprüchliche Angaben – vor Buchung prüfen)
- LiveKit-Aufzeichnung (Egress) **aus**. Kein Audio auf die Platte, auch nicht in Logs.
- Konfiguration nach gewählter Nummer: `called_number` → `betrieb_id` → `clients/<betrieb>/telefon.json`
- Höchstens 2 gleichzeitige Anrufe pro Betrieb, sonst freundlich Rückrufnachricht oder SIP 486 Busy
- Benachrichtigung: E-Mail an den Betrieb, Sofortnachricht nur bei HOCH/Notfall (SMTP-/Telegram-Zugang nötig)
- Offene Rechtsfragen vor dem Start (Anwalt): `../docs/recht.md`, Abschnitt „Fragen für den Anwalt“

## Nicht vorgesehen
- Ausgehende Anrufe durch den Bot (niemals)
- Durchstellen an Dritte (erst nach Klärung TKG, recht.md §4)
- US-Plattformen wie Vapi/Retell/Twilio ohne Prüfung des Drittlandtransfers (recht.md §3)
