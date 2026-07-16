from __future__ import annotations

import hashlib
import mimetypes
import re
import shutil
import zipfile
from io import BytesIO
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any

from PIL import Image

from app.config import Settings
from app.database import Database


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}

# Characters that are illegal in filenames on common filesystems, plus control chars.
_ILLEGAL_FILENAME_CHARS = re.compile(r'[\\/:*?"<>|\x00-\x1f]')
_MAX_NAME_LENGTH = 120


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
                ON CONFLICT(remote_gallery_id) DO NOTHING
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
            row = cursor.fetchone()
            created = row is not None
            if row is None:
                row = conn.execute(
                    "SELECT id FROM works WHERE remote_gallery_id = ?", (remote_gallery_id,)
                ).fetchone()
            if row is None:
                raise RuntimeError("Failed to create or resolve archive work")
            work_id = int(row["id"])

        previous = self.db.fetchone(
            "SELECT path FROM work_files WHERE work_id = ? AND kind = 'source_cbz' "
            "ORDER BY created_at DESC, id DESC LIMIT 1",
            (work_id,),
        )
        stored_path: Path | None = None
        cover_path: Path | None = None
        try:
            stored_path = self._store_archive(work_id, cbz_path, title, remote_gallery_id)
            page_entries = self._image_entries(stored_path)
            page_members = [member for member, _size in page_entries]
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
                for index, (member, size) in enumerate(page_entries, start=1):
                    media_type = mimetypes.guess_type(member)[0] or "application/octet-stream"
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
                    SET title = ?, title_japanese = ?, pretty_title = ?,
                        page_count = ?, cover_path = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                    """,
                    (
                        title,
                        title_japanese,
                        pretty_title,
                        len(page_members),
                        str(cover_path) if cover_path else None,
                        work_id,
                    ),
                )
        except Exception:
            if created:
                self.db.execute("DELETE FROM works WHERE id = ?", (work_id,))
                if cover_path:
                    cover_path.unlink(missing_ok=True)
                if stored_path and stored_path.resolve() != cbz_path.resolve():
                    stored_path.unlink(missing_ok=True)
            raise

        self._clear_cached_media(work_id, cover_path)
        if previous:
            stale = Path(previous["path"])
            inside_library = stale.parent.resolve() == self.settings.library_dir.resolve()
            if inside_library and stale.resolve() != stored_path.resolve():
                stale.unlink(missing_ok=True)
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

    def read_page_thumbnail(self, work_id: int, page_index: int, width: int = 320) -> tuple[bytes, str]:
        """Return a downscaled JPEG for a page, generating and caching it on first use."""
        width = max(64, min(width, 1024))
        cache_path = self.settings.thumbs_dir / f"{work_id}-{page_index}-{width}.jpg"
        try:
            return cache_path.read_bytes(), "image/jpeg"
        except FileNotFoundError:
            pass

        body, _ = self.read_page(work_id, page_index)
        thumb_bytes = _make_thumbnail(body, width)
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        # Write atomically so a concurrent reader never sees a half-written file.
        with NamedTemporaryFile(dir=cache_path.parent, prefix=f".{cache_path.name}.", suffix=".tmp", delete=False) as tmp:
            tmp.write(thumb_bytes)
            tmp_path = Path(tmp.name)
        try:
            tmp_path.replace(cache_path)
        finally:
            tmp_path.unlink(missing_ok=True)
        return thumb_bytes, "image/jpeg"

    def _store_archive(
        self,
        work_id: int,
        cbz_path: Path,
        title: str,
        remote_gallery_id: int | None,
    ) -> Path:
        # Name the stored archive after the work itself, not a bare sequence number.
        # A trailing gallery/work id keeps the name unique across same-titled works
        # (the common "Title [123456].cbz" convention).
        stem = _safe_filename(title) or f"work-{work_id}"
        marker = remote_gallery_id if remote_gallery_id else work_id
        destination = self.settings.library_dir / f"{stem} [{marker}].cbz"

        cbz_path = Path(cbz_path)
        if cbz_path.resolve() != destination.resolve():
            with NamedTemporaryFile(
                dir=destination.parent,
                prefix=f".{destination.name}.",
                suffix=".tmp",
                delete=False,
            ) as tmp:
                tmp_path = Path(tmp.name)
            try:
                shutil.copy2(cbz_path, tmp_path)
                tmp_path.replace(destination)
            finally:
                tmp_path.unlink(missing_ok=True)

        return destination

    def _clear_cached_media(self, work_id: int, cover_path: Path | None) -> None:
        for cached in self.settings.thumbs_dir.glob(f"{work_id}-*.jpg"):
            cached.unlink(missing_ok=True)
        keep = cover_path.resolve() if cover_path else None
        for cached in self.settings.covers_dir.glob(f"{work_id}.*"):
            if keep is None or cached.resolve() != keep:
                cached.unlink(missing_ok=True)

    def _image_entries(self, cbz_path: Path) -> list[tuple[str, int]]:
        with zipfile.ZipFile(cbz_path) as archive:
            entries = [
                (info.filename, info.file_size)
                for info in archive.infolist()
                if not info.is_dir() and Path(info.filename).suffix.lower() in IMAGE_EXTENSIONS
            ]
        return sorted(entries, key=lambda entry: _natural_key(entry[0]))

    def _extract_cover(self, work_id: int, cbz_path: Path, member: str) -> Path:
        suffix = Path(member).suffix.lower() or ".jpg"
        destination = self.settings.covers_dir / f"{work_id}{suffix}"
        with zipfile.ZipFile(cbz_path) as archive:
            body = archive.read(member)
        with NamedTemporaryFile(
            dir=destination.parent,
            prefix=f".{destination.name}.",
            suffix=".tmp",
            delete=False,
        ) as tmp:
            tmp.write(body)
            tmp_path = Path(tmp.name)
        try:
            tmp_path.replace(destination)
        finally:
            tmp_path.unlink(missing_ok=True)
        return destination

    def _sha256(self, path: Path) -> str:
        digest = hashlib.sha256()
        with open(path, "rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest()


def _make_thumbnail(body: bytes, width: int) -> bytes:
    with Image.open(BytesIO(body)) as image:
        image = image.convert("RGB")
        if image.width > width:
            height = round(image.height * (width / image.width))
            image = image.resize((width, height), Image.LANCZOS)
        buffer = BytesIO()
        image.save(buffer, format="JPEG", quality=78, optimize=True)
        return buffer.getvalue()


def _safe_filename(name: str | None, max_length: int = _MAX_NAME_LENGTH) -> str:
    cleaned = _ILLEGAL_FILENAME_CHARS.sub("", name or "")
    cleaned = re.sub(r"\s+", " ", cleaned).strip().strip(".")
    if len(cleaned) > max_length:
        cleaned = cleaned[:max_length].rstrip()
    return cleaned


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
