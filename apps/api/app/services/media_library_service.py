from __future__ import annotations

import json
import os
from pathlib import Path, PurePosixPath
from typing import Any

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
}


class MediaLibraryService:
    def __init__(self, settings: Settings, db: Database):
        self.settings = settings
        self.db = db
        self._ensure_managed_library()

    def _ensure_managed_library(self) -> None:
        root = str(self.settings.library_dir.resolve())
        managed = self.db.fetchone("SELECT id, root_path FROM media_libraries WHERE kind = 'managed' LIMIT 1")
        if managed:
            if managed["root_path"] != root:
                with self.db.connect() as conn:
                    conn.execute("UPDATE media_libraries SET root_path = ? WHERE id = ?", (root, managed["id"]))
                    conn.execute("""UPDATE work_files SET path = 'library/' ||
                                 (SELECT relative_path FROM library_items WHERE id = work_files.library_item_id)
                                 WHERE library_item_id IN (SELECT id FROM library_items WHERE library_id = ?)""", (managed["id"],))
        else:
            self.db.execute(
                "INSERT INTO media_libraries(name, root_path, kind, read_only, config_json) VALUES (?, ?, 'managed', 0, ?)",
                ("本地导入", root, json.dumps({**LIBRARY_DEFAULTS, "scan_interval_seconds": 300})),
            )

    def list(self) -> dict[str, Any]:
        rows = self.db.fetchall(
            """WITH stats AS (
                SELECT library_id, COUNT(*) AS item_count, COUNT(DISTINCT work_id) AS work_count,
                  SUM(status = 'error') AS error_count FROM library_items GROUP BY library_id
              ) SELECT l.*, COALESCE(s.item_count, 0) AS item_count,
              CASE WHEN l.kind = 'managed' THEN (
                SELECT COUNT(DISTINCT work_id) FROM (
                  SELECT work_id FROM library_items WHERE library_id = l.id
                  UNION ALL SELECT work_id FROM work_files WHERE library_item_id IS NULL AND kind = 'source_cbz'
                    AND (path GLOB 'library/*' OR substr(path, 1, length(l.root_path) + 1) = l.root_path || '/')
                )
              ) ELSE COALESCE(s.work_count, 0) END AS work_count,
              COALESCE(s.error_count, 0) AS error_count
              FROM media_libraries l LEFT JOIN stats s ON s.library_id = l.id
              WHERE removed_at IS NULL ORDER BY kind <> 'managed', l.id"""
        )
        return {"result": [self._public(row) for row in rows]}

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
                 int(kind == "mounted" or bool(payload.get("read_only", True))), json.dumps(config, ensure_ascii=False)),
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
        read_only = kind == "mounted" or bool(payload.get("read_only", current["read_only"]))
        with self.db.connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            if str(root) != current["root_path"] or kind != current["kind"]:
                self._require_idle(library_id)
            self._check_overlap(root, library_id)
            conn.execute(
                """UPDATE media_libraries SET name = ?, root_path = ?, kind = ?, enabled = ?, read_only = ?,
                config_json = ?, health = 'unknown', last_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?""",
                (name, str(root), kind, int(bool(payload.get("enabled", current["enabled"]))),
                 int(read_only), json.dumps(config, ensure_ascii=False), library_id),
            )
            if str(root) != current["root_path"]:
                conn.execute(
                    """UPDATE work_files SET path = ? || '/' ||
                    (SELECT relative_path FROM library_items WHERE id = work_files.library_item_id)
                    WHERE library_item_id IN (SELECT id FROM library_items WHERE library_id = ?)""",
                    (str(root), library_id),
                )
                conn.execute("UPDATE media_libraries SET root_device = NULL, root_inode = NULL WHERE id = ?", (library_id,))
                conn.execute("UPDATE library_items SET status = 'pending', stable_since = 0 WHERE library_id = ?", (library_id,))
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
        if self.db.fetchone("""SELECT id FROM jobs WHERE type = 'library_scan' AND status IN ('queued', 'running', 'paused', 'cancelling')
                            AND json_extract(target_json, '$.library_id') = ? LIMIT 1""", (library_id,)):
            raise ValueError("请先取消该库正在进行的扫描")

    def runs(self, library_id: int, limit: int = 20) -> dict[str, Any]:
        self.get(library_id)
        rows = self.db.fetchall("SELECT * FROM library_scan_runs WHERE library_id = ? ORDER BY id DESC LIMIT ?", (library_id, max(1, min(limit, 100))))
        return {"result": [{**{key: value for key, value in row.items() if key not in {"counts_json", "errors_json"}},
                            "counts": json.loads(row["counts_json"]), "errors": json.loads(row["errors_json"])} for row in rows]}

    def items(self, library_id: int, status: str = "all", page: int = 1, per_page: int = 50) -> dict[str, Any]:
        self.get(library_id)
        page, per_page = max(1, page), max(1, min(100, per_page))
        where, params = "library_id = ?", [library_id]
        if status != "all":
            where += " AND status = ?"
            params.append(status)
        total = self.db.fetchone(f"SELECT COUNT(*) AS n FROM library_items WHERE {where}", params)["n"]
        rows = self.db.fetchall(
            f"""SELECT id, library_id, relative_path, work_id, size_bytes, status, last_error, retry_at, indexed_at
            FROM library_items WHERE {where} ORDER BY relative_path LIMIT ? OFFSET ?""",
            [*params, per_page, (page - 1) * per_page],
        )
        return {"result": rows, "total": total, "page": page, "per_page": per_page}

    def resolve_item(self, item_id: int, for_write: bool = False) -> tuple[Path, dict[str, Any]]:
        row = self.db.fetchone(
            """SELECT i.*, l.root_path, l.kind, l.read_only, l.removed_at, l.config_json
            FROM library_items i JOIN media_libraries l ON l.id = i.library_id WHERE i.id = ?""", (item_id,),
        )
        if not row or row["removed_at"]:
            raise FileNotFoundError("作品源库已移除")
        if for_write and (row["read_only"] or row["kind"] == "mounted"):
            raise PermissionError("该目录库只读，不能修改源文件")
        config = self._config(json.loads(row["config_json"]))
        return self.source_path(Path(row["root_path"]), row["relative_path"], config["follow_symlinks"]), row

    def source_file(self, work_id: int, available: bool = True, item_id: int | None = None) -> dict[str, Any] | None:
        ready = " AND (f.library_item_id IS NULL OR i.status = 'ready')" if available else ""
        selected = " AND f.library_item_id = ?" if item_id is not None else ""
        return self.db.fetchone(
            f"""SELECT f.*, i.manifest, i.status AS source_status, i.fingerprint,
            i.mtime_ns, i.device, i.inode, i.relative_path, l.id AS library_id,
            l.kind AS library_kind, l.root_path, l.read_only, l.config_json
            FROM work_files f LEFT JOIN library_items i ON i.id = f.library_item_id
            LEFT JOIN media_libraries l ON l.id = i.library_id
            WHERE f.work_id = ? AND f.kind = 'source_cbz'
            AND (f.library_item_id IS NULL OR l.removed_at IS NULL){ready}{selected}
            ORDER BY f.library_item_id IS NULL DESC, l.kind = 'managed' DESC,
            l.kind = 'local' DESC, f.id DESC LIMIT 1""", (work_id, item_id) if item_id is not None else (work_id,),
        )

    def resolve_file(self, row: dict[str, Any], for_write: bool = False) -> Path:
        if row["library_item_id"]:
            return self.resolve_item(row["library_item_id"], for_write)[0]
        path = Path(row["path"]).resolve()
        if for_write:
            managed = self.db.fetchone("SELECT * FROM media_libraries WHERE kind = 'managed'")
            if managed["read_only"]:
                raise PermissionError("该目录库只读，不能修改源文件")
            if self.settings.library_dir.resolve() not in path.parents:
                raise PermissionError("源文件不在受管 library 目录内")
        return path

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
        for key in ("recursive", "watch", "include_hidden", "follow_symlinks", "auto_scrape", "auto_bind"):
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
        return {**{key: value for key, value in row.items() if key != "config_json"},
                "enabled": bool(row["enabled"]), "read_only": bool(row["read_only"]),
                "config": self._config(json.loads(row["config_json"]))}
