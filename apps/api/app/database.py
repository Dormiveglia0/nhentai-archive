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
  favorite INTEGER NOT NULL DEFAULT 0,
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

CREATE TABLE IF NOT EXISTS work_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS work_group_members (
  work_id INTEGER PRIMARY KEY REFERENCES works(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES work_groups(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_work_group_members_group ON work_group_members(group_id);
CREATE TRIGGER IF NOT EXISTS work_group_member_removed AFTER DELETE ON work_group_members BEGIN
  UPDATE work_groups SET version=version+1 WHERE id=OLD.group_id;
  DELETE FROM work_groups WHERE id=OLD.group_id AND NOT EXISTS (
    SELECT 1 FROM work_group_members WHERE group_id=OLD.group_id);
END;

CREATE TABLE IF NOT EXISTS reader_bridges (
  work_id INTEGER PRIMARY KEY REFERENCES works(id) ON DELETE CASCADE,
  remote_gallery_id INTEGER NOT NULL,
  version TEXT NOT NULL DEFAULT '',
  source_revision TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'unverified',
  error TEXT,
  catalog_json TEXT NOT NULL DEFAULT '[]',
  job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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

CREATE TABLE IF NOT EXISTS reading_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_key TEXT NOT NULL UNIQUE,
  work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TEXT,
  duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK(duration_seconds >= 0),
  last_page_index INTEGER NOT NULL DEFAULT 0,
  page_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS remote_reading_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_key TEXT NOT NULL UNIQUE,
  gallery_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  title_japanese TEXT,
  pretty_title TEXT,
  page_count INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TEXT,
  duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK(duration_seconds >= 0),
  last_page_index INTEGER NOT NULL DEFAULT 0
);

CREATE VIEW IF NOT EXISTS reading_session_events AS
SELECT
  'local' AS source, id, client_key, work_id, NULL AS remote_gallery_id,
  NULL AS remote_title, NULL AS remote_title_japanese, NULL AS remote_pretty_title,
  started_at, updated_at, ended_at, duration_seconds, last_page_index
FROM reading_sessions
UNION ALL
SELECT
  'remote' AS source, r.id, r.client_key, w.id AS work_id, r.gallery_id AS remote_gallery_id,
  r.title AS remote_title, r.title_japanese AS remote_title_japanese, r.pretty_title AS remote_pretty_title,
  r.started_at, r.updated_at, r.ended_at, r.duration_seconds, r.last_page_index
FROM remote_reading_sessions r
LEFT JOIN works w ON w.remote_gallery_id = r.gallery_id;

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

CREATE TABLE IF NOT EXISTS creator_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tag_type TEXT NOT NULL CHECK(tag_type IN ('artist', 'group')),
  remote_tag_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  email_enabled INTEGER NOT NULL DEFAULT 1,
  interval_seconds INTEGER NOT NULL DEFAULT 86400,
  baseline_complete INTEGER NOT NULL DEFAULT 0,
  scan_page INTEGER NOT NULL DEFAULT 1,
  scan_token TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'queued',
  next_check_at REAL NOT NULL DEFAULT 0,
  check_lease_until REAL NOT NULL DEFAULT 0,
  claim_token TEXT,
  failures INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  last_checked_at TEXT,
  recent_json TEXT NOT NULL DEFAULT '[]',
  removed_at TEXT,
  revision INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tag_type, remote_tag_id)
);

CREATE TABLE IF NOT EXISTS subscription_seen (
  subscription_id INTEGER NOT NULL REFERENCES creator_subscriptions(id) ON DELETE CASCADE,
  gallery_id INTEGER NOT NULL,
  scan_token TEXT NOT NULL,
  PRIMARY KEY(subscription_id, gallery_id)
);

CREATE TABLE IF NOT EXISTS subscription_updates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subscription_id INTEGER NOT NULL REFERENCES creator_subscriptions(id) ON DELETE CASCADE,
  gallery_id INTEGER NOT NULL,
  payload_json TEXT NOT NULL,
  scan_token TEXT NOT NULL,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(subscription_id, gallery_id)
);

CREATE TABLE IF NOT EXISTS mail_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subscription_id INTEGER REFERENCES creator_subscriptions(id) ON DELETE SET NULL,
  dedup_key TEXT NOT NULL UNIQUE,
  message_id TEXT NOT NULL UNIQUE,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'sending', 'sent', 'failed', 'cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at REAL NOT NULL DEFAULT 0,
  lease_until REAL NOT NULL DEFAULT 0,
  claim_token TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TEXT
);

CREATE TABLE IF NOT EXISTS media_libraries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  root_path TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK(kind IN ('managed', 'local', 'mounted')),
  enabled INTEGER NOT NULL DEFAULT 1,
  read_only INTEGER NOT NULL DEFAULT 1,
  config_json TEXT NOT NULL DEFAULT '{}',
  health TEXT NOT NULL DEFAULT 'unknown',
  last_error TEXT,
  root_device INTEGER,
  root_inode INTEGER,
  resolved_root_path TEXT,
  last_scan_at TEXT,
  next_scan_at REAL NOT NULL DEFAULT 0,
  scan_failures INTEGER NOT NULL DEFAULT 0,
  watch_error TEXT,
  removed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS library_scan_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  library_id INTEGER NOT NULL REFERENCES media_libraries(id) ON DELETE CASCADE,
  job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'running',
  counts_json TEXT NOT NULL DEFAULT '{}',
  errors_json TEXT NOT NULL DEFAULT '[]',
  progress_json TEXT NOT NULL DEFAULT '{}',
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS library_changes (
  library_id INTEGER NOT NULL REFERENCES media_libraries(id) ON DELETE CASCADE,
  relative_path TEXT NOT NULL,
  due_at REAL NOT NULL,
  PRIMARY KEY(library_id, relative_path)
);

CREATE TABLE IF NOT EXISTS source_renames (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL,
  file_id INTEGER NOT NULL,
  item_id INTEGER,
  library_id INTEGER NOT NULL,
  old_path TEXT NOT NULL,
  new_path TEXT NOT NULL,
  version_json TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'prepared',
  error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_source_renames_pending ON source_renames(library_id, state);

CREATE TABLE IF NOT EXISTS library_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  library_id INTEGER NOT NULL REFERENCES media_libraries(id) ON DELETE CASCADE,
  relative_path TEXT NOT NULL,
  work_id INTEGER REFERENCES works(id) ON DELETE SET NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  mtime_ns INTEGER NOT NULL DEFAULT 0,
  device INTEGER,
  inode INTEGER,
  stable_since REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  last_error TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  retry_at REAL,
  fingerprint TEXT,
  manifest BLOB,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  archive_info_json TEXT,
  last_seen_run_id INTEGER REFERENCES library_scan_runs(id) ON DELETE SET NULL,
  missing_since REAL,
  indexed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(library_id, relative_path)
);

CREATE TABLE IF NOT EXISTS archive_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  library_item_id INTEGER REFERENCES library_items(id) ON DELETE SET NULL,
  version TEXT NOT NULL,
  manifest BLOB NOT NULL,
  size_bytes INTEGER NOT NULL CHECK(size_bytes >= 0),
  status TEXT NOT NULL DEFAULT 'queued',
  job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
  last_error TEXT,
  created_at REAL NOT NULL,
  accessed_at REAL NOT NULL,
  UNIQUE(library_item_id, version)
);

CREATE TABLE IF NOT EXISTS archive_cache_leases (
  token TEXT PRIMARY KEY,
  cache_id INTEGER NOT NULL REFERENCES archive_cache(id) ON DELETE CASCADE,
  expires_at REAL NOT NULL
);

CREATE TRIGGER IF NOT EXISTS rebase_reader_progress_on_page_change
AFTER UPDATE OF page_count ON works
WHEN NEW.page_count <> OLD.page_count
BEGIN
  UPDATE reader_progress SET
    page_count = NEW.page_count,
    page_index = CASE WHEN NEW.page_count > 0 AND page_index > 0 THEN MIN(page_index, NEW.page_count) ELSE 0 END,
    progress_percent = CASE WHEN NEW.page_count > 0 AND page_index > 0
      THEN ROUND(MIN(page_index, NEW.page_count) * 100.0 / NEW.page_count) ELSE 0 END,
    completed = CASE WHEN NEW.page_count > 0 AND page_index >= NEW.page_count THEN 1 ELSE 0 END
  WHERE work_id = NEW.id;
END;
"""

INDEXES = """
CREATE INDEX IF NOT EXISTS idx_subscriptions_due ON creator_subscriptions(enabled, removed_at, next_check_at);
CREATE INDEX IF NOT EXISTS idx_subscription_updates_created ON subscription_updates(id DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_updates_unread ON subscription_updates(read_at, id DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_updates_round ON subscription_updates(subscription_id, scan_token);
CREATE INDEX IF NOT EXISTS idx_mail_outbox_due ON mail_outbox(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_archive_cache_access ON archive_cache(status, accessed_at);
CREATE INDEX IF NOT EXISTS idx_archive_cache_work ON archive_cache(work_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_archive_cache_leases ON archive_cache_leases(cache_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_work_files_path ON work_files(path);
CREATE INDEX IF NOT EXISTS idx_works_cover_path ON works(cover_path) WHERE cover_path IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_work_files_work_kind_created
  ON work_files(work_id, kind, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_works_favorite_updated
  ON works(favorite, updated_at DESC);
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
CREATE INDEX IF NOT EXISTS idx_reading_sessions_work_started
  ON reading_sessions(work_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_reading_sessions_started
  ON reading_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_remote_reading_sessions_gallery_started
  ON remote_reading_sessions(gallery_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_remote_reading_sessions_started
  ON remote_reading_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_status_updated
  ON jobs(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_updated
  ON jobs(updated_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_job_logs_job_id
  ON job_logs(job_id, id);
CREATE INDEX IF NOT EXISTS idx_library_items_work ON library_items(work_id);
CREATE INDEX IF NOT EXISTS idx_library_items_scan ON library_items(library_id, last_seen_run_id);
CREATE INDEX IF NOT EXISTS idx_library_items_retry ON library_items(library_id, status, retry_at);
CREATE INDEX IF NOT EXISTS idx_library_items_identity ON library_items(library_id, device, inode);
CREATE INDEX IF NOT EXISTS idx_library_items_fingerprint ON library_items(fingerprint) WHERE fingerprint IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scan_runs_library ON library_scan_runs(library_id, id DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_work_files_library_item
  ON work_files(library_item_id) WHERE library_item_id IS NOT NULL;
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
            conn.execute("DROP VIEW IF EXISTS reading_session_events")
            conn.executescript(SCHEMA)
            self._migrate_legacy_schema(conn)
            conn.execute("UPDATE creator_subscriptions SET interval_seconds = 86400 WHERE interval_seconds NOT IN (86400, 259200, 604800)")
            conn.executescript(INDEXES)
            conn.execute("INSERT OR IGNORE INTO settings(key, value) VALUES ('library.revision', '0')")
            for table in ("works", "work_files", "work_metadata", "work_tags", "reader_progress", "local_tag_dictionary", "work_groups", "work_group_members"):
                for event in ("INSERT", "UPDATE", "DELETE"):
                    conn.execute(f"""CREATE TRIGGER IF NOT EXISTS library_revision_{table}_{event.lower()}
                        AFTER {event} ON {table} BEGIN
                        UPDATE settings SET value = CAST(value AS INTEGER) + 1 WHERE key = 'library.revision'; END""")

    def rebase_managed_paths(self, data_dir: Path) -> None:
        root = Path(data_dir).resolve()
        self._managed_root = root
        with self.connect() as conn:
            for table, column in (("work_files", "path"), ("works", "cover_path")):
                owned = " AND library_item_id IS NULL" if table == "work_files" else ""
                for row in conn.execute(f"SELECT id, {column} AS value FROM {table} WHERE {column} IS NOT NULL{owned}"):
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
        subscription_columns = _table_columns(conn, "creator_subscriptions")
        if "recent_json" not in subscription_columns:
            _add_column_if_missing(conn, "creator_subscriptions", subscription_columns, "recent_json", "TEXT NOT NULL DEFAULT '[]'")
            conn.execute("""UPDATE creator_subscriptions SET next_check_at = 0, status = 'queued',
                scan_page = 1, scan_token = '', claim_token = NULL, check_lease_until = 0, revision = revision + 1
                WHERE enabled = 1 AND removed_at IS NULL""")
        works_columns = _table_columns(conn, "works")
        _add_column_if_missing(conn, "works", works_columns, "favorite", "INTEGER NOT NULL DEFAULT 0")
        if "metadata_gallery_id" not in works_columns:
            _add_column_if_missing(conn, "works", works_columns, "metadata_gallery_id", "INTEGER")
            conn.execute("UPDATE works SET metadata_gallery_id = remote_gallery_id")
        _add_column_if_missing(
            conn, "work_files", _table_columns(conn, "work_files"),
            "library_item_id", "INTEGER REFERENCES library_items(id) ON DELETE SET NULL",
        )
        _add_column_if_missing(conn, "reading_sessions", _table_columns(conn, "reading_sessions"),
                               "cache_lease", "TEXT")
        if "page_count" not in _table_columns(conn, "reading_sessions"):
            _add_column_if_missing(conn, "reading_sessions", _table_columns(conn, "reading_sessions"),
                                   "page_count", "INTEGER NOT NULL DEFAULT 0")
            conn.execute("UPDATE reading_sessions SET page_count = COALESCE((SELECT page_count FROM works WHERE id = work_id), 0)")
        _add_column_if_missing(conn, "media_libraries", _table_columns(conn, "media_libraries"),
                               "resolved_root_path", "TEXT")
        for name, declaration in (("next_scan_at", "REAL NOT NULL DEFAULT 0"),
                                  ("scan_failures", "INTEGER NOT NULL DEFAULT 0"), ("watch_error", "TEXT")):
            _add_column_if_missing(conn, "media_libraries", _table_columns(conn, "media_libraries"), name, declaration)
        item_columns = _table_columns(conn, "library_items")
        if "archive_info_json" not in item_columns:
            _add_column_if_missing(conn, "library_items", item_columns, "archive_info_json", "TEXT")
            conn.execute("UPDATE library_items SET status = 'pending', stable_since = 0 WHERE status = 'ready'")
        for name, declaration in (("scrape_status", "TEXT NOT NULL DEFAULT 'pending'"),
                                  ("scrape_retry_at", "REAL NOT NULL DEFAULT 0"),
                                  ("scrape_attempts", "INTEGER NOT NULL DEFAULT 0"), ("scrape_result_json", "TEXT")):
            _add_column_if_missing(conn, "library_items", _table_columns(conn, "library_items"), name, declaration)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_library_items_scrape ON library_items(scrape_status, scrape_retry_at)")
        _add_column_if_missing(conn, "library_scan_runs", _table_columns(conn, "library_scan_runs"),
                               "progress_json", "TEXT NOT NULL DEFAULT '{}'")

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

        _add_column_if_missing(conn, "work_tags", _table_columns(conn, "work_tags"), "source", "TEXT NOT NULL DEFAULT 'legacy'")
        _add_column_if_missing(conn, "work_tags", _table_columns(conn, "work_tags"), "tag_key", "TEXT")
        tag_key = "'local:' || COALESCE(tag_type, 'tag') || ':' || lower(trim(COALESCE(remote_name, remote_slug, '')))"
        conn.execute(f"UPDATE work_tags SET tag_key = {tag_key} WHERE tag_key IS NULL OR tag_key LIKE 'remote:%'")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_work_tags_key_work ON work_tags(tag_key, work_id)")
        for event in ("INSERT", "UPDATE OF remote_tag_id, tag_type, remote_name, remote_slug"):
            conn.execute(f"DROP TRIGGER IF EXISTS work_tags_key_{event.split()[0].lower()}")
            conn.execute(f"""CREATE TRIGGER IF NOT EXISTS work_tags_key_{event.split()[0].lower()} AFTER {event} ON work_tags
                BEGIN UPDATE work_tags SET tag_key = {tag_key} WHERE id = NEW.id; END""")

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
                if Path(str(value)).is_absolute():
                    continue
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
