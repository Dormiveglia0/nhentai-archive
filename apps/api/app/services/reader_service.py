from __future__ import annotations

from typing import Any

from app.database import Database


class ReaderService:
    def __init__(self, db: Database):
        self.db = db

    def get_state(self, work_id: int) -> dict[str, Any]:
        state = self.db.fetchone("SELECT * FROM reader_progress WHERE work_id = ?", (work_id,))
        if state:
            state["completed"] = bool(state["completed"])
            return state

        work = self.db.fetchone("SELECT page_count FROM works WHERE id = ?", (work_id,))
        page_count = int(work["page_count"]) if work else 0
        return {
            "work_id": work_id,
            "page_index": 1 if page_count else 0,
            "page_count": page_count,
            "progress_percent": 0,
            "completed": False,
            "last_read_at": None,
        }

    def update_state(self, work_id: int, page_index: int, completed: bool = False) -> dict[str, Any]:
        work = self.db.fetchone("SELECT page_count FROM works WHERE id = ?", (work_id,))
        if not work:
            raise ValueError(f"Work {work_id} does not exist")
        page_count = int(work["page_count"])
        bounded_page = max(1, min(page_index, page_count)) if page_count else 0
        progress_percent = round((bounded_page / page_count) * 100) if page_count else 0
        is_completed = completed or (page_count > 0 and bounded_page >= page_count)

        with self.db.connect() as conn:
            conn.execute(
                """
                INSERT INTO reader_progress (
                  work_id, page_index, page_count, progress_percent, completed, last_read_at
                )
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(work_id) DO UPDATE SET
                  page_index=excluded.page_index,
                  page_count=excluded.page_count,
                  progress_percent=excluded.progress_percent,
                  completed=excluded.completed,
                  last_read_at=CURRENT_TIMESTAMP
                """,
                (work_id, bounded_page, page_count, progress_percent, int(is_completed)),
            )
        return self.get_state(work_id)

    def start_session(self, work_id: int, client_key: str, page_index: int) -> dict[str, Any]:
        work = self.db.fetchone("SELECT page_count FROM works WHERE id = ?", (work_id,))
        if not work:
            raise ValueError(f"Work {work_id} does not exist")
        page_count = int(work["page_count"])
        bounded_page = max(1, min(page_index, page_count)) if page_count else 0

        with self.db.connect() as conn:
            inserted = conn.execute(
                """
                INSERT OR IGNORE INTO reading_sessions (client_key, work_id, last_page_index)
                VALUES (?, ?, ?)
                """,
                (client_key, work_id, bounded_page),
            ).rowcount
            row = conn.execute(
                "SELECT * FROM reading_sessions WHERE client_key = ?",
                (client_key,),
            ).fetchone()
            if row is None or int(row["work_id"]) != work_id:
                raise ValueError("Reading session key belongs to another work")
            if inserted:
                conn.execute(
                    "INSERT INTO reading_history (work_id, page_index) VALUES (?, ?)",
                    (work_id, bounded_page),
                )
            return dict(row)

    def update_session(
        self,
        work_id: int,
        session_id: int,
        duration_seconds: int,
        page_index: int,
        finished: bool = False,
    ) -> dict[str, Any]:
        work = self.db.fetchone("SELECT page_count FROM works WHERE id = ?", (work_id,))
        if not work:
            raise ValueError(f"Work {work_id} does not exist")
        page_count = int(work["page_count"])
        bounded_page = max(1, min(page_index, page_count)) if page_count else 0

        with self.db.connect() as conn:
            updated = conn.execute(
                """
                UPDATE reading_sessions
                SET duration_seconds = MAX(duration_seconds, ?),
                    last_page_index = ?,
                    ended_at = CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE ended_at END,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND work_id = ?
                """,
                (duration_seconds, bounded_page, int(finished), session_id, work_id),
            ).rowcount
            if not updated:
                raise ValueError(f"Reading session {session_id} does not exist")
            row = conn.execute("SELECT * FROM reading_sessions WHERE id = ?", (session_id,)).fetchone()
            return dict(row)
