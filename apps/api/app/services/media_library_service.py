from __future__ import annotations

import json
import os
import threading
from pathlib import Path, PurePosixPath
from typing import Any

from app.services.file_identity import sqlite_file_id
from app.config import Settings
from app.database import Database


LIBRARY_DEFAULTS = {
    "recursive": True,
    "watch": True,
    "scan_interval_seconds": 60,
    "stable_seconds": 5,
    "io_timeout_seconds": 30,
    "include_hidden": False,
    "follow_symlinks": False,
    "exclude_patterns": ["@eaDir", "$RECYCLE.BIN", ".Trash*", "__MACOSX"],
    "auto_scrape": False,
    "auto_bind": True,
    "language_mode": "any",
    "language": "chinese",
    "cache_mode": "auto",
    "allow_writeback": False,
    "allow_delete": False,
}


class MediaLibraryService:
    def __init__(self, settings: Settings, db: Database):
        self.settings = settings
        self.db = db
        self._source_lock = threading.Lock()
        self._ensure_managed_library()

    def _ensure_managed_library(self) -> None:
        root = str(self.settings.library_dir.resolve())
        managed = self.db.fetchone("SELECT id, root_path FROM media_libraries WHERE kind = 'managed' LIMIT 1")
        if managed:
            if managed["root_path"] != root:
                with self.db.connect() as conn:
                    conn.execute("UPDATE media_libraries SET root_path = ?, resolved_root_path = NULL WHERE id = ?", (root, managed["id"]))
                    conn.execute("""UPDATE work_files SET path = 'library/' ||
                                 (SELECT relative_path FROM library_items WHERE id = work_files.library_item_id)
                                 WHERE library_item_id IN (SELECT id FROM library_items WHERE library_id = ?)""", (managed["id"],))
        else:
            self.db.execute(
                "INSERT INTO media_libraries(name, root_path, kind, read_only, config_json) VALUES (?, ?, 'managed', 0, ?)",
                ("本地导入", root, json.dumps({**LIBRARY_DEFAULTS, "scan_interval_seconds": 300})),
            )

    def list(self, include_removed: bool = False) -> dict[str, Any]:
        rows = self.db.fetchall(
            """WITH stats AS (
                SELECT library_id, COUNT(*) AS item_count, COUNT(DISTINCT work_id) AS work_count,
                  SUM(status = 'error') AS error_count, SUM(status = 'pending') AS pending_count,
                  SUM(status = 'missing') AS missing_count,
                  SUM(scrape_status = 'review') AS scrape_review_count,
                  SUM(status='ready' AND scrape_status='pending') AS scrape_pending_count,
                  SUM(scrape_status='running') AS scrape_running_count,
                  SUM(scrape_status='error') AS scrape_error_count,
                  SUM(scrape_status IN ('completed', 'done')) AS scrape_completed_count,
                  MIN(CASE WHEN scrape_retry_at > 0 THEN scrape_retry_at END) AS scrape_retry_at
                  FROM library_items GROUP BY library_id
              ), active_scans AS (
                SELECT json_extract(target_json, '$.library_id') AS library_id, MAX(id) AS job_id
                FROM jobs WHERE type = 'library_scan' AND status IN ('queued', 'running', 'paused', 'cancelling')
                GROUP BY json_extract(target_json, '$.library_id')
              ) SELECT l.*, COALESCE(s.item_count, 0) AS item_count,
              CASE WHEN l.kind = 'managed' THEN (
                SELECT COUNT(DISTINCT work_id) FROM (
                  SELECT work_id FROM library_items WHERE library_id = l.id
                  UNION ALL SELECT work_id FROM work_files WHERE library_item_id IS NULL AND kind = 'source_cbz'
                    AND (path GLOB 'library/*' OR substr(path, 1, length(l.root_path) + 1) = l.root_path || '/')
                )
              ) ELSE COALESCE(s.work_count, 0) END AS work_count,
              COALESCE(s.error_count, 0) AS error_count, COALESCE(s.pending_count, 0) AS pending_count,
              COALESCE(s.missing_count, 0) AS missing_count, COALESCE(s.scrape_review_count, 0) AS scrape_review_count,
              j.id AS active_scan_job_id, j.status AS active_scan_status,
              COALESCE(s.scrape_pending_count, 0) AS scrape_pending_count,
              COALESCE(s.scrape_running_count, 0) AS scrape_running_count,
              COALESCE(s.scrape_error_count, 0) AS scrape_error_count,
              COALESCE(s.scrape_completed_count, 0) AS scrape_completed_count, s.scrape_retry_at,
              r.id AS scan_run_id, r.status AS scan_status, r.counts_json AS scan_counts_json,
              r.progress_json AS scan_progress_json, r.started_at AS scan_started_at,
              EXISTS(SELECT 1 FROM library_scan_runs r WHERE r.library_id = l.id AND r.status = 'running') AS scanning
              FROM media_libraries l LEFT JOIN stats s ON s.library_id = l.id
              LEFT JOIN active_scans a ON a.library_id = l.id LEFT JOIN jobs j ON j.id = a.job_id
              LEFT JOIN library_scan_runs r ON r.id=(SELECT MAX(id) FROM library_scan_runs WHERE library_id=l.id)
              WHERE (? OR removed_at IS NULL) ORDER BY kind <> 'managed', l.id""", (include_removed,),
        )
        return {
            "result": [self._public(row) for row in rows],
            "defaults": LIBRARY_DEFAULTS,
            "default_download_library_id": self.default_download_library()["id"],
        }

    def get(self, library_id: int, include_removed: bool = False) -> dict[str, Any]:
        row = self.db.fetchone("SELECT * FROM media_libraries WHERE id = ?", (library_id,))
        if not row or (row["removed_at"] and not include_removed):
            raise ValueError("目录库不存在")
        return self._public(row)

    def create(self, payload: dict[str, Any]) -> dict[str, Any]:
        name = self._name(payload.get("name"))
        kind = payload.get("kind", "local")
        if kind not in {"local", "mounted"}:
            raise ValueError("访问方式必须是本地目录或挂载目录")
        root = self._root(payload.get("root_path"))
        config = self._config(payload.get("config") or {})
        with self.db.connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            self._check_overlap(root)
            row = conn.execute(
                """INSERT INTO media_libraries(name, root_path, kind, enabled, read_only, config_json)
                VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(root_path) DO UPDATE SET name = excluded.name,
                kind = excluded.kind, enabled = excluded.enabled, read_only = excluded.read_only,
                config_json = excluded.config_json, removed_at = NULL, health = 'unknown', last_error = NULL,
                updated_at = CURRENT_TIMESTAMP WHERE media_libraries.removed_at IS NOT NULL RETURNING id""",
                (name, str(root), kind, int(bool(payload.get("enabled", True))),
                 int(bool(payload.get("read_only", True))), json.dumps(config, ensure_ascii=False)),
            ).fetchone()
            if not row:
                raise ValueError("该目录库已经存在")
            library_id = int(row["id"])
            conn.execute("UPDATE library_items SET status = 'pending', stable_since = 0 WHERE library_id = ? AND status = 'detached'", (library_id,))
        return self.get(library_id)

    def update(self, library_id: int, payload: dict[str, Any]) -> dict[str, Any]:
        current = self.get(library_id)
        name = self._name(payload.get("name", current["name"]))
        root = self._root(payload.get("root_path", current["root_path"]))
        kind = payload.get("kind", current["kind"])
        if current["kind"] == "managed" and (kind != "managed" or str(root) != current["root_path"]):
            raise ValueError("本地导入目录由应用管理")
        if current["kind"] != "managed" and kind not in {"local", "mounted"}:
            raise ValueError("访问方式必须是本地目录或挂载目录")
        config = self._config({**current["config"], **(payload.get("config") or {})})
        read_only = bool(payload.get("read_only", current["read_only"]))
        rescan = str(root) != current["root_path"] or kind != current["kind"] or (
            bool(payload.get("enabled", current["enabled"])) and not current["enabled"]
        ) or any(config[key] != current["config"][key] for key in (
            "recursive", "watch", "scan_interval_seconds", "stable_seconds", "include_hidden", "follow_symlinks", "exclude_patterns"))
        with self.db.connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            if str(root) != current["root_path"] or kind != current["kind"]:
                self._require_idle(library_id)
            self._check_overlap(root, library_id)
            conn.execute(
                """UPDATE media_libraries SET name = ?, root_path = ?, kind = ?, enabled = ?, read_only = ?,
                config_json = ?, health = 'unknown', last_error = NULL,
                next_scan_at = CASE WHEN ? THEN 0 ELSE next_scan_at END,
                scan_failures = CASE WHEN ? THEN 0 ELSE scan_failures END, updated_at = CURRENT_TIMESTAMP WHERE id = ?""",
                (name, str(root), kind, int(bool(payload.get("enabled", current["enabled"]))),
                 int(read_only), json.dumps(config, ensure_ascii=False), rescan, rescan, library_id),
            )
            if str(root) != current["root_path"]:
                conn.execute(
                    """UPDATE work_files SET path = ? || '/' ||
                    (SELECT relative_path FROM library_items WHERE id = work_files.library_item_id)
                    WHERE library_item_id IN (SELECT id FROM library_items WHERE library_id = ?)""",
                    (str(root), library_id),
                )
                conn.execute("UPDATE media_libraries SET root_device = NULL, root_inode = NULL, resolved_root_path = NULL WHERE id = ?", (library_id,))
                conn.execute("UPDATE library_items SET status = 'pending', stable_since = 0 WHERE library_id = ?", (library_id,))
            if any(config[key] != current["config"][key] for key in ("auto_scrape", "auto_bind", "language_mode", "language")):
                conn.execute("UPDATE library_items SET scrape_status = 'pending', scrape_retry_at = 0, scrape_attempts = 0 WHERE library_id = ?", (library_id,))
        return self.get(library_id)

    def remove(self, library_id: int) -> dict[str, Any]:
        library = self.get(library_id)
        if library["kind"] == "managed":
            raise ValueError("本地导入库不能移除")
        with self.db.connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            self._require_idle(library_id)
            conn.execute(
                "UPDATE media_libraries SET enabled = 0, removed_at = CURRENT_TIMESTAMP, health = 'removed' WHERE id = ?",
                (library_id,),
            )
            conn.execute("UPDATE library_items SET status = 'detached' WHERE library_id = ?", (library_id,))
        return {"removed": library_id, "source_files_deleted": False, "metadata_preserved": True}

    def _require_idle(self, library_id: int) -> None:
        if self.db.fetchone("SELECT 1 FROM source_renames WHERE library_id=? AND state IN ('prepared','blocked')", (library_id,)):
            raise ValueError("媒体库有未完成的重命名，请先恢复记录")
        if self.db.fetchone("""SELECT 1 FROM jobs WHERE type='reader_verify' AND status IN ('queued','running','paused','cancelling')
            AND json_extract(target_json,'$.source_library_id')=? LIMIT 1""", (library_id,)):
            raise ValueError("媒体库有作品正在核验，请结束后再修改")
        if self.db.fetchone("""SELECT 1 FROM jobs j, json_each(j.target_json, '$.plan') p
            WHERE j.type='library_migration' AND j.status IN ('queued','running','paused','cancelling')
            AND (json_extract(j.target_json, '$.library_id')=? OR json_extract(p.value, '$.source_library_id')=?) LIMIT 1""", (library_id, library_id)):
            raise ValueError("媒体库正在迁移，请结束任务后再修改")
        if self.db.fetchone("SELECT 1 FROM library_scan_runs WHERE library_id = ? AND status = 'running' LIMIT 1", (library_id,)):
            raise ValueError("目录库正在扫描，请先暂停自动检查或取消扫描任务")
        if self.db.fetchone("""SELECT id FROM jobs WHERE type = 'library_scan' AND status IN ('queued', 'running', 'paused', 'cancelling')
                            AND json_extract(target_json, '$.library_id') = ? LIMIT 1""", (library_id,)):
            raise ValueError("请先取消该库正在进行的扫描")

    def runs(self, library_id: int, limit: int = 20) -> dict[str, Any]:
        self.get(library_id, include_removed=True)
        rows = self.db.fetchall("SELECT * FROM library_scan_runs WHERE library_id = ? ORDER BY id DESC LIMIT ?", (library_id, max(1, min(limit, 100))))
        return {"result": [{**{key: value for key, value in row.items() if key not in {"counts_json", "errors_json", "progress_json"}},
                            "counts": json.loads(row["counts_json"]), "errors": json.loads(row["errors_json"]),
                            "progress": json.loads(row["progress_json"])} for row in rows]}

    def items(self, library_id: int, status: str = "all", page: int = 1, per_page: int = 50) -> dict[str, Any]:
        self.get(library_id, include_removed=True)
        page, per_page = max(1, page), max(1, min(100, per_page))
        where, params = "i.library_id = ?", [library_id]
        if status != "all":
            where += " AND i.status = ?"
            params.append(status)
        total = self.db.fetchone(f"SELECT COUNT(*) AS n FROM library_items i WHERE {where}", params)["n"]
        rows = self.db.fetchall(
            f"""SELECT i.id, i.library_id, i.relative_path, i.work_id, i.size_bytes, i.status,
            i.last_error, i.retry_at, i.indexed_at, i.missing_since, i.metadata_json, i.archive_info_json,
            COALESCE(w.pretty_title, w.title_japanese, w.title) AS work_title
            FROM library_items i LEFT JOIN works w ON w.id = i.work_id
            WHERE {where} ORDER BY i.relative_path LIMIT ? OFFSET ?""",
            [*params, per_page, (page - 1) * per_page],
        )
        result = []
        for row in rows:
            archived = self.archive_info(row)
            metadata = archived["comicinfo"]
            if archived.get("json"):
                metadata = {**metadata, "JSON": archived["json"]}
            result.append({**{key: value for key, value in row.items() if key not in {"metadata_json", "archive_info_json", "work_title"}},
                           "title": row["work_title"] or metadata.get("Title") or row["relative_path"],
                           "metadata": metadata})
        return {"result": result, "total": total, "page": page, "per_page": per_page}

    def forget_missing_item(self, library_id: int, item_id: int) -> dict[str, Any]:
        self.get(library_id, include_removed=True)
        with self.db.connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            self._require_idle(library_id)
            item = conn.execute(
                "SELECT id, relative_path, work_id, status FROM library_items WHERE id = ? AND library_id = ?",
                (item_id, library_id),
            ).fetchone()
            if not item:
                raise ValueError("缺失记录不存在")
            if item["status"] not in {"missing", "detached"}:
                raise ValueError("只能移除源文件已缺失或媒体库已移除的记录")
            conn.execute("DELETE FROM work_files WHERE library_item_id = ?", (item_id,))
            conn.execute("DELETE FROM library_changes WHERE library_id = ? AND relative_path = ?",
                         (library_id, item["relative_path"]))
            conn.execute("DELETE FROM library_items WHERE id = ?", (item_id,))
        return {"removed": item_id, "source_file_deleted": False,
                "work_id": item["work_id"], "work_metadata_preserved": item["work_id"] is not None}

    @staticmethod
    def can_modify(row: dict[str, Any], action: str) -> bool:
        if action not in {"writeback", "delete", "rename"}:
            raise ValueError("未知源文件操作")
        if (row.get("library_kind") or row.get("kind")) == "mounted":
            if action == "rename":
                config = json.loads(row.get("config_json") or "{}")
                return config.get("allow_writeback") is True and config.get("allow_delete") is True
            return json.loads(row.get("config_json") or "{}").get("allow_" + action) is True
        return not row["read_only"]

    def resolve_item(self, item_id: int, for_write: bool = False, action: str = "writeback") -> tuple[Path, dict[str, Any]]:
        row = self.db.fetchone(
            """SELECT i.*, l.root_path, l.resolved_root_path, l.kind, l.read_only, l.removed_at, l.config_json
            FROM library_items i JOIN media_libraries l ON l.id = i.library_id WHERE i.id = ?""", (item_id,),
        )
        if not row or row["removed_at"]:
            raise FileNotFoundError("作品源库已移除")
        if for_write and not self.can_modify(row, action):
            raise PermissionError("该目录库只读，不能修改源文件")
        root = self.validate_root(Path(row["root_path"]), self.root_boundaries(row["library_id"]))
        if row["resolved_root_path"] and str(root) != row["resolved_root_path"]:
            raise ValueError("库根目录已变化，请重新扫描")
        config = self._config(json.loads(row["config_json"]))
        return self.source_path(Path(row["root_path"]), row["relative_path"], config["follow_symlinks"]), row

    def source_file(self, work_id: int, available: bool = True, item_id: int | None = None) -> dict[str, Any] | None:
        ready = " AND (f.library_item_id IS NULL OR i.status = 'ready')" if available else ""
        selected = " AND f.library_item_id = ?" if item_id is not None else ""
        rows = self.db.fetchall(
            f"""SELECT f.*, i.manifest, i.status AS source_status, i.fingerprint,
            i.mtime_ns, i.device, i.inode, i.relative_path, l.id AS library_id,
            l.kind AS library_kind, l.root_path, l.resolved_root_path,
            CASE WHEN l.kind = 'mounted' THEN NOT (COALESCE(json_extract(l.config_json, '$.allow_writeback'), 0) OR COALESCE(json_extract(l.config_json, '$.allow_delete'), 0)) ELSE l.read_only END AS read_only, l.config_json
            FROM work_files f LEFT JOIN library_items i ON i.id = f.library_item_id
            LEFT JOIN media_libraries l ON l.id = i.library_id
            WHERE f.work_id = ? AND f.kind = 'source_cbz'
            AND (f.library_item_id IS NULL OR l.removed_at IS NULL){ready}{selected}
            ORDER BY f.library_item_id IS NULL DESC, l.kind = 'managed' DESC,
            l.kind = 'local' DESC, f.id DESC""", (work_id, item_id) if item_id is not None else (work_id,),
        )
        # Legacy managed paths can be stale; indexed sources need no filesystem probe.
        return next((row for row in rows if self.file_available(row)), rows[0] if rows else None)

    def files(self, work_id: int | None = None, metadata: bool = False) -> list[dict[str, Any]]:
        """File inventory without loading page manifests or touching source mounts."""
        rows = self.db.fetchall(
            "SELECT f.*," + (" i.metadata_json, i.archive_info_json," if metadata else "") + """ i.status AS source_status, i.mtime_ns, i.device, i.inode, i.fingerprint,
            l.id AS library_id, l.name AS library_name, l.kind AS library_kind,
            l.root_path, CASE WHEN l.kind = 'mounted' THEN NOT (COALESCE(json_extract(l.config_json, '$.allow_writeback'), 0) OR COALESCE(json_extract(l.config_json, '$.allow_delete'), 0)) ELSE COALESCE(l.read_only,
              (SELECT read_only FROM media_libraries WHERE kind = 'managed'), 1) END AS read_only,
            l.removed_at, l.config_json
            FROM work_files f LEFT JOIN library_items i ON i.id = f.library_item_id
            LEFT JOIN media_libraries l ON l.id = i.library_id"""
            + (" WHERE f.work_id = ?" if work_id is not None else "")
            + """ ORDER BY f.work_id, (f.library_item_id IS NULL OR (i.status = 'ready' AND l.removed_at IS NULL)) DESC,
            f.library_item_id IS NULL DESC, l.kind = 'managed' DESC,
            l.kind = 'local' DESC, f.id DESC""", (work_id,) if work_id is not None else (),
        )
        return sorted(rows, key=lambda row: (row["work_id"], not self.file_available(row)))

    @staticmethod
    def file_available(row: dict[str, Any]) -> bool:
        if row.get("library_item_id"):
            return row.get("source_status") == "ready" and not row.get("removed_at")
        try:
            return Path(row["path"]).is_file()
        except OSError:
            return False

    @staticmethod
    def archive_info(row: dict[str, Any]) -> dict[str, Any]:
        values = []
        for key in ("metadata_json", "archive_info_json"):
            try:
                value = json.loads(row.get(key) or "{}")
            except (ValueError, TypeError):
                value = {}
            values.append(value if isinstance(value, dict) else {})
        return {**values[1], "comicinfo": values[0]}

    def root_boundaries(self, library_id: int) -> list[dict[str, Any]]:
        # Stored resolved roots avoid probing other mounts during validation.
        rows = self.db.fetchall("SELECT root_path, resolved_root_path, root_device, root_inode FROM media_libraries WHERE id <> ? AND removed_at IS NULL", (library_id,))
        roots = [{"path": value, "device": row["root_device"], "inode": row["root_inode"]}
                 for row in rows for value in (row["root_path"], row["resolved_root_path"]) if value]
        for path in (self.settings.covers_dir, self.settings.thumbs_dir, self.settings.page_cache_dir,
                     self.settings.tmp_dir, self.settings.data_dir / "cache", self.settings.export_dir):
            info = path.stat()
            roots.append({"path": str(path.resolve()), "device": sqlite_file_id(info.st_dev), "inode": sqlite_file_id(info.st_ino)})
        return roots

    @staticmethod
    def validate_root(root: Path, boundaries: list[dict[str, Any]]) -> Path:
        canonical = root.resolve(strict=True)
        info = canonical.stat()
        for value in boundaries:
            boundary = Path(value["path"])
            same_directory = sqlite_file_id(info.st_ino) and (sqlite_file_id(info.st_dev), sqlite_file_id(info.st_ino)) == (value["device"], value["inode"])
            if same_directory or canonical == boundary or canonical in boundary.parents or boundary in canonical.parents:
                raise ValueError("库目录别名与已有媒体库或应用缓存重叠")
        if any(canonical == Path(value) or Path(value) in canonical.parents for value in ("/proc", "/sys", "/dev")):
            raise ValueError("不能扫描系统目录")
        return canonical

    def resolve_file(self, row: dict[str, Any], for_write: bool = False, action: str = "writeback") -> Path:
        if row["library_item_id"]:
            return self.resolve_item(row["library_item_id"], for_write, action)[0]
        path = Path(row["path"]).resolve()
        if for_write:
            managed = self.db.fetchone("SELECT * FROM media_libraries WHERE kind = 'managed'")
            if managed["read_only"]:
                raise PermissionError("该目录库只读，不能修改源文件")
            if self.settings.library_dir.resolve() not in path.parents:
                raise PermissionError("源文件不在受管 library 目录内")
        return path

    def managed_write_root(self) -> Path:
        row = self.db.fetchone("SELECT id, read_only FROM media_libraries WHERE kind = 'managed'")
        if row["read_only"]:
            raise PermissionError("本地导入库只读，不能导入作品")
        return self.validate_root(self.settings.library_dir, self.root_boundaries(row["id"]))

    def default_download_library(self) -> dict[str, Any]:
        setting = self.db.fetchone("SELECT value FROM settings WHERE key = 'downloads.default_library_id'")
        try:
            selected = self.get(int(setting["value"]), include_removed=True) if setting else None
        except (TypeError, ValueError):
            selected = None
        if selected:
            return selected
        managed = self.db.fetchone("SELECT id FROM media_libraries WHERE kind = 'managed'")
        return self.get(int(managed["id"]))

    def download_write_root(self, library_id: int | None = None) -> tuple[dict[str, Any], Path]:
        library = self.get(library_id) if library_id is not None else self.default_download_library()
        if library["removed_at"]:
            raise ValueError("默认下载媒体库已移除，请重新选择")
        if not library["enabled"]:
            raise ValueError("默认下载媒体库已暂停")
        if library["read_only"]:
            raise PermissionError("默认下载媒体库只读，不能导入作品")
        root = self.validate_root(Path(library["root_path"]), self.root_boundaries(library["id"]))
        info = root.stat()
        if library["resolved_root_path"] and str(root) != library["resolved_root_path"]:
            raise ValueError("默认下载媒体库根目录已变化，请先扫描")
        if library["root_device"] is not None and (sqlite_file_id(info.st_dev), sqlite_file_id(info.st_ino)) != (library["root_device"], library["root_inode"]):
            raise ValueError("默认下载媒体库版本已变化，请先扫描")
        return library, root

    @staticmethod
    def source_path(root: Path, relative: str, follow_symlinks: bool = False) -> Path:
        parts = PurePosixPath(relative).parts
        if not parts or PurePosixPath(relative).is_absolute() or any(part in {"..", "."} for part in parts) or "\\" in relative or "\x00" in relative:
            raise ValueError("源文件路径不在目录库内")
        candidate = root.joinpath(*parts)
        if not follow_symlinks:
            current = root
            for part in parts:
                current /= part
                if current.is_symlink():
                    raise ValueError("源文件符号链接未启用")
        resolved_root, resolved = root.resolve(), candidate.resolve()
        if resolved != resolved_root and resolved_root not in resolved.parents:
            raise ValueError("源文件符号链接指向目录库外")
        return resolved

    @staticmethod
    def _name(value: Any) -> str:
        if not isinstance(value, str) or not 1 <= len(value.strip()) <= 100:
            raise ValueError("请输入1至100字的库名")
        return value.strip()

    @staticmethod
    def _root(value: Any) -> Path:
        if not isinstance(value, str) or not value.strip() or "\x00" in value:
            raise ValueError("请输入应用内的绝对目录路径")
        path = Path(value.strip()).expanduser()
        if not path.is_absolute():
            raise ValueError("请输入应用内的绝对目录路径")
        path = Path(os.path.abspath(path))
        if path == Path("/") or any(path == Path(p) or Path(p) in path.parents for p in ("/proc", "/sys", "/dev")):
            raise ValueError("不能扫描系统目录")
        # Registration is lexical; the bounded scan checks directory/mount health.
        return path

    def _check_overlap(self, root: Path, library_id: int | None = None) -> None:
        for library in self.db.fetchall("SELECT id, name, root_path FROM media_libraries WHERE removed_at IS NULL"):
            if library["id"] == library_id:
                continue
            existing = Path(library["root_path"])
            if root == existing or root in existing.parents or existing in root.parents:
                raise ValueError(f"该目录与“{library['name']}”重叠")
        data_root = self.settings.data_dir.resolve()
        if root == data_root or root in data_root.parents:
            raise ValueError("库根目录不能包含应用数据与缓存")
        for owned in (self.settings.covers_dir, self.settings.thumbs_dir, self.settings.page_cache_dir,
                      self.settings.tmp_dir, self.settings.data_dir / "cache", self.settings.export_dir):
            owned = owned.resolve()
            if root == owned or owned in root.parents or root in owned.parents:
                raise ValueError("不能将应用缓存、封面或导出目录注册为媒体库")

    @staticmethod
    def _config(value: dict[str, Any]) -> dict[str, Any]:
        if not isinstance(value, dict) or set(value) - set(LIBRARY_DEFAULTS):
            raise ValueError("目录库配置包含未知选项")
        result = {**LIBRARY_DEFAULTS, **value}
        for key in ("recursive", "watch", "include_hidden", "follow_symlinks", "auto_scrape", "auto_bind", "allow_writeback", "allow_delete"):
            if not isinstance(result[key], bool):
                raise ValueError(f"{key}必须是开关")
        for key, lower, upper in (("scan_interval_seconds", 10, 86400), ("stable_seconds", 0, 600), ("io_timeout_seconds", 5, 600)):
            if isinstance(result[key], bool) or not isinstance(result[key], int) or not lower <= result[key] <= upper:
                raise ValueError(f"{key}必须在{lower}至{upper}之间")
        for key, options in (("language_mode", {"any", "strict", "prefer"}), ("language", {"chinese", "japanese", "english"}), ("cache_mode", {"auto", "always", "off"})):
            if not isinstance(result[key], str) or result[key] not in options:
                raise ValueError(f"{key}选项无效")
        patterns = result["exclude_patterns"]
        if not isinstance(patterns, list) or len(patterns) > 40 or any(not isinstance(p, str) or not p or len(p) > 256 for p in patterns):
            raise ValueError("排除规则最多40项，每项1至256字")
        return result

    def _public(self, row: dict[str, Any]) -> dict[str, Any]:
        return {**{key: value for key, value in row.items() if key not in {"config_json", "scan_counts_json", "scan_progress_json"}},
                **({"scan_counts": json.loads(row["scan_counts_json"] or "{}"),
                    "scan_progress": json.loads(row["scan_progress_json"] or "{}")}
                   if "scan_run_id" in row else {}),
                **({"scanning": bool(row["scanning"])} if "scanning" in row else {}),
                "enabled": bool(row["enabled"]), "read_only": bool(row["read_only"]),
                "config": self._config(json.loads(row["config_json"]))}
