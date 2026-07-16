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
            conn.execute(
                "INSERT INTO reading_history (work_id, page_index) VALUES (?, ?)",
                (work_id, bounded_page),
            )

        return self.get_state(work_id)
