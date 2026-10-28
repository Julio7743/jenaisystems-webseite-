# Vorlage P1: Sprache am eigenen Rechner (NICHT eingerichtet)

Ziel laut `../docs/bau-spezifikation.md`: Pipecat-Pipeline mit Mikrofon/Lautsprecher am Rechner.
Spracherkennung, Sprachausgabe und Sprachmodell laufen über eine API. **Es wurde kein Konto angelegt und nichts gekauft.**

## Was P1 braucht (erst nach Julios Freigabe)
- API-Schlüssel für das Sprachmodell (Spezifikation: IONOS AI Model Hub mit Mistral Small, OpenAI-kompatibel)
- API-Schlüssel für Spracherkennung und Sprachausgabe (Spezifikation: Mistral Voxtral)
- Preise: siehe `../docs/kosten.md` (Stand 24.10.2026) – **vor Abschluss auf der Anbieterseite prüfen**

## Wie es an P0 andockt
- Die Gesprächslogik bleibt `p0/telefonbot/engine.py`. Notfallregeln, KI-Hinweis und Maskierung bleiben regelbasiert und haben Vorrang.
- Ein Sprachmodell wird als Objekt mit `extrahiere(text, anfrage) -> dict` an `Bot(..., llm=...)` übergeben
  (siehe `p0/telefonbot/llm.py`). Antwortet es nicht in 3 s, nutzt der Bot feste Fragen (Test T12).
- System-Prompt: `clients/<kunde>/telefon-prompt.md` (vom Fragebogen erzeugt). Werkzeuge laut Spezifikation:
  `update_anfrage(felder)`, `notfall_melden(art)`, `gespraech_beenden(grund)`. Temperatur 0,3, max. 120 Token pro Antwort.
- Begrüßung, Notfallsätze und Abschied dürfen als Bot-Audio vorab erzeugt werden. **Anrufer-Audio wird nie gespeichert.**

## Umgebungsvariablen
Siehe `env.example`. Echte Werte nur in `.env` (wird nicht eingecheckt, `chmod 600`).

## Abnahme in P1
- P1-L1: Antwortbeginn Median ≤ 1,5 s, p90 ≤ 2,5 s über 20 Gesprächsrunden (messen und protokollieren)
- P1-Q1: 10 Testsätze mit Jenaer Straßennamen/PLZ, mindestens 9 richtig erkannt
