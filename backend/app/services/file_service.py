from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from app.config import Settings
from app.database import Database


class FileMaintenanceService:
    """Local file inventory + deletion over the managed data directory.

    Never calls the NH API. Deletion is the only operation that touches disk;
    CBZ bytes are never modified, only whole files removed. Any path outside the
    managed roots (library/covers/tmp/exports) is rejected.
    """

    def __init__(self, db: Database, settings: Settings):
        self.db = db
        self.settings = settings
        self.settings.ensure_directories()

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

        for w in self.db.fetchall("SELECT * FROM works ORDER BY updated_at DESC, id DESC"):
            work_id = int(w["id"])
            frow = self.db.fetchone(
                "SELECT path, size_bytes FROM work_files WHERE work_id=? AND kind='source_cbz' "
                "ORDER BY created_at DESC, id DESC LIMIT 1",
                (work_id,),
            )
            src_abs = self._abs(frow["path"]) if frow else None
            if src_abs:
                referenced_sources.add(str(src_abs))
            src_exists = bool(src_abs and src_abs.is_file())
            src_size = src_abs.stat().st_size if src_exists else 0
            db_size = int(frow["size_bytes"]) if frow else 0

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
            except json.JSONDecodeError:
                continue
            gallery_id = target.get("gallery_id")
            if gallery_id:
                paths.add(str((self.settings.tmp_dir / f"nhentai-{int(gallery_id)}.cbz").resolve()))
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
        page: int = 1,
        per_page: int = 50,
    ) -> dict[str, Any]:
        entries = self._scan()
        if category in ("work", "orphan", "stale"):
            entries = [e for e in entries if e["kind"] == category]
        if status:
            entries = [e for e in entries if e["status"] == status]
        if q:
            ql = q.strip().lower()
            entries = [
                e
                for e in entries
                if ql in (e.get("title") or "").lower()
                or ql in (e.get("source_path") or e.get("path") or "").lower()
                or ql in (e.get("name") or "").lower()
            ]
        total = len(entries)
        per_page = max(1, min(int(per_page or 50), 500))
        page = max(1, int(page or 1))
        start = (page - 1) * per_page
        result = entries[start : start + per_page]
        for entry in result:
            if entry["kind"] == "work":
                entry["tags"] = self._work_tags_display(int(entry["work_id"]))
        return {"result": result, "total": total, "page": page, "per_page": per_page}

    def _work_tags_display(self, work_id: int, limit: int = 12) -> list[str]:
        rows = self.db.fetchall(
            """
            SELECT COALESCE(d.zh_name, wt.remote_name, wt.remote_slug) AS display
            FROM work_tags wt
            LEFT JOIN local_tag_dictionary d ON d.id = wt.dictionary_id
            WHERE wt.work_id = ?
            ORDER BY wt.id
            LIMIT ?
            """,
            (work_id, limit),
        )
        return [str(r["display"]) for r in rows if r.get("display")]

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
    def _work_files(self, work_id: int) -> list[Path]:
        paths: list[Path] = []
        for row in self.db.fetchall("SELECT path FROM work_files WHERE work_id=?", (work_id,)):
            ap = self._abs(row["path"])
            if ap is not None:
                paths.append(ap)
        cover = self.db.fetchone("SELECT cover_path FROM works WHERE id=?", (work_id,))
        cover_abs = self._abs(cover["cover_path"]) if cover else None
        if cover_abs is not None:
            paths.append(cover_abs)
        # de-dupe preserving order
        seen: set[str] = set()
        unique: list[Path] = []
        for p in paths:
            if str(p) not in seen:
                seen.add(str(p))
                unique.append(p)
        return unique

    def _preview_work(self, work_id: int) -> dict[str, Any]:
        row = self.db.fetchone("SELECT * FROM works WHERE id=?", (work_id,))
        if not row:
            return {"kind": "work", "work_id": work_id, "exists": False, "files": [],
                    "work_tags": 0, "has_progress": False, "has_governance": False,
                    "reclaim_bytes": 0, "warnings": ["already_gone"], "status": "already_gone"}
        files = self._work_files(work_id)
        existing = [p for p in files if p.is_file()]
        reclaim = sum(p.stat().st_size for p in existing)
        work_tags = self.db.fetchone("SELECT COUNT(*) AS n FROM work_tags WHERE work_id=?", (work_id,))["n"]
        has_progress = self.db.fetchone("SELECT 1 FROM reader_progress WHERE work_id=?", (work_id,)) is not None
        has_governance = self.db.fetchone("SELECT 1 FROM work_metadata WHERE work_id=?", (work_id,)) is not None
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
        if not self._within_managed(ap):
            return {"kind": kind, "path": path_str, "exists": False, "reclaim_bytes": 0,
                    "warnings": ["forbidden_path"], "status": "forbidden"}
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
        files_to_delete = sum(len(i.get("files", [])) if i["kind"] == "work" else (1 if i.get("exists") else 0) for i in items)
        works_to_remove = sum(1 for i in items if i["kind"] == "work" and i.get("exists"))
        reclaim_bytes = sum(i["reclaim_bytes"] for i in items)
        return {"items": items, "files_to_delete": files_to_delete, "works_to_remove": works_to_remove, "reclaim_bytes": reclaim_bytes}

    # --- deletion -------------------------------------------------------
    def _unlink(self, path: Path, target: dict[str, Any], errors: list[dict[str, Any]]) -> int:
        if not self._within_managed(path):
            errors.append({"target": target, "code": "forbidden_path", "message": "路径不在受管目录内。"})
            return 0
        if not path.is_file():
            return 0
        size = path.stat().st_size
        try:
            path.unlink()
        except OSError as exc:
            errors.append({"target": target, "code": "unlink_failed", "message": str(exc)})
            return 0
        return size

    def delete(self, targets: list[dict[str, Any]]) -> dict[str, Any]:
        deleted_files = 0
        removed_works = 0
        reclaimed_bytes = 0
        errors: list[dict[str, Any]] = []

        for target in targets or []:
            kind = target.get("kind")
            if kind == "work":
                work_id = int(target.get("work_id") or 0)
                if self.db.fetchone("SELECT 1 FROM works WHERE id=?", (work_id,)) is None:
                    errors.append({"target": target, "code": "already_gone", "message": "作品不存在。"})
                    continue
                paths = self._work_files(work_id)  # gather BEFORE cascade removes work_files rows
                self.db.execute("DELETE FROM works WHERE id=?", (work_id,))  # ON DELETE CASCADE clears all references
                removed_works += 1
                for path in paths:
                    freed = self._unlink(path, target, errors)
                    if freed > 0:
                        deleted_files += 1
                        reclaimed_bytes += freed
            elif kind in ("orphan", "stale"):
                path = self._abs(target.get("path"))
                if path is None:
                    errors.append({"target": target, "code": "forbidden_path", "message": "路径无效。"})
                    continue
                freed = self._unlink(path, target, errors)
                if freed > 0:
                    deleted_files += 1
                    reclaimed_bytes += freed

        return {"deleted_files": deleted_files, "removed_works": removed_works, "reclaimed_bytes": reclaimed_bytes, "errors": errors}
