"""Notfall-Klassifikator: regelbasiert zuerst, die Regel gewinnt immer (bau-spezifikation §2)."""
import re


def hat_wort(text: str, worte) -> bool:
    """Treffer nur am Wortanfang, damit z. B. „brauche“ nicht als „rauch“ zählt."""
    t = text.lower()
    return any(w and re.search(r"\b" + re.escape(w), t) for w in worte)

REIHENFOLGE = ("extern_112", "gas", "wasser", "betrieb_dringend")


def klassifiziere(text: str, cfg: dict):
    for art in REIHENFOLGE:
        if hat_wort(text, cfg["notfall"].get(art, [])):
            return art
    return None


def antwort(art: str, cfg: dict) -> str:
    if art == "extern_112":
        return "Bitte legen Sie sofort auf und wählen Sie die 112. Ich gebe dem Team Bescheid, dass Sie angerufen haben."
    if art == "gas":
        return ("Bitte verlassen Sie sofort das Gebäude, betätigen Sie keine Schalter und rufen Sie von draußen "
                f"die 112 oder den Gas-Entstörungsdienst unter {cfg['gas_entstoerung_nummer']} an.")
    if art == "wasser":
        return ("Wenn noch Wasser läuft: Drehen Sie bitte den Hauptwasserhahn zu. Für den Rohrbruch selbst ist ein "
                "Installateur-Notdienst zuständig. Ich notiere Ihr Anliegen als dringend. ")
    if art == "betrieb_dringend":
        return "Das klingt dringend, ich markiere es für das Team als dringend. "
    return ""
