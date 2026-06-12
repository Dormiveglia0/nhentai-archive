from __future__ import annotations

import json
from typing import Any

from app.database import Database


class JobService:
    def __init__(self, db: Database):
        self.db = db

    def create(self, job_type: str, target: dict[str, Any]) -> dict[str, Any]:
        with self.db.connect() as conn:
            cursor = conn.execute(
                """
                INSERT INTO jobs (type, status, stage, target_json)
                VALUES (?, 'queued', 'queued', ?)
                """,
                (job_type, json.dumps(target, ensure_ascii=False)),
            )
            job_id = int(cursor.lastrowid)
        return self.get(job_id)

    def get(self, job_id: int) -> dict[str, Any]:
        row = self.db.fetchone("SELECT * FROM jobs WHERE id = ?", (job_id,))
        if not row:
            raise ValueError(f"Job {job_id} does not exist")
        return self._map(row)

    def list(self) -> list[dict[str, Any]]:
        rows = self.db.fetchall("SELECT * FROM jobs ORDER BY updated_at DESC LIMIT 100")
        return [self._map(row) for row in rows]

    def mark_running(self, job_id: int, stage: str, current: int = 0, total: int = 0) -> None:
        self.update_progress(job_id, "running", stage, current, total)

    def update_progress(self, job_id: int, status: str, stage: str, current: int, total: int) -> None:
        percent = round((current / total) * 100) if total else 0
        self.db.execute(
            """
            UPDATE jobs
            SET status = ?, stage = ?, progress_current = ?, progress_total = ?,
                progress_percent = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (status, stage, current, total, percent, job_id),
        )

    def complete(self, job_id: int, target_update: dict[str, Any] | None = None) -> None:
        job = self.get(job_id)
        target = job["target"]
        if target_update:
            target.update(target_update)
        self.db.execute(
            """
            UPDATE jobs
            SET status = 'completed', stage = 'completed', progress_current = 1,
                progress_total = 1, progress_percent = 100, target_json = ?,
                error = NULL, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (json.dumps(target, ensure_ascii=False), job_id),
        )

    def fail(self, job_id: int, message: str, retry_after: int | None = None) -> None:
        self.db.execute(
            """
            UPDATE jobs
            SET status = 'failed', stage = 'failed', error = ?, retry_after = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (message, retry_after, job_id),
        )

    def retry(self, job_id: int) -> dict[str, Any]:
        self.db.execute(
            """
            UPDATE jobs
            SET status = 'queued', stage = 'queued', error = NULL, retry_after = NULL,
                progress_current = 0, progress_total = 0, progress_percent = 0,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (job_id,),
        )
        return self.get(job_id)

    def _map(self, row: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": row["id"],
            "type": row["type"],
            "status": row["status"],
            "stage": row["stage"],
            "progress": {
                "current": row["progress_current"],
                "total": row["progress_total"],
                "percent": row["progress_percent"],
            },
            "target": json.loads(row["target_json"] or "{}"),
            "error": row["error"],
            "retry_after": row["retry_after"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }
