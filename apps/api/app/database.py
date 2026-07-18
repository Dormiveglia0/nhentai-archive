from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any, Iterable


SCHEMA = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS works (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  remote TEXT,
  remote_gallery_id INTEGER UNIQUE,
  media_id TEXT,
  title TEXT NOT NULL,
  title_japanese TEXT,
  pretty_title TEXT,
  source TEXT NOT NULL,
  language TEXT,
  page_count INTEGER NOT NULL DEFAULT 0,
  cover_path TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS work_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  path TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  sha256 TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS work_pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  page_index INTEGER NOT NULL,
  archive_member TEXT NOT NULL,
  media_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  UNIQUE(work_id, page_index)
);

CREATE TABLE IF NOT EXISTS remote_galleries (
  gallery_id INTEGER PRIMARY KEY,
  media_id TEXT,
  payload_json TEXT NOT NULL,
  cached_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS remote_tags (
  remote_id INTEGER PRIMARY KEY,
  type TEXT,
  name TEXT,
  slug TEXT,
  payload_json TEXT NOT NULL,
  cached_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS local_tag_dictionary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  original_text TEXT NOT NULL,
  normalized_key TEXT NOT NULL,
  zh_name TEXT NOT NULL,
  tag_type TEXT NOT NULL DEFAULT 'tag',
  remote_tag_id INTEGER REFERENCES remote_tags(remote_id) ON DELETE SET NULL,
  scope_json TEXT NOT NULL DEFAULT '[]',
  note TEXT,
  status TEXT NOT NULL DEFAULT 'configured',
  confidence INTEGER NOT NULL DEFAULT 80,
  locked INTEGER NOT NULL DEFAULT 0,
  ignored INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(normalized_key, tag_type)
);

CREATE TABLE IF NOT EXISTS tag_aliases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dictionary_id INTEGER NOT NULL REFERENCES local_tag_dictionary(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  normalized_key TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS work_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  remote_tag_id INTEGER REFERENCES remote_tags(remote_id) ON DELETE SET NULL,
  dictionary_id INTEGER REFERENCES local_tag_dictionary(id) ON DELETE SET NULL,
  tag_type TEXT,
  remote_name TEXT,
  remote_slug TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(work_id, remote_tag_id)
);

CREATE TABLE IF NOT EXISTS work_metadata (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  field TEXT NOT NULL,
  value TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  source_value TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(work_id, field)
);

CREATE TABLE IF NOT EXISTS governance_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK(action IN ('approve', 'reopen')),
  snapshot_hash TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_governance_reviews_work_id
  ON governance_reviews(work_id, id DESC);

CREATE TABLE IF NOT EXISTS reader_progress (
  work_id INTEGER PRIMARY KEY REFERENCES works(id) ON DELETE CASCADE,
  page_index INTEGER NOT NULL,
  page_count INTEGER NOT NULL,
  progress_percent INTEGER NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  last_read_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reading_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  page_index INTEGER NOT NULL,
  opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  stage TEXT NOT NULL,
  progress_current INTEGER NOT NULL DEFAULT 0,
  progress_total INTEGER NOT NULL DEFAULT 0,
  progress_percent INTEGER NOT NULL DEFAULT 0,
  target_json TEXT NOT NULL DEFAULT '{}',
  error TEXT,
  retry_after INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS job_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
"""

INDEXES = """
CREATE INDEX IF NOT EXISTS idx_work_files_work_kind_created
  ON work_files(work_id, kind, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_work_tags_remote_work
  ON work_tags(remote_tag_id, work_id);
CREATE INDEX IF NOT EXISTS idx_work_tags_dictionary
  ON work_tags(dictionary_id);
CREATE INDEX IF NOT EXISTS idx_dictionary_remote_tag
  ON local_tag_dictionary(remote_tag_id);
CREATE INDEX IF NOT EXISTS idx_tag_aliases_dictionary
  ON tag_aliases(dictionary_id);
CREATE INDEX IF NOT EXISTS idx_reading_history_work_opened
  ON reading_history(work_id, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_reading_history_opened_work
  ON reading_history(opened_at DESC, work_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status_updated
  ON jobs(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_updated
  ON jobs(updated_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_job_logs_job_id
  ON job_logs(job_id, id);
"""


class Database:
    def __init__(self, path: Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._managed_root = self.path.parent.resolve()

    def connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.path, timeout=5)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA busy_timeout = 5000")
        conn.execute("PRAGMA synchronous = NORMAL")
        return conn

    def init_schema(self) -> None:
        with self.connect() as conn:
            conn.execute("PRAGMA journal_mode = WAL")
            conn.executescript(SCHEMA)
            self._migrate_legacy_schema(conn)
            conn.executescript(INDEXES)

    def rebase_managed_paths(self, data_dir: Path) -> None:
        root = Path(data_dir).resolve()
        self._managed_root = root
        with self.connect() as conn:
            for table, column in (("work_files", "path"), ("works", "cover_path")):
                for row in conn.execute(f"SELECT id, {column} AS value FROM {table} WHERE {column} IS NOT NULL"):
                    portable = _portable_managed_path(row["value"], root)
                    if portable and portable != row["value"]:
                        conn.execute(f"UPDATE {table} SET {column} = ? WHERE id = ?", (portable, row["id"]))
            for row in conn.execute("SELECT key, value FROM settings WHERE key = 'storage.export_dir'"):
                candidate = _rebased_path(row["value"], root)
                if candidate:
                    conn.execute("UPDATE settings SET value = ? WHERE key = ?", (candidate, row["key"]))

    def managed_path(self, value: str | Path) -> str:
        return _portable_managed_path(str(value), self._managed_root) or str(value)

    def _migrate_legacy_schema(self, conn: sqlite3.Connection) -> None:
        dictionary_columns = _table_columns(conn, "local_tag_dictionary")
        if dictionary_columns and "zh_name" not in dictionary_columns:
            legacy = _rename_legacy_table(conn, "local_tag_dictionary")
            conn.execute(
                """
                CREATE TABLE local_tag_dictionary (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  original_text TEXT NOT NULL,
                  normalized_key TEXT NOT NULL,
                  zh_name TEXT NOT NULL,
                  tag_type TEXT NOT NULL DEFAULT 'tag',
                  remote_tag_id INTEGER REFERENCES remote_tags(remote_id) ON DELETE SET NULL,
                  scope_json TEXT NOT NULL DEFAULT '[]',
                  note TEXT,
                  status TEXT NOT NULL DEFAULT 'configured',
                  confidence INTEGER NOT NULL DEFAULT 80,
                  locked INTEGER NOT NULL DEFAULT 0,
                  ignored INTEGER NOT NULL DEFAULT 0,
                  source TEXT NOT NULL DEFAULT 'legacy',
                  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                  UNIQUE(normalized_key, tag_type)
                )
                """
            )
            conn.execute(
                f"""
                INSERT OR IGNORE INTO local_tag_dictionary
                  (id, original_text, normalized_key, zh_name, tag_type, remote_tag_id, note, confidence, locked, ignored, source, created_at, updated_at)
                SELECT
                  id,
                  source_text,
                  lower(trim(source_text)),
                  display_zh,
                  type,
                  remote_tag_id,
                  note,
                  CAST(CASE WHEN confidence <= 1 THEN confidence * 100 ELSE confidence END AS INTEGER),
                  locked,
                  ignored,
                  'legacy',
                  created_at,
                  updated_at
                FROM {legacy}
                WHERE source_text IS NOT NULL AND display_zh IS NOT NULL
                """
            )

        alias_columns = _table_columns(conn, "tag_aliases")
        if alias_columns and "normalized_key" not in alias_columns:
            legacy = _rename_legacy_table(conn, "tag_aliases")
            conn.execute(
                """
                CREATE TABLE tag_aliases (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  dictionary_id INTEGER NOT NULL REFERENCES local_tag_dictionary(id) ON DELETE CASCADE,
                  alias TEXT NOT NULL,
                  normalized_key TEXT NOT NULL UNIQUE,
                  source TEXT NOT NULL DEFAULT 'manual',
                  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            conn.execute(
                f"""
                INSERT OR IGNORE INTO tag_aliases (id, dictionary_id, alias, normalized_key, source)
                SELECT id, dictionary_id, alias, lower(trim(COALESCE(normalized, alias))), 'legacy'
                FROM {legacy}
                WHERE alias IS NOT NULL
                """
            )

        work_tag_columns = _table_columns(conn, "work_tags")
        if work_tag_columns and "dictionary_id" not in work_tag_columns:
            legacy = _rename_legacy_table(conn, "work_tags")
            conn.execute(
                """
                CREATE TABLE work_tags (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
                  remote_tag_id INTEGER REFERENCES remote_tags(remote_id) ON DELETE SET NULL,
                  dictionary_id INTEGER REFERENCES local_tag_dictionary(id) ON DELETE SET NULL,
                  tag_type TEXT,
                  remote_name TEXT,
                  remote_slug TEXT,
                  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                  UNIQUE(work_id, remote_tag_id)
                )
                """
            )
            conn.execute(
                f"""
                INSERT OR IGNORE INTO work_tags
                  (work_id, remote_tag_id, dictionary_id, tag_type, remote_name, remote_slug, created_at)
                SELECT
                  wt.work_id,
                  wt.remote_tag_id,
                  d.id,
                  wt.type,
                  wt.source_text,
                  wt.source_text,
                  wt.created_at
                FROM {legacy} wt
                LEFT JOIN local_tag_dictionary d ON d.remote_tag_id = wt.remote_tag_id
                WHERE wt.remote_tag_id IS NOT NULL
                """
            )

    def execute(self, sql: str, params: Iterable[Any] = ()) -> sqlite3.Cursor:
        with self.connect() as conn:
            cursor = conn.execute(sql, tuple(params))
            conn.commit()
            return cursor

    def fetchone(self, sql: str, params: Iterable[Any] = ()) -> dict[str, Any] | None:
        with self.connect() as conn:
            row = conn.execute(sql, tuple(params)).fetchone()
            return self._resolve_managed_fields(dict(row)) if row else None

    def fetchall(self, sql: str, params: Iterable[Any] = ()) -> list[dict[str, Any]]:
        with self.connect() as conn:
            return [self._resolve_managed_fields(dict(row)) for row in conn.execute(sql, tuple(params)).fetchall()]

    def _resolve_managed_fields(self, row: dict[str, Any]) -> dict[str, Any]:
        for key in ("path", "cover_path", "source_path"):
            value = row.get(key)
            if value:
                relative = _managed_relative_path(str(value), self._managed_root)
                if relative:
                    row[key] = str(self._managed_root / relative)
        return row


def _table_columns(conn: sqlite3.Connection, table: str) -> set[str]:
    return {row["name"] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}


def _rebased_path(value: str, root: Path) -> str | None:
    path = Path(value).expanduser()
    if ".local-data" in path.parts:
        marker = path.parts.index(".local-data")
        relative = path.parts[marker + 1 :]
    elif path.is_absolute() and len(path.parts) > 2 and path.parts[1] == "data":
        relative = path.parts[2:]
    else:
        return None
    candidate = root.joinpath(*relative)
    return str(candidate) if candidate != path and candidate.exists() else None


def _portable_managed_path(value: str, root: Path) -> str | None:
    relative = _managed_relative_path(value, root)
    return relative.as_posix() if relative else None


def _managed_relative_path(value: str, root: Path) -> Path | None:
    path = Path(value).expanduser()
    relative: Path | None = None
    if path.is_absolute():
        try:
            relative = path.resolve().relative_to(root)
        except ValueError:
            pass
    if relative is None and ".local-data" in path.parts:
        marker = path.parts.index(".local-data")
        relative = Path(*path.parts[marker + 1 :])
    elif relative is None and path.is_absolute() and len(path.parts) > 2 and path.parts[1] == "data":
        relative = Path(*path.parts[2:])
    elif relative is None and not path.is_absolute():
        relative = path
    if relative is None or not relative.parts or relative.parts[0] not in {"library", "covers"} or ".." in relative.parts:
        return None
    return relative


def _add_column_if_missing(
    conn: sqlite3.Connection,
    table: str,
    columns: set[str],
    column: str,
    definition: str,
) -> None:
    if column in columns:
        return
    conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")
    columns.add(column)


def _rename_legacy_table(conn: sqlite3.Connection, table: str) -> str:
    index = 1
    legacy = f"{table}_legacy"
    existing = _table_names(conn)
    while legacy in existing:
        index += 1
        legacy = f"{table}_legacy_{index}"
    conn.execute(f"ALTER TABLE {table} RENAME TO {legacy}")
    return legacy


def _table_names(conn: sqlite3.Connection) -> set[str]:
    rows = conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()
    return {row["name"] for row in rows}
