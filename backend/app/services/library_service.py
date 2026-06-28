from __future__ import annotations

from typing import Any

from app.database import Database


# Whitelisted sort keys -> SQL ORDER BY fragments. Anything else falls back to recent_updated.
SORT_ORDERS = {
    "recent_updated": "w.updated_at DESC, w.id DESC",
    "recent_added": "w.created_at DESC, w.id DESC",
    "recent_read": "rp.last_read_at DESC, w.updated_at DESC",
    "title": "w.title COLLATE NOCASE ASC, w.id ASC",
    "pages_desc": "w.page_count DESC, w.id DESC",
    "pages_asc": "w.page_count ASC, w.id DESC",
}

READ_STATUSES = {"all", "unread", "reading", "completed"}
SOURCES = {"all", "remote", "local"}

# Card metadata only needs a handful of tag types; the rest stay available through the
# governance/dictionary modules. Order also drives card display priority.
CARD_TAG_TYPES = ("artist", "group", "parody", "character", "language", "tag", "category")

WORK_COLUMNS = """
  w.id, w.remote, w.remote_gallery_id, w.media_id, w.title, w.title_japanese,
  w.pretty_title, w.source, w.language, w.page_count, w.cover_path,
  w.created_at, w.updated_at,
  COALESCE(rp.page_index, 0) AS reader_page_index,
  COALESCE(rp.progress_percent, 0) AS progress_percent,
  COALESCE(rp.completed, 0) AS completed,
  rp.last_read_at AS last_read_at,
  COALESCE(f.size_bytes, 0) AS size_bytes,
  (SELECT COUNT(*) FROM work_tags wt2 WHERE wt2.work_id = w.id) AS tag_count
"""

WORK_JOINS = """
FROM works w
LEFT JOIN reader_progress rp ON rp.work_id = w.id
LEFT JOIN (
  SELECT work_id, SUM(size_bytes) AS size_bytes
  FROM work_files
  WHERE kind = 'source_cbz'
  GROUP BY work_id
) f ON f.work_id = w.id
"""


