from __future__ import annotations

import json
import time
from typing import Any

from app.database import Database


class JobCancelled(Exception):
    pass


class JobActive(Exception):
    """Raised when an in-flight job is targeted by a history-only operation."""


ACTIVE_STATUSES = frozenset({"queued", "running", "paused"})


def _as_int(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.strip().lstrip("-").isdigit():
        return int(value)
    return None


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
            self._log_with_conn(conn, job_id, "info", "任务已创建")
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
        current_job = self.checkpoint(job_id)
        percent = round((current / total) * 100) if total else 0
        with self.db.connect() as conn:
            conn.execute(
                """
                UPDATE jobs
                SET status = ?, stage = ?, progress_current = ?, progress_total = ?,
                    progress_percent = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (status, stage, current, total, percent, job_id),
            )
            if current_job["stage"] != stage:
                self._log_with_conn(conn, job_id, "info", f"进入阶段: {stage}")

    def complete(self, job_id: int, target_update: dict[str, Any] | None = None) -> None:
        job = self.checkpoint(job_id)
        target = job["target"]
        if target_update:
            target.update(target_update)
        with self.db.connect() as conn:
            conn.execute(
                """
                UPDATE jobs
                SET status = 'completed', stage = 'completed', progress_current = 1,
                    progress_total = 1, progress_percent = 100, target_json = ?,
                    error = NULL, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (json.dumps(target, ensure_ascii=False), job_id),
            )
            self._log_with_conn(conn, job_id, "info", "任务已完成")

    def fail(self, job_id: int, message: str, retry_after: int | None = None) -> None:
        if self.get(job_id)["status"] == "cancelled":
            return
        with self.db.connect() as conn:
            conn.execute(
                """
                UPDATE jobs
                SET status = 'failed', stage = 'failed', error = ?, retry_after = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (message, retry_after, job_id),
            )
            self._log_with_conn(conn, job_id, "error", message)

    def retry(self, job_id: int) -> dict[str, Any]:
        with self.db.connect() as conn:
            conn.execute(
                """
                UPDATE jobs
                SET status = 'queued', stage = 'queued', error = NULL, retry_after = NULL,
                    progress_current = 0, progress_total = 0, progress_percent = 0,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (job_id,),
            )
            self._log_with_conn(conn, job_id, "info", "任务已重新加入队列")
        return self.get(job_id)

    def pause(self, job_id: int) -> dict[str, Any]:
        job = self.get(job_id)
        if job["status"] == "paused":
            return job
        if job["status"] not in {"queued", "running"}:
            return job
        target = job["target"] | {"_paused_from": job["status"]}
        with self.db.connect() as conn:
            conn.execute(
                """
                UPDATE jobs
                SET status = 'paused', target_json = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (json.dumps(target, ensure_ascii=False), job_id),
            )
            self._log_with_conn(conn, job_id, "info", "任务已暂停")
        return self.get(job_id)

    def resume(self, job_id: int) -> dict[str, Any]:
        job = self.get(job_id)
        if job["status"] != "paused":
            return job
        target = job["target"]
        next_status = target.pop("_paused_from", "running")
        if next_status not in {"queued", "running"}:
            next_status = "running"
        with self.db.connect() as conn:
            conn.execute(
                """
                UPDATE jobs
                SET status = ?, target_json = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (next_status, json.dumps(target, ensure_ascii=False), job_id),
            )
            self._log_with_conn(conn, job_id, "info", "任务已恢复")
        return self.get(job_id)

    def cancel(self, job_id: int) -> dict[str, Any]:
        job = self.get(job_id)
        if job["status"] in {"completed", "failed", "cancelled"}:
            return job
        with self.db.connect() as conn:
            conn.execute(
                """
                UPDATE jobs
                SET status = 'cancelled', stage = 'cancelled', error = NULL,
                    retry_after = NULL, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (job_id,),
            )
            self._log_with_conn(conn, job_id, "info", "任务已取消")
        return self.get(job_id)

    def delete(self, job_id: int) -> dict[str, Any]:
        job = self.get(job_id)
        if job["status"] in ACTIVE_STATUSES:
            raise JobActive("仅可删除已结束的任务，请先取消进行中的任务")
        with self.db.connect() as conn:
            conn.execute("DELETE FROM jobs WHERE id = ?", (job_id,))
        return {"deleted": job_id}

    def clear_finished(self) -> dict[str, Any]:
        with self.db.connect() as conn:
            cursor = conn.execute(
                "DELETE FROM jobs WHERE status IN ('completed', 'failed', 'cancelled')"
            )
            deleted = cursor.rowcount
        return {"deleted": deleted}

    def checkpoint(self, job_id: int) -> dict[str, Any]:
        while True:
            job = self.get(job_id)
            if job["status"] == "cancelled":
                raise JobCancelled(f"Job {job_id} cancelled")
            if job["status"] != "paused":
                return job
            time.sleep(0.2)

    def logs(self, job_id: int) -> dict[str, Any]:
        self.get(job_id)
        rows = self.db.fetchall(
            "SELECT * FROM job_logs WHERE job_id = ? ORDER BY id ASC",
            (job_id,),
        )
        return {"result": [self._map_log(row) for row in rows]}

    def _log_with_conn(self, conn, job_id: int, level: str, message: str) -> None:
        conn.execute(
            "INSERT INTO job_logs (job_id, level, message) VALUES (?, ?, ?)",
            (job_id, level, message),
        )

    def _map(self, row: dict[str, Any]) -> dict[str, Any]:
        target = json.loads(row["target_json"] or "{}")
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
            "target": target,
            "meta": self._resolve_meta(target),
            "error": row["error"],
            "retry_after": row["retry_after"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }

    def _resolve_meta(self, target: dict[str, Any]) -> dict[str, Any] | None:
        """Attach real cover/title metadata from local tables only (no network).

        Imported works expose a local cover; in-flight jobs reuse the cached
        gallery payload so the row can still show a real title and page count.
        """
        work_id = _as_int(target.get("work_id"))
        if work_id is not None:
            work = self.db.fetchone(
                "SELECT title, pretty_title, page_count, cover_path FROM works WHERE id = ?",
                (work_id,),
            )
            if work:
                return {
                    "title": work["pretty_title"] or work["title"],
                    "page_count": work["page_count"],
                    "cover_url": f"/api/works/{work_id}/cover" if work["cover_path"] else None,
                }

        gallery_id = _as_int(target.get("gallery_id"))
        if gallery_id is not None:
            cached = self.db.fetchone(
                "SELECT payload_json FROM remote_galleries WHERE gallery_id = ?",
                (gallery_id,),
            )
            if cached:
                payload = json.loads(cached["payload_json"] or "{}")
                title = payload.get("title") or {}
                if isinstance(title, dict):
                    title = title.get("pretty") or title.get("english") or title.get("japanese")
                return {
                    "title": title or None,
                    "page_count": payload.get("num_pages"),
                    "cover_url": None,
                }

        return None

    def _map_log(self, row: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": row["id"],
            "job_id": row["job_id"],
            "level": row["level"],
            "message": row["message"],
            "created_at": row["created_at"],
        }
