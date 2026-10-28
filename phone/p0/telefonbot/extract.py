"""Regelbasierte Extraktion: Telefonnummern, PLZ, Namen, Maskierung sensibler Daten."""
import re

PHONE = re.compile(r"(\+?\d[\d\s/\-]{6,}\d)")
PLZ = re.compile(r"\b(\d{5})\b")
IBAN = re.compile(r"\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}(?:\s?[A-Z0-9]{1,3})?\b")
SENSIBEL_WORTE = re.compile(
    r"\b(iban|kontonummer|bankverbindung|geburtsdatum|geboren am|diagnose\w*|krankheit\w*|erkrankt\w*|diabetes|krebs|"
    r"schwanger\w*|medikament\w*|depression\w*|therapie\w*)\b", re.I)
DATUM = re.compile(r"\b\d{1,2}\.\d{1,2}\.(19|20)\d{2}\b")
NAME_PHRASE = re.compile(r"(?:ich bin|mein name ist|ich heiße|hier ist|hier spricht)\s+([A-ZÄÖÜ][\wäöüß\-]+(?:\s[A-ZÄÖÜ][\wäöüß\-]+)?)", re.I)
NUR_NAME = re.compile(r"(?:(?:Frau|Herr)\s+)?[A-ZÄÖÜ][\wäöüß\-]+(?:\s[A-ZÄÖÜ][\wäöüß\-]+){0,2}")
ORT_PHRASE = re.compile(r"\b(?i:in|aus)\s+([A-ZÄÖÜ][\wäöüß\-]+(?:\s[A-ZÄÖÜ][\wäöüß\-]+)?)")
KEIN_NAME = {"ja", "nein", "genau", "stimmt", "egal", "okay", "hallo", "danke"}


def maskiere(text: str) -> str:
    """Entfernt IBAN, Bank-/Geburts-/Gesundheitsangaben, bevor irgendetwas notiert wird (konzept.md §4)."""
    t = IBAN.sub("[entfernt]", text)
    t = DATUM.sub("[entfernt]", t)
    t = SENSIBEL_WORTE.sub("[entfernt]", t)
    return t


def norm_phone(s: str) -> str:
    d = re.sub(r"[^\d+]", "", s)
    if d.startswith("00"):
        d = "+" + d[2:]
    elif d.startswith("0"):
        d = "+49" + d[1:]
    return d


def finde_nummer(text: str):
    m = PHONE.search(text.replace("[entfernt]", ""))
    if not m:
        return None
    n = norm_phone(m.group(1))
    return n if re.fullmatch(r"\+[1-9]\d{6,14}", n) else None


def vorlesen(e164: str) -> str:
    """Nummer zum Vorlesen: Vorwahl, dann Zweiergruppen (bau-spezifikation §4)."""
    d = e164.replace("+49", "0", 1) if e164.startswith("+49") else e164
    vw = 4 if d.startswith("01") else (5 if d.startswith("03") else 4)
    r = d[vw:]
    return d[:vw] + " " + " ".join(r[i:i + 2] for i in range(0, len(r), 2))


def finde_plz(text: str):
    m = PLZ.search(text)
    return m.group(1) if m else None


def finde_name(text: str, gefragt: bool):
    m = NAME_PHRASE.search(text)
    if m:
        return m.group(1)
    t = text.strip().rstrip(".!")
    if gefragt and NUR_NAME.fullmatch(t) and t.lower() not in KEIN_NAME and not re.search(r"\d", t):
        return t
    return None


def finde_ort(text: str, gefragt: bool):
    m = ORT_PHRASE.search(text)
    if m:
        return m.group(1)
    t = re.sub(r"\b\d{5}\b", "", text).strip(" ,.")
    if gefragt and t and re.fullmatch(r"[A-ZÄÖÜ][\wäöüß\-]+(?:[\s\-][A-ZÄÖÜ][\wäöüß\-]+)?", t):
        return t
    return None


def hat(text: str, worte) -> bool:
    t = text.lower()
    return any(w and w in t for w in worte)


def ja(text: str) -> bool:
    t = text.lower()
    return bool(re.search(r"\b(ja|jawohl|stimmt|genau|richtig|korrekt|passt)\b", t)) and not re.search(r"\b(nein|nicht|falsch)\b", t)


def nein(text: str) -> bool:
    return bool(re.search(r"\b(nein|nö|falsch|nicht richtig|stimmt nicht)\b", text.lower()))
