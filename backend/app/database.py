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

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
"""


class Database:
    def __init__(self, path: Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def init_schema(self) -> None:
        with self.connect() as conn:
            conn.executescript(SCHEMA)

    def execute(self, sql: str, params: Iterable[Any] = ()) -> sqlite3.Cursor:
        with self.connect() as conn:
            cursor = conn.execute(sql, tuple(params))
            conn.commit()
            return cursor

    def fetchone(self, sql: str, params: Iterable[Any] = ()) -> dict[str, Any] | None:
        with self.connect() as conn:
            row = conn.execute(sql, tuple(params)).fetchone()
            return dict(row) if row else None

    def fetchall(self, sql: str, params: Iterable[Any] = ()) -> list[dict[str, Any]]:
        with self.connect() as conn:
            return [dict(row) for row in conn.execute(sql, tuple(params)).fetchall()]
