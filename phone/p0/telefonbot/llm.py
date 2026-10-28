"""Schnittstelle für ein Sprachmodell (erst ab Phase P1).

In P0 wird KEIN Modell aufgerufen. Die Engine kann aber ein Objekt mit .extrahiere(text, anfrage) -> dict
bekommen. Antwortet es nicht innerhalb von `timeout` Sekunden oder wirft einen Fehler, nutzt die Engine
für den Rest des Gesprächs nur noch die festen Regeln (Fallback, bau-spezifikation §2 „fallback.py“).
"""
import concurrent.futures

ERLAUBTE_FELDER = {"anliegen", "ort", "plz", "name", "rueckruf", "wunschtermin", "erreichbarkeit", "email", "details"}


def frage_llm(llm, text: str, anfrage: dict, timeout: float):
    ex = concurrent.futures.ThreadPoolExecutor(max_workers=1)
    try:
        fut = ex.submit(llm.extrahiere, text, dict(anfrage))
        out = fut.result(timeout=timeout)
        return {k: v for k, v in (out or {}).items() if k in ERLAUBTE_FELDER and v}
    finally:
        ex.shutdown(wait=False, cancel_futures=True)
