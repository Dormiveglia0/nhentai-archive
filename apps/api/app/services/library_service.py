from __future__ import annotations

from datetime import datetime, timedelta, timezone
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
  COALESCE(w.favorite, 0) AS favorite,
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
              COALESCE(SUM(w.favorite), 0) AS favorites,
              COALESCE(SUM(w.page_count), 0) AS pages
            FROM works w
            LEFT JOIN reader_progress rp ON rp.work_id = w.id
            """
        ) or {"total": 0, "reading": 0, "completed": 0, "favorites": 0, "pages": 0}

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
            WHERE wt.tag_type = 'language'
              AND COALESCE(wt.remote_slug, wt.remote_name) IS NOT NULL
              AND lower(COALESCE(wt.remote_slug, wt.remote_name, '')) NOT LIKE 'translat%'
            GROUP BY value
            ORDER BY count DESC
            """
        )

        return {
            "total": total,
            "reading": reading,
            "completed": completed,
            "unread": unread,
            "favorites": int(totals["favorites"]),
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
        favorite_only: bool = False,
    ) -> dict[str, Any]:
        page = max(1, int(page))
        per_page = max(1, min(int(per_page), 100))
        order_by = SORT_ORDERS.get(sort, SORT_ORDERS["recent_updated"])
        read_status = read_status if read_status in READ_STATUSES else "all"
        source = source if source in SOURCES else "all"
        tag_ids = [int(tid) for tid in (tag_ids or []) if tid is not None]

        where, params = self._build_filters(q, read_status, source, language, tag_ids, favorite_only)
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

    def work(self, work_id: int) -> dict[str, Any] | None:
        rows = self.db.fetchall(
            f"SELECT {WORK_COLUMNS} {WORK_JOINS} WHERE w.id = ?",
            (work_id,),
        )
        return self._finalize(rows)[0] if rows else None

    def set_favorite(self, work_id: int, favorite: bool) -> dict[str, Any]:
        updated = self.db.execute(
            "UPDATE works SET favorite = ? WHERE id = ?",
            (int(favorite), work_id),
        ).rowcount
        if not updated:
            raise ValueError(f"Work {work_id} does not exist")
        work = self.work(work_id)
        if work is None:
            raise ValueError(f"Work {work_id} does not exist")
        return work

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

    def statistics(self, days: int = 30, timezone_offset_minutes: int = 0, limit: int = 10) -> dict[str, Any]:
        days = max(1, min(int(days), 365))
        timezone_offset_minutes = max(-840, min(int(timezone_offset_minutes), 840))
        timezone_modifier = f"{timezone_offset_minutes:+d} minutes"
        limit = max(1, min(int(limit), 20))
        local_timezone = timezone(timedelta(minutes=timezone_offset_minutes))
        today = datetime.now(local_timezone).date()
        start = today - timedelta(days=days - 1)
        previous_start = start - timedelta(days=days)

        overview = self.db.fetchone(
            """
            SELECT
              COALESCE(SUM(duration_seconds), 0) AS total_seconds,
              COUNT(*) AS sessions,
              COUNT(DISTINCT CASE
                WHEN work_id IS NOT NULL THEN 'local:' || work_id
                ELSE 'remote:' || remote_gallery_id
              END) AS works_read,
              COUNT(DISTINCT date(started_at, ?)) AS active_days,
              COALESCE(ROUND(AVG(duration_seconds)), 0) AS average_session_seconds,
              COALESCE(MAX(duration_seconds), 0) AS longest_session_seconds
            FROM reading_session_events
            WHERE date(started_at, ?) >= ?
            """,
            (timezone_modifier, timezone_modifier, start.isoformat()),
        ) or {}
        all_time = self.db.fetchone(
            """
            SELECT COALESCE(SUM(duration_seconds), 0) AS total_seconds,
                   COUNT(*) AS sessions,
                   COUNT(DISTINCT CASE
                     WHEN work_id IS NOT NULL THEN 'local:' || work_id
                     ELSE 'remote:' || remote_gallery_id
                   END) AS works_read,
                   MIN(date(started_at, ?)) AS tracking_since
            FROM reading_session_events
            """,
            (timezone_modifier,),
        ) or {}
        previous = self.db.fetchone(
            """
            SELECT COALESCE(SUM(duration_seconds), 0) AS total_seconds,
                   COUNT(*) AS sessions
            FROM reading_session_events
            WHERE date(started_at, ?) >= ? AND date(started_at, ?) < ?
            """,
            (timezone_modifier, previous_start.isoformat(), timezone_modifier, start.isoformat()),
        ) or {}
        favorite_row = self.db.fetchone("SELECT COUNT(*) AS value FROM works WHERE favorite = 1")
        works_row = self.db.fetchone("SELECT COUNT(*) AS value FROM works")
        total_works = int(works_row["value"] if works_row else 0)
        raw_activity = self.db.fetchall(
            """
            SELECT date(started_at, ?) AS date,
                   COALESCE(SUM(duration_seconds), 0) AS seconds,
                   COUNT(*) AS sessions,
                   COUNT(DISTINCT CASE
                     WHEN work_id IS NOT NULL THEN 'local:' || work_id
                     ELSE 'remote:' || remote_gallery_id
                   END) AS works
            FROM reading_session_events
            WHERE date(started_at, ?) >= ?
            GROUP BY date
            ORDER BY date
            """,
            (timezone_modifier, timezone_modifier, start.isoformat()),
        )
        activity_by_date = {str(row["date"]): row for row in raw_activity}
        # ponytail: a session belongs to its start day; split it at midnight only if multi-day precision matters.
        activity = []
        for offset in range(days):
            day = start + timedelta(days=offset)
            row = activity_by_date.get(day.isoformat(), {})
            activity.append(
                {
                    "date": day.isoformat(),
                    "seconds": int(row.get("seconds", 0)),
                    "sessions": int(row.get("sessions", 0)),
                    "works": int(row.get("works", 0)),
                }
            )

        active_dates = {
            str(row["date"])
            for row in self.db.fetchall(
                "SELECT DISTINCT date(started_at, ?) AS date FROM reading_session_events",
                (timezone_modifier,),
            )
        }
        streak = 0
        cursor = today if today.isoformat() in active_dates else today - timedelta(days=1)
        while cursor.isoformat() in active_dates:
            streak += 1
            cursor -= timedelta(days=1)

        weekday_rows = self.db.fetchall(
            """
            SELECT (CAST(strftime('%w', datetime(started_at, ?)) AS INTEGER) + 6) % 7 AS weekday,
                   COALESCE(SUM(duration_seconds), 0) AS seconds,
                   COUNT(*) AS sessions
            FROM reading_session_events
            WHERE date(started_at, ?) >= ?
            GROUP BY weekday
            """,
            (timezone_modifier, timezone_modifier, start.isoformat()),
        )
        weekday_map = {int(row["weekday"]): row for row in weekday_rows}
        weekdays = [
            {
                "weekday": index,
                "seconds": int(weekday_map.get(index, {}).get("seconds", 0)),
                "sessions": int(weekday_map.get(index, {}).get("sessions", 0)),
            }
            for index in range(7)
        ]

        hourly_rows = self.db.fetchall(
            """
            SELECT CAST(strftime('%H', datetime(started_at, ?)) AS INTEGER) AS hour,
                   COALESCE(SUM(duration_seconds), 0) AS seconds,
                   COUNT(*) AS sessions
            FROM reading_session_events
            WHERE date(started_at, ?) >= ?
            GROUP BY hour
            """,
            (timezone_modifier, timezone_modifier, start.isoformat()),
        )
        hourly_map = {int(row["hour"]): row for row in hourly_rows}
        hours = [
            {
                "hour": hour,
                "seconds": int(hourly_map.get(hour, {}).get("seconds", 0)),
                "sessions": int(hourly_map.get(hour, {}).get("sessions", 0)),
            }
            for hour in range(24)
        ]

        period_seconds = int(overview.get("total_seconds", 0))
        previous_seconds = int(previous.get("total_seconds", 0))
        seconds_change_percent = (
            round(((period_seconds - previous_seconds) / previous_seconds) * 100)
            if previous_seconds
            else None
        )

        return {
            "period_days": days,
            "timezone_offset_minutes": timezone_offset_minutes,
            "period": {
                "start_date": start.isoformat(),
                "end_date": today.isoformat(),
                "previous_total_seconds": previous_seconds,
                "previous_sessions": int(previous.get("sessions", 0)),
                "seconds_change_percent": seconds_change_percent,
            },
            "overview": {
                "total_seconds": period_seconds,
                "sessions": int(overview.get("sessions", 0)),
                "works_read": int(overview.get("works_read", 0)),
                "favorite_count": int(favorite_row["value"] if favorite_row else 0),
                "active_days": int(overview.get("active_days", 0)),
                "current_streak_days": streak,
                "average_session_seconds": int(overview.get("average_session_seconds", 0)),
                "longest_session_seconds": int(overview.get("longest_session_seconds", 0)),
                "tracking_since": all_time.get("tracking_since"),
                "all_time_seconds": int(all_time.get("total_seconds", 0)),
                "all_time_sessions": int(all_time.get("sessions", 0)),
                "all_time_works_read": int(all_time.get("works_read", 0)),
            },
            "activity": activity,
            "weekdays": weekdays,
            "hours": hours,
            "top_by_time": self._reading_ranking(
                "reading_seconds DESC, reading_sessions DESC", limit, start.isoformat(), timezone_modifier
            ),
            "top_by_sessions": self._reading_ranking(
                "reading_sessions DESC, reading_seconds DESC", limit, start.isoformat(), timezone_modifier
            ),
            "recent_sessions": self._recent_reading_sessions(limit, start.isoformat(), timezone_modifier),
            "collection_total_works": total_works,
            "top_authors": self._tag_statistics(
                "artist", "work_count DESC, reading_seconds DESC, favorite_count DESC", limit, total_works
            ),
            "top_tags": self._tag_statistics(
                "tag", "work_count DESC, reading_seconds DESC, favorite_count DESC", limit, total_works
            ),
        }

    # -- internals -------------------------------------------------------

    def _build_filters(
        self,
        q: str,
        read_status: str,
        source: str,
        language: str,
        tag_ids: list[int],
        favorite_only: bool,
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

        if favorite_only:
            where.append("w.favorite = 1")

        return where, params

    def _reading_ranking(
        self,
        order_by: str,
        limit: int,
        start_date: str,
        timezone_modifier: str,
    ) -> list[dict[str, Any]]:
        rows = self.db.fetchall(
            f"""
            SELECT COALESCE(MAX(w.id), MAX(rs.remote_gallery_id)) AS id,
                   CASE WHEN MAX(w.id) IS NOT NULL THEN 'local' ELSE 'remote' END AS source,
                   MAX(w.id) AS work_id,
                   MAX(rs.remote_gallery_id) AS remote_gallery_id,
                   COALESCE(MAX(w.title), MAX(rs.remote_title), 'Gallery ' || MAX(rs.remote_gallery_id)) AS title,
                   COALESCE(MAX(w.title_japanese), MAX(rs.remote_title_japanese)) AS title_japanese,
                   COALESCE(MAX(w.pretty_title), MAX(rs.remote_pretty_title)) AS pretty_title,
                   MAX(w.cover_path) AS cover_path,
                   COALESCE(MAX(w.favorite), 0) AS favorite,
                   COALESCE(SUM(rs.duration_seconds), 0) AS reading_seconds,
                   COUNT(rs.id) AS reading_sessions
            FROM reading_session_events rs
            LEFT JOIN works w ON w.id = rs.work_id
            WHERE date(rs.started_at, ?) >= ?
            GROUP BY CASE
              WHEN w.id IS NOT NULL THEN 'local:' || w.id
              ELSE 'remote:' || rs.remote_gallery_id
            END
            ORDER BY {order_by}, id DESC
            LIMIT ?
            """,
            (timezone_modifier, start_date, limit),
        )
        for row in rows:
            row["id"] = int(row["id"])
            row["work_id"] = int(row["work_id"]) if row.get("work_id") is not None else None
            row["remote_gallery_id"] = int(row["remote_gallery_id"]) if row.get("remote_gallery_id") is not None else None
            row["favorite"] = bool(row["favorite"])
            row["reading_seconds"] = int(row["reading_seconds"])
            row["reading_sessions"] = int(row["reading_sessions"])
        return rows

    def _recent_reading_sessions(
        self,
        limit: int,
        start_date: str,
        timezone_modifier: str,
    ) -> list[dict[str, Any]]:
        rows = self.db.fetchall(
            """
            SELECT rs.id,
                   CASE WHEN w.id IS NOT NULL THEN 'local' ELSE rs.source END AS source,
                   rs.started_at, rs.duration_seconds, rs.last_page_index,
                   w.id AS work_id, rs.remote_gallery_id,
                   COALESCE(w.title, rs.remote_title, 'Gallery ' || rs.remote_gallery_id) AS title,
                   COALESCE(w.title_japanese, rs.remote_title_japanese) AS title_japanese,
                   COALESCE(w.pretty_title, rs.remote_pretty_title) AS pretty_title
            FROM reading_session_events rs
            LEFT JOIN works w ON w.id = rs.work_id
            WHERE date(rs.started_at, ?) >= ?
            ORDER BY rs.started_at DESC, rs.id DESC
            LIMIT ?
            """,
            (timezone_modifier, start_date, limit),
        )
        for row in rows:
            row["duration_seconds"] = int(row["duration_seconds"])
            row["last_page_index"] = int(row["last_page_index"])
            row["work_id"] = int(row["work_id"]) if row.get("work_id") is not None else None
            row["remote_gallery_id"] = int(row["remote_gallery_id"]) if row.get("remote_gallery_id") is not None else None
        return rows

    def _tag_statistics(
        self,
        tag_type: str,
        order_by: str,
        limit: int,
        total_works: int,
    ) -> list[dict[str, Any]]:
        rows = self.db.fetchall(
            f"""
            SELECT MAX(wt.remote_tag_id) AS id,
                   MAX(COALESCE(d.zh_name, wt.remote_name, wt.remote_slug)) AS display,
                   COUNT(DISTINCT wt.work_id) AS work_count,
                   COUNT(DISTINCT CASE WHEN w.favorite = 1 THEN w.id END) AS favorite_count,
                   COALESCE(SUM(rs.reading_seconds), 0) AS reading_seconds,
                   COALESCE(SUM(rs.reading_sessions), 0) AS reading_sessions
            FROM work_tags wt
            JOIN works w ON w.id = wt.work_id
            LEFT JOIN local_tag_dictionary d ON d.id = wt.dictionary_id AND d.ignored = 0
            LEFT JOIN (
              SELECT work_id, SUM(duration_seconds) AS reading_seconds, COUNT(*) AS reading_sessions
              FROM reading_session_events
              WHERE work_id IS NOT NULL
              GROUP BY work_id
            ) rs ON rs.work_id = w.id
            WHERE wt.tag_type = ?
              AND COALESCE(d.zh_name, wt.remote_name, wt.remote_slug) IS NOT NULL
            GROUP BY COALESCE(CAST(wt.remote_tag_id AS TEXT), wt.remote_slug, wt.remote_name, CAST(wt.id AS TEXT))
            ORDER BY {order_by}, display COLLATE NOCASE
            LIMIT ?
            """,
            (tag_type, limit),
        )
        for row in rows:
            for key in ("work_count", "favorite_count", "reading_seconds", "reading_sessions"):
                row[key] = int(row[key])
            row["share_percent"] = round((row["work_count"] / total_works) * 100, 1) if total_works else 0
        return rows

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
            row["favorite"] = bool(row["favorite"])
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