class LibraryService:
    """Real local-library reads backed only by SQLite (works, reader_progress, work_files, work_tags)."""

    def __init__(self, db: Database):
        self.db = db

    def summary(self) -> dict[str, Any]:
        totals = self.db.fetchone(
            """
            SELECT
              COUNT(*) AS total,
              COALESCE(SUM(CASE WHEN rp.progress_percent > 0 AND rp.completed = 0 THEN 1 ELSE 0 END), 0) AS reading,
              COALESCE(SUM(CASE WHEN rp.completed = 1 THEN 1 ELSE 0 END), 0) AS completed,
              COALESCE(SUM(w.page_count), 0) AS pages
            FROM works w
            LEFT JOIN reader_progress rp ON rp.work_id = w.id
            """
        ) or {"total": 0, "reading": 0, "completed": 0, "pages": 0}

        total = int(totals["total"])
        reading = int(totals["reading"])
        completed = int(totals["completed"])
        unread = max(0, total - reading - completed)

        size_row = self.db.fetchone(
            "SELECT COALESCE(SUM(size_bytes), 0) AS bytes FROM work_files WHERE kind = 'source_cbz'"
        )
        total_size_bytes = int(size_row["bytes"]) if size_row else 0

        untagged_row = self.db.fetchone(
            """
            SELECT COUNT(*) AS value
            FROM works w
            WHERE NOT EXISTS (SELECT 1 FROM work_tags wt WHERE wt.work_id = w.id)
            """
        )
        untagged = int(untagged_row["value"]) if untagged_row else 0

        sources = {"remote": 0, "local": 0}
        for row in self.db.fetchall("SELECT source, COUNT(*) AS value FROM works GROUP BY source"):
            sources[str(row["source"])] = int(row["value"])

        languages = self.db.fetchall(
            """
            SELECT
              COALESCE(wt.remote_slug, wt.remote_name) AS value,
              MAX(COALESCE(d.zh_name, wt.remote_name, wt.remote_slug)) AS label,
              COUNT(DISTINCT wt.work_id) AS count
            FROM work_tags wt
            LEFT JOIN local_tag_dictionary d ON d.id = wt.dictionary_id AND d.ignored = 0
            WHERE wt.tag_type = 'language' AND COALESCE(wt.remote_slug, wt.remote_name) IS NOT NULL
            GROUP BY value
            ORDER BY count DESC
            """
        )

        return {
            "total": total,
            "reading": reading,
            "completed": completed,
            "unread": unread,
            "untagged": untagged,
            "total_pages": int(totals["pages"]),
            "total_size_bytes": total_size_bytes,
            "sources": sources,
            "languages": [
                {"value": str(row["value"]), "label": str(row["label"] or row["value"]), "count": int(row["count"])}
                for row in languages
            ],
        }

    def search(
        self,
        q: str = "",
        page: int = 1,
        per_page: int = 24,
        sort: str = "recent_updated",
        read_status: str = "all",
        source: str = "all",
        language: str = "all",
        tag_ids: list[int] | None = None,
    ) -> dict[str, Any]:
        page = max(1, int(page))
        per_page = max(1, min(int(per_page), 100))
        order_by = SORT_ORDERS.get(sort, SORT_ORDERS["recent_updated"])
        read_status = read_status if read_status in READ_STATUSES else "all"
        source = source if source in SOURCES else "all"
        tag_ids = [int(tid) for tid in (tag_ids or []) if tid is not None]

        where, params = self._build_filters(q, read_status, source, language, tag_ids)
        where_sql = " AND ".join(where) if where else "1 = 1"

        total = int(
            self.db.fetchone(f"SELECT COUNT(*) AS value {WORK_JOINS} WHERE {where_sql}", params)["value"]
        )
        num_pages = max(1, (total + per_page - 1) // per_page)
        offset = (page - 1) * per_page

        rows = self.db.fetchall(
            f"""
            SELECT {WORK_COLUMNS}
            {WORK_JOINS}
            WHERE {where_sql}
            ORDER BY {order_by}
            LIMIT ? OFFSET ?
            """,
            [*params, per_page, offset],
        )
        result = self._finalize(rows)
        return {
            "result": result,
            "total": total,
            "page": page,
            "per_page": per_page,
            "num_pages": num_pages,
        }

    def recent_added(self, limit: int = 12) -> dict[str, Any]:
        return {"result": self._top("1 = 1", [], "w.created_at DESC, w.id DESC", limit)}

    def recent_read(self, limit: int = 12) -> dict[str, Any]:
        return {"result": self._top("rp.last_read_at IS NOT NULL", [], "rp.last_read_at DESC", limit)}

    def continue_reading(self, limit: int = 12) -> dict[str, Any]:
        return {
            "result": self._top(
                "rp.progress_percent > 0 AND rp.completed = 0",
                [],
                "rp.last_read_at DESC",
                limit,
            )
        }

    def tag_filters(self, q: str = "", limit: int = 40) -> dict[str, Any]:
        limit = max(1, min(int(limit), 200))
        where = ["wt.remote_tag_id IS NOT NULL", "(wt.tag_type IS NULL OR wt.tag_type != 'language')"]
        params: list[Any] = []
        cleaned = q.strip().lower()
        if cleaned:
            like = f"%{cleaned}%"
            where.append(
                "(lower(COALESCE(wt.remote_name, '')) LIKE ?"
                " OR lower(COALESCE(wt.remote_slug, '')) LIKE ?"
                " OR lower(COALESCE(d.zh_name, '')) LIKE ?)"
            )
            params.extend([like, like, like])
        rows = self.db.fetchall(
            f"""
            SELECT
              wt.remote_tag_id AS id,
              MAX(wt.tag_type) AS type,
              MAX(wt.remote_name) AS name,
              MAX(wt.remote_slug) AS slug,
              MAX(d.zh_name) AS display_zh,
              MAX(d.id) AS dictionary_id,
              COUNT(DISTINCT wt.work_id) AS count
            FROM work_tags wt
            LEFT JOIN local_tag_dictionary d ON d.id = wt.dictionary_id AND d.ignored = 0
            WHERE {' AND '.join(where)}
            GROUP BY wt.remote_tag_id
            ORDER BY count DESC, type ASC
            LIMIT ?
            """,
            [*params, limit],
        )
        return {
            "result": [
                {
                    "id": int(row["id"]),
                    "type": row["type"],
                    "name": row["name"],
                    "slug": row["slug"],
                    "display": row["display_zh"] or row["name"] or row["slug"] or str(row["id"]),
                    "dictionary_id": row["dictionary_id"],
                    "count": int(row["count"]),
                }
                for row in rows
            ]
        }

    def reading_history(self, page: int = 1, per_page: int = 30) -> dict[str, Any]:
        page = max(1, int(page))
        per_page = max(1, min(int(per_page), 100))
        total = int(
            self.db.fetchone(
                "SELECT COUNT(*) AS value FROM ("
                " SELECT 1 FROM reading_history GROUP BY work_id, date(opened_at)"
                ")"
            )["value"]
        )
        num_pages = max(1, (total + per_page - 1) // per_page)
        offset = (page - 1) * per_page
        rows = self.db.fetchall(
            """
            SELECT
              h.work_id AS id,
              date(h.opened_at) AS date,
              MAX(h.opened_at) AS last_opened_at,
              COUNT(*) AS read_events,
              MAX(h.page_index) AS furthest_page,
              w.title, w.title_japanese, w.pretty_title, w.source,
              w.remote_gallery_id, w.page_count, w.cover_path,
              COALESCE(rp.progress_percent, 0) AS progress_percent,
              COALESCE(rp.completed, 0) AS completed
            FROM reading_history h
            JOIN works w ON w.id = h.work_id
            LEFT JOIN reader_progress rp ON rp.work_id = h.work_id
            GROUP BY h.work_id, date(h.opened_at)
            ORDER BY last_opened_at DESC, h.work_id DESC
            LIMIT ? OFFSET ?
            """,
            [per_page, offset],
        )
        result = [
            {
                "id": int(row["id"]),
                "title": row["title"],
                "title_japanese": row["title_japanese"],
                "pretty_title": row["pretty_title"],
                "source": row["source"],
                "remote_gallery_id": row["remote_gallery_id"],
                "page_count": int(row["page_count"] or 0),
                "cover_path": row["cover_path"],
                "date": row["date"],
                "last_opened_at": row["last_opened_at"],
                "read_events": int(row["read_events"]),
                "furthest_page": int(row["furthest_page"] or 0),
                "progress_percent": int(row["progress_percent"]),
                "completed": bool(row["completed"]),
            }
            for row in rows
        ]
        return {"result": result, "total": total, "page": page, "per_page": per_page, "num_pages": num_pages}

    # -- internals -------------------------------------------------------

    def _build_filters(
        self, q: str, read_status: str, source: str, language: str, tag_ids: list[int]
    ) -> tuple[list[str], list[Any]]:
        where: list[str] = []
        params: list[Any] = []

        cleaned = q.strip().lower()
        if cleaned:
            like = f"%{cleaned}%"
            where.append(
                "("
                "lower(w.title) LIKE ?"
                " OR lower(COALESCE(w.title_japanese, '')) LIKE ?"
                " OR lower(COALESCE(w.pretty_title, '')) LIKE ?"
                " OR CAST(w.remote_gallery_id AS TEXT) = ?"
                " OR EXISTS ("
                "   SELECT 1 FROM work_tags wq"
                "   LEFT JOIN local_tag_dictionary dq ON dq.id = wq.dictionary_id"
                "   WHERE wq.work_id = w.id AND ("
                "     lower(COALESCE(wq.remote_name, '')) LIKE ?"
                "     OR lower(COALESCE(wq.remote_slug, '')) LIKE ?"
                "     OR lower(COALESCE(dq.zh_name, '')) LIKE ?"
                "   )"
                " )"
                ")"
            )
            params.extend([like, like, like, cleaned, like, like, like])

        if source in {"remote", "local"}:
            where.append("w.source = ?")
            params.append(source)

        if read_status == "unread":
            where.append("(rp.work_id IS NULL OR (rp.progress_percent = 0 AND rp.completed = 0))")
        elif read_status == "reading":
            where.append("(rp.progress_percent > 0 AND rp.completed = 0)")
        elif read_status == "completed":
            where.append("rp.completed = 1")

        if language and language != "all":
            where.append(
                "EXISTS ("
                " SELECT 1 FROM work_tags wl"
                " WHERE wl.work_id = w.id AND wl.tag_type = 'language'"
                " AND (wl.remote_slug = ? OR wl.remote_name = ?)"
                ")"
            )
            params.extend([language, language])

        if tag_ids:
            placeholders = ", ".join("?" for _ in tag_ids)
            where.append(
                "w.id IN ("
                f" SELECT work_id FROM work_tags WHERE remote_tag_id IN ({placeholders})"
                " GROUP BY work_id HAVING COUNT(DISTINCT remote_tag_id) = ?"
                ")"
            )
            params.extend([*tag_ids, len(tag_ids)])

        return where, params

    def _top(self, where_sql: str, params: list[Any], order_by: str, limit: int) -> list[dict[str, Any]]:
        limit = max(1, min(int(limit), 48))
        rows = self.db.fetchall(
            f"""
            SELECT {WORK_COLUMNS}
            {WORK_JOINS}
            WHERE {where_sql}
            ORDER BY {order_by}
            LIMIT ?
            """,
            [*params, limit],
        )
        return self._finalize(rows)

    def _finalize(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        for row in rows:
            row["completed"] = bool(row["completed"])
        self._attach_tags(rows)
        return rows

    def _attach_tags(self, rows: list[dict[str, Any]]) -> None:
        if not rows:
            return
        work_ids = [row["id"] for row in rows]
        placeholders = ", ".join("?" for _ in work_ids)
        tag_rows = self.db.fetchall(
            f"""
            SELECT
              wt.work_id, wt.remote_tag_id, wt.tag_type, wt.remote_name, wt.remote_slug,
              d.zh_name AS display_zh
            FROM work_tags wt
            LEFT JOIN local_tag_dictionary d ON d.id = wt.dictionary_id AND d.ignored = 0
            WHERE wt.work_id IN ({placeholders})
            ORDER BY wt.work_id, wt.id
            """,
            work_ids,
        )
        grouped: dict[int, list[dict[str, Any]]] = {work_id: [] for work_id in work_ids}
        for tag in tag_rows:
            work_id = int(tag["work_id"])
            grouped.setdefault(work_id, []).append(
                {
                    "id": tag["remote_tag_id"],
                    "type": tag["tag_type"],
                    "name": tag["remote_name"],
                    "slug": tag["remote_slug"],
                    "display": tag["display_zh"] or tag["remote_name"] or tag["remote_slug"] or str(tag["remote_tag_id"]),
                }
            )
        type_rank = {kind: index for index, kind in enumerate(CARD_TAG_TYPES)}
        for row in rows:
            tags = grouped.get(row["id"], [])
            tags.sort(key=lambda tag: type_rank.get(tag.get("type") or "", len(type_rank)))
            row["tags"] = tags
