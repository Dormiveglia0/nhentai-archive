from __future__ import annotations

import hashlib
import mimetypes
import shutil
import zipfile
from pathlib import Path
from typing import Any

from app.config import Settings
from app.database import Database


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


class ArchiveService:
    def __init__(self, db: Database, settings: Settings):
        self.db = db
        self.settings = settings
        self.settings.ensure_directories()

    def ingest_cbz(
        self,
        cbz_path: Path,
        source: str,
        title: str,
        remote_gallery_id: int | None,
        metadata: dict[str, Any],
    ) -> int:
        cbz_path = Path(cbz_path)
        if not zipfile.is_zipfile(cbz_path):
            raise ValueError(f"{cbz_path} is not a valid CBZ/ZIP archive")

        media_id = metadata.get("media_id")
        title_japanese = metadata.get("title_japanese")
        pretty_title = metadata.get("pretty_title")
        with self.db.connect() as conn:
            cursor = conn.execute(
                """
                INSERT INTO works (
                  remote, remote_gallery_id, media_id, title, title_japanese,
                  pretty_title, source, page_count
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, 0)
                ON CONFLICT(remote_gallery_id) DO UPDATE SET
                  title=excluded.title,
                  title_japanese=excluded.title_japanese,
                  pretty_title=excluded.pretty_title,
                  updated_at=CURRENT_TIMESTAMP
                RETURNING id
                """,
                (
                    metadata.get("remote"),
                    remote_gallery_id,
                    media_id,
                    title,
                    title_japanese,
                    pretty_title,
                    source,
                ),
            )
            work_id = int(cursor.fetchone()["id"])

        stored_path = self._store_archive(work_id, cbz_path)
        page_members = self._image_members(stored_path)
        cover_path = self._extract_cover(work_id, stored_path, page_members[0]) if page_members else None
        digest = self._sha256(stored_path)

        with self.db.connect() as conn:
            conn.execute("DELETE FROM work_files WHERE work_id = ? AND kind = 'source_cbz'", (work_id,))
            conn.execute("DELETE FROM work_pages WHERE work_id = ?", (work_id,))
            conn.execute(
                """
                INSERT INTO work_files (work_id, kind, path, size_bytes, sha256)
                VALUES (?, 'source_cbz', ?, ?, ?)
                """,
                (work_id, str(stored_path), stored_path.stat().st_size, digest),
            )
            for index, member in enumerate(page_members, start=1):
                media_type = mimetypes.guess_type(member)[0] or "application/octet-stream"
                with zipfile.ZipFile(stored_path) as archive:
                    size = archive.getinfo(member).file_size
                conn.execute(
                    """
                    INSERT INTO work_pages (work_id, page_index, archive_member, media_type, size_bytes)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (work_id, index, member, media_type, size),
                )
            conn.execute(
                """
                UPDATE works
                SET page_count = ?, cover_path = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (len(page_members), str(cover_path) if cover_path else None, work_id),
            )

        return work_id

    def list_works(self) -> list[dict[str, Any]]:
        return self.db.fetchall(
            """
            SELECT w.*,
              COALESCE(rp.page_index, 0) AS reader_page_index,
              COALESCE(rp.progress_percent, 0) AS progress_percent,
              COALESCE(rp.completed, 0) AS completed
            FROM works w
            LEFT JOIN reader_progress rp ON rp.work_id = w.id
            ORDER BY w.updated_at DESC
            """
        )

    def get_work(self, work_id: int) -> dict[str, Any] | None:
        return self.db.fetchone("SELECT * FROM works WHERE id = ?", (work_id,))

    def list_pages(self, work_id: int) -> list[dict[str, Any]]:
        return self.db.fetchall(
            "SELECT * FROM work_pages WHERE work_id = ? ORDER BY page_index ASC",
            (work_id,),
        )

    def read_page(self, work_id: int, page_index: int) -> tuple[bytes, str]:
        page = self.db.fetchone(
            "SELECT * FROM work_pages WHERE work_id = ? AND page_index = ?",
            (work_id, page_index),
        )
        if not page:
            raise FileNotFoundError(f"Page {page_index} not found for work {work_id}")
        archive_file = self.db.fetchone(
            "SELECT path FROM work_files WHERE work_id = ? AND kind = 'source_cbz'",
            (work_id,),
        )
        if not archive_file:
            raise FileNotFoundError(f"Archive not found for work {work_id}")
        with zipfile.ZipFile(archive_file["path"]) as archive:
            return archive.read(page["archive_member"]), page["media_type"]

    def _store_archive(self, work_id: int, cbz_path: Path) -> Path:
        destination = self.settings.library_dir / f"{work_id}.cbz"
        if cbz_path.resolve() != destination.resolve():
            shutil.copy2(cbz_path, destination)
        return destination

    def _image_members(self, cbz_path: Path) -> list[str]:
        with zipfile.ZipFile(cbz_path) as archive:
            members = [
                info.filename
                for info in archive.infolist()
                if not info.is_dir() and Path(info.filename).suffix.lower() in IMAGE_EXTENSIONS
            ]
        return sorted(members, key=_natural_key)

    def _extract_cover(self, work_id: int, cbz_path: Path, member: str) -> Path:
        suffix = Path(member).suffix.lower() or ".jpg"
        destination = self.settings.covers_dir / f"{work_id}{suffix}"
        with zipfile.ZipFile(cbz_path) as archive:
            destination.write_bytes(archive.read(member))
        return destination

    def _sha256(self, path: Path) -> str:
        digest = hashlib.sha256()
        with open(path, "rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest()


def _natural_key(value: str) -> list[int | str]:
    parts: list[int | str] = []
    number = ""
    text = ""
    for char in value:
        if char.isdigit():
            if text:
                parts.append(text.lower())
                text = ""
            number += char
        else:
            if number:
                parts.append(int(number))
                number = ""
            text += char
    if number:
        parts.append(int(number))
    if text:
        parts.append(text.lower())
    return parts
