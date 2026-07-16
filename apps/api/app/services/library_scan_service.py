from __future__ import annotations

import hashlib
import zipfile
from pathlib import Path
from typing import Any

from app.config import Settings
from app.database import Database
from app.services import comicinfo


class LibraryScanService:
    """只读扫描库目录，找出未被数据库索引的 CBZ 并分类。绝不调 NH API。"""

    def __init__(self, settings: Settings, db: Database):
        self.settings = settings
        self.db = db

    def _indexed(self) -> tuple[set[str], set[str]]:
        rows = self.db.fetchall("SELECT path, sha256 FROM work_files WHERE kind = 'source_cbz'")
        paths = {str(Path(r["path"]).resolve()) for r in rows if r["path"]}
        digests = {r["sha256"] for r in rows if r["sha256"]}
        return paths, digests

    def _read_gallery_id(self, cbz_path: Path) -> int | None:
        return comicinfo.gallery_id_from_cbz(cbz_path)

    @staticmethod
    def _sha256(path: Path) -> str:
        digest = hashlib.sha256()
        with open(path, "rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest()

    def preview(self) -> dict[str, Any]:
        indexed_paths, indexed_digests = self._indexed()
        new_linked: list[dict[str, Any]] = []
        new_local: list[dict[str, Any]] = []
        already_known: list[dict[str, Any]] = []
        unreadable: list[dict[str, Any]] = []

        for entry in sorted(self.settings.library_dir.glob("*.cbz")):
            resolved = str(entry.resolve())
            if resolved in indexed_paths:
                continue
            if not zipfile.is_zipfile(entry):
                unreadable.append({"path": resolved, "gallery_id": None})
                continue
            if self._sha256(entry) in indexed_digests:
                already_known.append({"path": resolved, "gallery_id": None})
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
