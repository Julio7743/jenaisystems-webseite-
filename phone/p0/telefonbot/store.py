"""SQLite-Speicher: Anrufe (Zusammenfassung) und Transkripte (nur Text, höchstens 30 Tage).
Audio wird nirgends gespeichert. Standardpfad nur, wenn ausdrücklich genutzt; Tests nehmen ':memory:'."""
import datetime as dt
import json
import sqlite3


class Store:
    def __init__(self, pfad=":memory:"):
        self.db = sqlite3.connect(pfad)
        self.db.executescript("""
            CREATE TABLE IF NOT EXISTS calls(id TEXT PRIMARY KEY, betrieb_id TEXT, start TEXT, anfrage TEXT);
            CREATE TABLE IF NOT EXISTS transcripts(call_id TEXT, created_at TEXT, json TEXT);
        """)

    def speichere(self, ev: dict, jetzt: dt.datetime = None):
        jetzt = jetzt or dt.datetime.now(dt.timezone.utc)
        self.db.execute("INSERT INTO calls VALUES (?,?,?,?)", (ev["call_id"], ev["betrieb_id"], ev["start"], json.dumps(ev["anfrage"], ensure_ascii=False)))
        self.db.execute("INSERT INTO transcripts VALUES (?,?,?)", (ev["call_id"], jetzt.isoformat(), json.dumps(ev["transkript"], ensure_ascii=False)))
        self.db.commit()

    def loesch_job(self, tage: int = 30, jetzt: dt.datetime = None) -> int:
        """Löscht Transkripte, die älter als `tage` sind. Täglich ausführen (z. B. per cron)."""
        jetzt = jetzt or dt.datetime.now(dt.timezone.utc)
        grenze = (jetzt - dt.timedelta(days=tage)).isoformat()
        n = self.db.execute("DELETE FROM transcripts WHERE created_at < ?", (grenze,)).rowcount
        self.db.commit()
        return n

    def anzahl_transkripte(self) -> int:
        return self.db.execute("SELECT COUNT(*) FROM transcripts").fetchone()[0]
