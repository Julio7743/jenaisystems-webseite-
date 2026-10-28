"""Zusammenfassung (E-Mail-Text nach konzept.md §6), Event-JSON (bau-spezifikation §3.2) und Benachrichtigungsplan.
In P0 wird nichts versendet: Die Texte werden nur erzeugt (und auf Wunsch in einen lokalen Ordner geschrieben).
"""
import datetime as dt
import json
import uuid

from .extract import vorlesen

DR = {"normal": "normal", "hoch": "HOCH", "notfall_extern": "NOTFALL – 112/Entstörung empfohlen"}


def anfrage(bot) -> dict:
    a = bot.a
    return {
        "anliegen": a["anliegen"] or "",
        "leistung": a["leistung"] or ("sonstiges" if a["anliegen"] else None),
        "details": a["details"],
        "ort": {"strasse": None, "plz": a["plz"], "ort": a["ort"]},
        "name": a["name"] or "",
        "rueckruf": a["rueckruf"] or "",
        "rueckruf_bestaetigt": a["rueckruf_bestaetigt"],
        "erreichbarkeit": a["erreichbarkeit"],
        "wunschtermin": a["wunschtermin"],
        "email": a["email"],
        "dringlichkeit": a["dringlichkeit"],
        "notfall_hinweis_gegeben": a["notfall_hinweis_gegeben"],
        "ki_abgelehnt": a["ki_abgelehnt"],
        "offen": list(a["offen"]),
        "spam": a["spam"],
    }


def event(bot, start: dt.datetime = None) -> dict:
    start = start or dt.datetime.now().astimezone()
    return {
        "betrieb_id": bot.c["id"],
        "call_id": str(uuid.uuid4()),
        "start": start.isoformat(timespec="seconds"),
        "dauer_s": int(bot.log[-1][2]) if bot.log else 0,
        "anrufer_nummer": bot.anrufer_nummer,
        "ende_grund": bot.ende_grund,
        "fallback_genutzt": bot.fallback_genutzt,
        "anfrage": anfrage(bot),
        "transkript": [{"rolle": r, "text": t, "t": s} for r, t, s in bot.log],
    }


def benachrichtigungen(bot) -> list:
    """E-Mail immer; Telegram/SMS nur bei HOCH oder Notfall und nie bei Spam."""
    kanaele = ["email"]
    if bot.a["dringlichkeit"] in ("hoch", "notfall_extern") and not bot.a["spam"]:
        kanaele.append("telegram")
    return kanaele


def email_text(bot, start: dt.datetime = None) -> str:
    a, start = bot.a, start or dt.datetime.now().astimezone()
    dr = DR[a["dringlichkeit"]]
    if a["spam"]:
        dr += " (als Spam/Beleidigung beendet)"
    nummer = a["rueckruf"] or bot.anrufer_nummer
    rueckruf = "–"
    if nummer:
        rueckruf = vorlesen(nummer) + (" (bestätigt)" if a["rueckruf_bestaetigt"] else
                                       " (Anrufernummer, nicht bestätigt)" if not a["rueckruf"] else " (nicht bestätigt)")
    betreff = f"[Telefon] {DR[a['dringlichkeit']].split(' ')[0]} – {(a['anliegen'] or 'Anruf ohne Anliegen')[:50]} – {a['name'] or 'ohne Namen'}"
    dauer = int(bot.log[-1][2]) if bot.log else 0
    tage = bot.c["transkript_aufbewahrung_tage"]
    z = [f"Betreff: {betreff}", "",
         "Neuer Anruf über den Telefon-Assistenten",
         f"Zeit: {start:%d.%m.%Y, %H:%M} Uhr (Dauer {dauer // 60}:{dauer % 60:02d} Min.)",
         f"Dringlichkeit: {dr}",
         f"Anliegen: {a['anliegen'] or '–'}",
         "Ort: " + (" ".join(x for x in (a["ort"], a["plz"]) if x) or "–"),
         f"Name: {a['name'] or '–'}",
         f"Rückruf: {rueckruf}",
         f"Wunschzeitraum: {a['wunschtermin'] or '–'}",
         f"Nicht im Angebot: {'ja' if a['nicht_im_angebot'] else 'nein'}",
         f"KI abgelehnt: {'ja' if a['ki_abgelehnt'] else 'nein'}",
         f"Notfall-Hinweis gegeben: {'ja' if a['notfall_hinweis_gegeben'] else 'nein'}",
         f"Gesprächsende: {bot.ende_grund or 'aufgelegt'}",
         "---",
         f"Kein Audio gespeichert. Transkript wird nach {tage} Tagen gelöscht. Der Assistent ruft nie selbst zurück."]
    return "\n".join(z)


def als_json(bot, start=None) -> str:
    return json.dumps(event(bot, start), ensure_ascii=False, indent=2)
