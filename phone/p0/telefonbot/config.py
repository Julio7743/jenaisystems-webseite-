"""Lädt und prüft die Telefon-Konfiguration eines Betriebs (JSON).

Die Spezifikation schlägt YAML + pydantic vor. P0 nutzt bewusst JSON und nur die Standardbibliothek,
damit nichts installiert werden muss. Die Datei clients/<id>/telefon.json erzeugt der Fragebogen-Generator.
"""
import json
import pathlib

PFLICHT = ["id", "firma", "oeffnungszeiten", "datenschutz_url", "leistungen", "nicht_im_angebot", "notfall"]
STANDARD = {
    "ort": "",
    "begruessung_zusatz": None,
    "gas_entstoerung_nummer": "[Gas-Entstörungsnummer – vom Betrieb eintragen und prüfen]",
    "rueckruf_zusage": "Das Team meldet sich so bald wie möglich.",
    "empfaenger_email": "",
    "ort_pflicht": True,   # Handwerk: ja; Laden/Café: meist nein
    "max_dauer_s": 360,
    "transkript_aufbewahrung_tage": 30,
}
NOTFALL_STANDARD = {
    # Diese Listen sind Mindestinhalt und lassen sich nicht abschalten (recht.md §5).
    "extern_112": ["feuer", "brennt", "rauch", "verletzt", "bewusstlos", "notarzt", "lebensgefahr"],
    "gas": ["gasgeruch", "nach gas", "gas riecht", "gasleitung"],
    "wasser": [],
    "betrieb_dringend": [],
}


class ConfigFehler(ValueError):
    pass


def pruefe(cfg: dict) -> dict:
    fehlend = [k for k in PFLICHT if k not in cfg]
    if fehlend:
        raise ConfigFehler("Fehlende Felder in der Telefon-Konfiguration: " + ", ".join(fehlend))
    out = {**STANDARD, **cfg}
    for k in ("leistungen", "nicht_im_angebot"):
        if not isinstance(out[k], list):
            raise ConfigFehler(f"{k} muss eine Liste sein")
        out[k] = [str(x).lower() for x in out[k]]
    notfall = {}
    for k, std in NOTFALL_STANDARD.items():
        eigene = [str(x).lower() for x in (cfg.get("notfall", {}).get(k) or [])]
        notfall[k] = sorted(set(std) | set(eigene)) if std else eigene
    out["notfall"] = notfall
    if int(out["max_dauer_s"]) > 600:
        raise ConfigFehler("max_dauer_s höchstens 600")
    if int(out["transkript_aufbewahrung_tage"]) > 30:
        raise ConfigFehler("Transkripte höchstens 30 Tage aufbewahren (recht.md §2)")
    return out


def lade(pfad) -> dict:
    return pruefe(json.loads(pathlib.Path(pfad).read_text("utf-8")))
