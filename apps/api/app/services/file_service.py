from __future__ import annotations

import json
import time
from contextlib import nullcontext
from pathlib import Path
from typing import Any

from app.config import Settings
from app.database import Database
from app.services.media_library_service import MediaLibraryService
from app.services.archive_cache_service import ArchiveCacheService


class FileMaintenanceService:
    """Catalogue inventory and permission-checked deletion; never calls NH API."""

    def __init__(self, db: Database, settings: Settings, cache: ArchiveCacheService | None = None):
        self.db = db
        self.settings = settings
        self.settings.ensure_directories()
        self.libraries = MediaLibraryService(settings, db)
        self.cache = cache

    # --- path helpers -------------------------------------------------
    def _abs(self, path: str | None) -> Path | None:
        if not path:
            return None
        p = Path(path)
        if not p.is_absolute():
            p = Path.cwd() / p
        return p.resolve()

    def _managed_roots(self) -> list[Path]:
        return [
            self.settings.library_dir.resolve(),
            self.settings.covers_dir.resolve(),
            self.settings.tmp_dir.resolve(),
            self.settings.export_dir.resolve(),
            self.settings.thumbs_dir.resolve(),
            self.settings.page_cache_dir.resolve(),
            self.settings.archive_cache_dir.resolve(),
        ]

    def _within_managed(self, path: Path | None) -> bool:
        if path is None:
            return False
        rp = path.resolve()
        return any(rp == root or root in rp.parents for root in self._managed_roots())

    def _loose_files(self, directory: Path) -> list[Path]:
        d = directory.resolve()
        if not d.is_dir():
            return []
        return [p.resolve() for p in sorted(d.iterdir()) if p.is_file()]

    # --- scanning -----------------------------------------------------
    def _scan(self) -> list[dict[str, Any]]:
        entries: list[dict[str, Any]] = []
        referenced_sources: set[str] = set()
        referenced_covers: set[str] = set()
        source_files: dict[int, dict[str, Any]] = {}
        for row in self.libraries.files():
            if row["kind"] == "source_cbz":
                # Include every managed source in orphan protection, even duplicates.
                if not row["library_item_id"] or row["library_kind"] == "managed":
                    referenced_sources.add(str(self._abs(row["path"])))
                source_files.setdefault(int(row["work_id"]), row)

        for w in self.db.fetchall("SELECT * FROM works ORDER BY updated_at DESC, id DESC"):
            work_id = int(w["id"])
            frow = source_files.get(work_id)
            # Indexed paths/status/size come from SQLite, including offline mounts.
            indexed = bool(frow and frow["library_item_id"])
            src_abs = Path(frow["path"]) if indexed else self._abs(frow["path"]) if frow else None
            src_exists = bool(frow and self.libraries.file_available(frow))
            db_size = int(frow["size_bytes"]) if frow else 0
            src_size = db_size if indexed else src_abs.stat().st_size if src_exists else 0

            cover_abs = self._abs(w.get("cover_path"))
            if cover_abs:
                referenced_covers.add(str(cover_abs))
            cover_exists = bool(cover_abs and cover_abs.is_file())
            cover_size = cover_abs.stat().st_size if cover_exists else 0

            flags: list[str] = []
            if not src_exists:
                flags.append("missing_source")
            if not cover_exists:
                flags.append("missing_cover")
            if src_exists and db_size and db_size != src_size:
                flags.append("size_mismatch")
            status = "missing_source" if not src_exists else ("missing_cover" if not cover_exists else "ok")

            entries.append(
                {
                    "kind": "work",
                    "id": f"work-{work_id}",
                    "work_id": work_id,
                    "title": w.get("pretty_title") or w.get("title") or w.get("title_japanese") or f"work-{work_id}",
                    "source_path": str(src_abs) if src_abs else None,
                    "cover_path": str(cover_abs) if cover_abs else None,
                    "source_bytes": src_size,
                    "size_bytes": src_size + cover_size,
                    "page_count": int(w.get("page_count") or 0),
                    "source": w.get("source"),
                    "remote_gallery_id": w.get("remote_gallery_id"),
                    "updated_at": w.get("updated_at"),
                    "status": status,
                    "flags": flags,
                    "source_status": frow.get("source_status") if frow else None,
                    "library_id": frow.get("library_id") if frow else None,
                    "library_name": frow.get("library_name") if frow else None,
                    "read_only": bool(frow and frow.get("read_only")),
                }
            )

        for p in self._loose_files(self.settings.library_dir):
            if str(p) not in referenced_sources:
                entries.append(self._loose_entry(p, "orphan", "library"))
        for p in self._loose_files(self.settings.covers_dir):
            if str(p) not in referenced_covers:
                entries.append(self._loose_entry(p, "orphan", "covers"))
        active_tmp_paths = self._active_import_tmp_paths()
        for p in self._loose_files(self.settings.tmp_dir):
            if str(p) in active_tmp_paths:
                continue
            entries.append(self._loose_entry(p, "stale", "tmp"))
        for p in self._loose_files(self.settings.export_dir):
            entries.append(self._loose_entry(p, "stale", "exports"))

        return entries

    def _active_import_tmp_paths(self) -> set[str]:
        paths: set[str] = set()
        rows = self.db.fetchall(
            """
            SELECT target_json
            FROM jobs
            WHERE type = 'remote_import' AND status IN ('queued', 'running', 'paused', 'cancelling')
            """
        )
        for row in rows:
            try:
                target = json.loads(row.get("target_json") or "{}")
            except (json.JSONDecodeError, TypeError):
                continue
            if not isinstance(target, dict):
                continue
            gallery_id = target.get("gallery_id")
            try:
                gallery_id = int(gallery_id) if gallery_id else None
            except (TypeError, ValueError):
                continue
            if gallery_id is not None:
                paths.add(str((self.settings.tmp_dir / f"nhentai-{gallery_id}.cbz").resolve()))
        return paths

    def _loose_entry(self, path: Path, kind: str, directory: str) -> dict[str, Any]:
        size = path.stat().st_size if path.is_file() else 0
        return {
            "kind": kind,
            "id": f"{kind}-{path}",
            "path": str(path),
            "name": path.name,
            "size_bytes": size,
            "dir": directory,
            "status": kind,
            "flags": [kind],
        }

    # --- public reads -------------------------------------------------
    def overview(self) -> dict[str, Any]:
        entries = self._scan()
        works = [e for e in entries if e["kind"] == "work"]
        orphans = [e for e in entries if e["kind"] == "orphan"]
        stale = [e for e in entries if e["kind"] == "stale"]
        orphan_bytes = sum(e["size_bytes"] for e in orphans)
        stale_bytes = sum(e["size_bytes"] for e in stale)
        return {
            "work_count": len(works),
            "source_bytes": sum(e.get("source_bytes", 0) for e in works),
            "cover_ok": sum(1 for e in works if "missing_cover" not in e["flags"]),
            "missing_source": sum(1 for e in works if "missing_source" in e["flags"]),
            "missing_cover": sum(1 for e in works if "missing_cover" in e["flags"]),
            "orphan_count": len(orphans),
            "orphan_bytes": orphan_bytes,
            "stale_count": len(stale),
            "stale_bytes": stale_bytes,
            "reclaimable_bytes": orphan_bytes + stale_bytes,
        }

    def inventory(
        self,
        category: str = "all",
        q: str | None = None,
        status: str | None = None,
        sort: str = "default",
        page: int = 1,
        per_page: int = 50,
    ) -> dict[str, Any]:
        entries = self._scan()
        if category in ("work", "orphan", "stale"):
            entries = [e for e in entries if e["kind"] == category]
        if status:
            # Match the single status field OR any computed flag, so flag-only
            # conditions like size_mismatch (whose status may still be "ok") are filterable.
            entries = [e for e in entries if e["status"] == status or status in e.get("flags", [])]
        if q:
            ql = q.strip().lower()
            entries = [
                e
                for e in entries
                if ql in (e.get("title") or "").lower()
                or ql in (e.get("source_path") or e.get("path") or "").lower()
                or ql in (e.get("name") or "").lower()
            ]
        if sort == "size_desc":
            entries.sort(key=lambda e: e.get("size_bytes", 0), reverse=True)
        elif sort == "size_asc":
            entries.sort(key=lambda e: e.get("size_bytes", 0))
        total = len(entries)
        per_page = max(1, min(int(per_page or 50), 500))
        page = max(1, int(page or 1))
        start = (page - 1) * per_page
        result = entries[start : start + per_page]
        tags_by_work = self._tags_for_works(
            [int(entry["work_id"]) for entry in result if entry["kind"] == "work"]
        )
        for entry in result:
            if entry["kind"] == "work":
                tag_items = tags_by_work.get(int(entry["work_id"]), [])
                entry["tag_items"] = tag_items
                entry["tags"] = [tag["display"] for tag in tag_items]
        return {"result": result, "total": total, "page": page, "per_page": per_page}

    def _tags_for_works(self, work_ids: list[int], limit: int = 12) -> dict[int, list[dict[str, Any]]]:
        if not work_ids:
            return {}
        placeholders = ",".join("?" for _ in work_ids)
        rows = self.db.fetchall(
            f"""
            SELECT wt.work_id, wt.remote_tag_id AS id, wt.tag_type AS type, wt.remote_name AS name,
                   wt.remote_slug AS slug,
                   COALESCE(d.zh_name, wt.remote_name, wt.remote_slug) AS display
            FROM work_tags wt
            LEFT JOIN local_tag_dictionary d ON d.id = wt.dictionary_id
            WHERE wt.work_id IN ({placeholders})
            ORDER BY wt.work_id, wt.id
            """,
            work_ids,
        )
        grouped: dict[int, list[dict[str, Any]]] = {}
        for row in rows:
            work_id = int(row.pop("work_id"))
            if row.get("display") and len(grouped.setdefault(work_id, [])) < limit:
                grouped[work_id].append(row)
        return grouped

    def duplicates(self) -> dict[str, Any]:
        """Real duplicate detection over stored source files and gallery ids.

        ``hash`` groups identical source CBZs by ``work_files.sha256``. ``gallery_id``
        groups works sharing a remote gallery id. ``title_similar`` is not
        implemented and stays ``None`` so the UI shows a 未接入 boundary instead of a
        fabricated count.
        """
        hash_rows = self.db.fetchall(
            "SELECT sha256, COUNT(*) AS c FROM work_files "
            "WHERE kind='source_cbz' AND sha256 IS NOT NULL AND sha256 <> '' "
            "GROUP BY sha256 HAVING c > 1"
        )
        gid_rows = self.db.fetchall(
            "SELECT remote_gallery_id, COUNT(*) AS c FROM works "
            "WHERE remote_gallery_id IS NOT NULL GROUP BY remote_gallery_id HAVING c > 1"
        )
        return {
            "hash": {"groups": len(hash_rows), "files": sum(int(r["c"]) for r in hash_rows)},
            "gallery_id": {"groups": len(gid_rows), "works": sum(int(r["c"]) for r in gid_rows)},
            "title_similar": None,
        }

    # --- preview_delete cascade analysis (read-only) ----------------------
    def _work_files(self, work_id: int) -> list[tuple[Path, dict[str, Any] | None]]:
        if self.db.fetchone("""SELECT 1 FROM jobs WHERE type = 'remote_import'
            AND status IN ('queued', 'running', 'paused', 'cancelling')
            AND CASE WHEN json_valid(target_json) THEN json_extract(target_json, '$.gallery_id') END =
            (SELECT remote_gallery_id FROM works WHERE id = ?) LIMIT 1""", (work_id,)):
            raise PermissionError("作品正在导入，请结束任务后再删除")
        if self.db.fetchone("""SELECT 1 FROM archive_cache c WHERE c.work_id = ? AND
            (c.status IN ('queued', 'downloading', 'blocked') OR EXISTS
            (SELECT 1 FROM archive_cache_leases l WHERE l.cache_id = c.id AND l.expires_at > ?)) LIMIT 1""", (work_id, time.time())):
            raise PermissionError("作品正在准备或阅读，请结束后再删除")
        if self.db.fetchone("""SELECT 1 FROM jobs WHERE type = 'archive_cache'
            AND status IN ('queued', 'running', 'paused', 'cancelling')
            AND CASE WHEN json_valid(target_json) THEN json_extract(target_json, '$.work_id') END = ? LIMIT 1""", (work_id,)):
            raise PermissionError("作品正在准备阅读，请先取消任务")
        paths: list[tuple[Path, dict[str, Any] | None]] = []
        rows = self.libraries.files(work_id)
        managed_id = self.db.fetchone("SELECT id FROM media_libraries WHERE kind = 'managed'")["id"]
        library_ids = {row["library_id"] or managed_id for row in rows if row["kind"] == "source_cbz"}
        if library_ids and self.db.fetchone(f"""SELECT 1 FROM jobs WHERE type = 'library_scan'
            AND status IN ('queued', 'running', 'paused', 'cancelling') AND
            CASE WHEN json_valid(target_json) THEN json_extract(target_json, '$.library_id') END IN ({','.join('?' for _ in library_ids)}) LIMIT 1""", tuple(library_ids)):
            raise PermissionError("目录库正在扫描，请结束扫描后再删除")
        for row in rows:
            source = row if row["kind"] == "source_cbz" else None
            ap = self.libraries.resolve_file(row, for_write=True) if source else self._abs(row["path"])
            if ap is not None:
                paths.append((ap, source))
        cover = self.db.fetchone("SELECT cover_path FROM works WHERE id=?", (work_id,))
        cover_abs = self._abs(cover["cover_path"]) if cover else None
        if cover_abs is not None:
            paths.append((cover_abs, None))
        for directory in (self.settings.thumbs_dir, self.settings.page_cache_dir):
            paths.extend((p.resolve(), None) for p in directory.glob(f"{work_id}-*"))
        for row in self.db.fetchall("SELECT id FROM archive_cache WHERE work_id = ?", (work_id,)):
            paths.extend((self.settings.archive_cache_dir / f"{row['id']}.{suffix}", None) for suffix in ("cbz", "part"))
        # de-dupe preserving order
        seen: set[str] = set()
        unique: list[tuple[Path, dict[str, Any] | None]] = []
        for p, source in paths:
            if not source and not self._within_managed(p):
                raise PermissionError("关联文件不在应用管理目录内")
            portable = self.db.managed_path(p)
            if self.db.fetchone("""SELECT 1 FROM work_files WHERE work_id <> ? AND path IN (?, ?)
                UNION ALL SELECT 1 FROM works WHERE id <> ? AND cover_path IN (?, ?) LIMIT 1""",
                (work_id, str(p), portable, work_id, str(p), portable)):
                raise PermissionError("文件被其他作品引用，不能删除")
            if str(p) not in seen:
                seen.add(str(p))
                unique.append((p, source))
        return unique

    def _preview_work(self, work_id: int) -> dict[str, Any]:
        row = self.db.fetchone("SELECT * FROM works WHERE id=?", (work_id,))
        if not row:
            return {"kind": "work", "work_id": work_id, "exists": False, "files": [],
                    "work_tags": 0, "has_progress": False, "has_governance": False,
                    "reclaim_bytes": 0, "warnings": ["already_gone"], "status": "already_gone"}
        work_tags = self.db.fetchone("SELECT COUNT(*) AS n FROM work_tags WHERE work_id=?", (work_id,))["n"]
        has_progress = self.db.fetchone("SELECT 1 FROM reader_progress WHERE work_id=?", (work_id,)) is not None
        has_governance = self.db.fetchone(
            """
            SELECT 1 FROM work_metadata WHERE work_id = ?
            UNION ALL
            SELECT 1 FROM governance_reviews WHERE work_id = ?
            LIMIT 1
            """,
            (work_id, work_id),
        ) is not None
        try:
            files = self._work_files(work_id)
            existing = [p for p, _source in files if p.is_file()]
            reclaim = sum(p.stat().st_size for p in existing)
        except (OSError, ValueError) as exc:
            return {"kind": "work", "work_id": work_id, "title": row.get("pretty_title") or row.get("title"),
                    "exists": True, "files": [], "work_tags": int(work_tags), "has_progress": has_progress,
                    "has_governance": has_governance, "reclaim_bytes": 0, "warnings": [str(exc)], "status": "forbidden"}
        warnings: list[str] = []
        if has_progress:
            warnings.append("has_progress")
        if has_governance:
            warnings.append("has_governance")
        return {
            "kind": "work",
            "work_id": work_id,
            "title": row.get("pretty_title") or row.get("title_japanese") or row.get("title") or f"work-{work_id}",
            "exists": True,
            "files": [str(p) for p in existing],
            "work_tags": int(work_tags),
            "has_progress": has_progress,
            "has_governance": has_governance,
            "reclaim_bytes": reclaim,
            "warnings": warnings,
            "status": "ready",
        }

    def _preview_loose(self, kind: str, path_str: str) -> dict[str, Any]:
        ap = self._abs(path_str)
        roots = (self.settings.library_dir, self.settings.covers_dir) if kind == "orphan" else (self.settings.tmp_dir, self.settings.export_dir)
        if not ap or ap.parent not in {p.resolve() for p in roots}:
            return {"kind": kind, "path": path_str, "exists": False, "reclaim_bytes": 0,
                    "warnings": ["forbidden_path"], "status": "forbidden"}
        portable = self.db.managed_path(ap)
        if ap.parent in {self.settings.library_dir.resolve(), self.settings.covers_dir.resolve()} and self.db.fetchone("""SELECT 1 FROM jobs
            WHERE type IN ('library_scan', 'remote_import') AND status IN ('queued', 'running', 'paused', 'cancelling') LIMIT 1"""):
            return {"kind": kind, "path": str(ap), "exists": ap.is_file(), "reclaim_bytes": 0,
                    "warnings": ["扫描或导入正在进行，请结束后再清理文件"], "status": "forbidden"}
        if self.db.fetchone("""SELECT 1 FROM work_files WHERE path IN (?, ?)
            UNION ALL SELECT 1 FROM works WHERE cover_path IN (?, ?) LIMIT 1""", (str(ap), portable, str(ap), portable)) or str(ap) in self._active_import_tmp_paths():
            return {"kind": kind, "path": str(ap), "exists": True, "reclaim_bytes": 0,
                    "warnings": ["文件正在使用或仍有关联，不能作为散落文件删除"], "status": "forbidden"}
        if ap.parent == self.settings.library_dir.resolve() and self.db.fetchone("SELECT read_only FROM media_libraries WHERE kind = 'managed'")["read_only"]:
            return {"kind": kind, "path": str(ap), "exists": True, "reclaim_bytes": 0,
                    "warnings": ["该目录库只读，不能删除文件"], "status": "forbidden"}
        exists = bool(ap and ap.is_file())
        if not exists:
            return {"kind": kind, "path": str(ap), "exists": False, "reclaim_bytes": 0,
                    "warnings": ["already_gone"], "status": "already_gone"}
        return {"kind": kind, "path": str(ap), "exists": True, "reclaim_bytes": ap.stat().st_size,
                "warnings": [], "status": "ready"}

    def preview_delete(self, targets: list[dict[str, Any]]) -> dict[str, Any]:
        items: list[dict[str, Any]] = []
        for target in targets or []:
            kind = target.get("kind")
            if kind == "work":
                items.append(self._preview_work(int(target.get("work_id") or 0)))
            elif kind in ("orphan", "stale"):
                items.append(self._preview_loose(kind, target.get("path") or ""))
        files_to_delete = sum(len(i.get("files", [])) if i["kind"] == "work" else (1 if i.get("status") == "ready" else 0) for i in items)
        works_to_remove = sum(1 for i in items if i["kind"] == "work" and i.get("status") == "ready")
        reclaim_bytes = sum(i["reclaim_bytes"] for i in items)
        return {"items": items, "files_to_delete": files_to_delete, "works_to_remove": works_to_remove, "reclaim_bytes": reclaim_bytes}

    # --- deletion -------------------------------------------------------
    def _unlink(self, path: Path, target: dict[str, Any], errors: list[dict[str, Any]], source: dict[str, Any] | None = None) -> int | None:
        if source:
            try:
                if self.libraries.resolve_file(source, for_write=True) != path:
                    raise PermissionError("源文件路径已变化")
            except (OSError, ValueError) as exc:
                errors.append({"target": target, "code": "forbidden_path", "message": str(exc)})
                return None
        elif not self._within_managed(path):
            errors.append({"target": target, "code": "forbidden_path", "message": "路径不在受管目录内。"})
            return None
        try:
            if not path.is_file():
                return None
            size = path.stat().st_size
            path.unlink()
        except OSError as exc:
            errors.append({"target": target, "code": "unlink_failed", "message": str(exc)})
            return None
        return size

    def delete(self, targets: list[dict[str, Any]]) -> dict[str, Any]:
        # ponytail: shared cache lock serializes deletion; use per-work locks if bulk throughput requires it.
        with self.cache._lock if self.cache else nullcontext():
            return self._delete(targets)

    def _delete(self, targets: list[dict[str, Any]]) -> dict[str, Any]:
        deleted_files = 0
        removed_works = 0
        reclaimed_bytes = 0
        errors: list[dict[str, Any]] = []

        for target in targets or []:
            kind = target.get("kind")
            if kind == "work":
                work_id = int(target.get("work_id") or 0)
                with self.db.connect() as connection:
                    # Serialize lease/job creation with permission checks and removal.
                    connection.execute("BEGIN IMMEDIATE")
                    if connection.execute("SELECT 1 FROM works WHERE id=?", (work_id,)).fetchone() is None:
                        errors.append({"target": target, "code": "already_gone", "message": "作品不存在。"})
                        continue
                    try:
                        paths = self._work_files(work_id)  # Check every permission before deleting anything.
                    except (OSError, ValueError) as exc:
                        errors.append({"target": target, "code": "forbidden_path", "message": str(exc)})
                        continue
                    work_errors: list[dict[str, Any]] = []
                    for path, source in paths:
                        freed = self._unlink(path, target, work_errors, source)
                        if freed is not None:
                            deleted_files += 1
                            reclaimed_bytes += freed
                    if work_errors:
                        errors.extend(work_errors)
                        errors.append({"target": target, "code": "work_retained",
                                       "message": "部分文件未能删除，作品元数据已保留以便恢复或重试。"})
                        continue
                    connection.execute("DELETE FROM works WHERE id=?", (work_id,))
                    removed_works += 1
            elif kind in ("orphan", "stale"):
                with self.db.connect() as connection:
                    connection.execute("BEGIN IMMEDIATE")
                    preview = self._preview_loose(kind, target.get("path") or "")
                    if preview["status"] == "forbidden":
                        errors.append({"target": target, "code": "forbidden_path", "message": "；".join(preview["warnings"])})
                        continue
                    if not preview["exists"]:
                        continue
                    path = Path(preview["path"])
                    freed = self._unlink(path, target, errors)
                    if freed is not None:
                        deleted_files += 1
                        reclaimed_bytes += freed

        return {"deleted_files": deleted_files, "removed_works": removed_works, "reclaimed_bytes": reclaimed_bytes, "errors": errors}
