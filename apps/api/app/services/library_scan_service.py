from __future__ import annotations

import zipfile
from pathlib import Path
from typing import Any

from app.config import Settings
from app.database import Database
from app.services import comicinfo
from app.services.library_index_service import LibraryIndexService, ARCHIVES
from app.services.media_library_service import LIBRARY_DEFAULTS


class LibraryScanService:
    """只读扫描库目录，找出未被数据库索引的 CBZ 并分类。绝不调 NH API。"""

    def __init__(self, settings: Settings, db: Database):
        self.settings = settings
        self.db = db

    def _indexed(self) -> set[str]:
        rows = self.db.fetchall("""SELECT f.path FROM work_files f LEFT JOIN library_items i ON i.id = f.library_item_id
                                LEFT JOIN media_libraries l ON l.id = i.library_id
                                WHERE f.kind = 'source_cbz' AND (i.id IS NULL OR l.kind = 'managed')""")
        return {str(Path(row["path"])) for row in rows if row["path"]}

    def _read_gallery_id(self, cbz_path: Path) -> int | None:
        return comicinfo.gallery_id_from_cbz(cbz_path)

    def preview(self) -> dict[str, Any]:
        indexed_paths = self._indexed()
        new_linked: list[dict[str, Any]] = []
        new_local: list[dict[str, Any]] = []
        already_known: list[dict[str, Any]] = []
        unreadable: list[dict[str, Any]] = []

        # Only the app-owned import directory uses this compatibility preview.
        # Mounted libraries use persisted, paginated scan items; no request scans a mount.
        for entry, _, error in LibraryIndexService._walk(self.settings.library_dir, LIBRARY_DEFAULTS):
            if error or entry.suffix.lower() not in ARCHIVES:
                continue
            resolved = str(entry)
            if resolved in indexed_paths:
                continue
            if not zipfile.is_zipfile(entry):
                unreadable.append({"path": resolved, "gallery_id": None})
                continue
            gallery_id = self._read_gallery_id(entry)
            if gallery_id is not None:
                new_linked.append({"path": resolved, "gallery_id": gallery_id})
            else:
                new_local.append({"path": resolved, "gallery_id": None})

        counts = {
            "new_linked": len(new_linked),
            "new_local": len(new_local),
            "already_known": len(already_known),
            "unreadable": len(unreadable),
        }
        return {
            "new_linked": new_linked,
            "new_local": new_local,
            "already_known": already_known,
            "unreadable": unreadable,
            "counts": counts,
        }
