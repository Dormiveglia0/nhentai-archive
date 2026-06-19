from __future__ import annotations

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
        return [p for p in sorted(d.iterdir()) if p.is_file()]

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
                    "size_bytes": src_size + cover_size,
                    "page_count": int(w.get("page_count") or 0),
                    "source": w.get("source"),
                    "remote_gallery_id": w.get("remote_gallery_id"),
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
        for p in self._loose_files(self.settings.tmp_dir):
            entries.append(self._loose_entry(p, "stale", "tmp"))
        for p in self._loose_files(self.settings.export_dir):
            entries.append(self._loose_entry(p, "stale", "exports"))

        return entries

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
            "source_bytes": sum(e["size_bytes"] for e in works),
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
        per_page = max(1, min(int(per_page or 50), 200))
        page = max(1, int(page or 1))
        start = (page - 1) * per_page
        return {"result": entries[start : start + per_page], "total": total, "page": page, "per_page": per_page}
