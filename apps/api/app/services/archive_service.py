from __future__ import annotations

import hashlib
import json
import mimetypes
import re
import shutil
import time
import zipfile
from io import BytesIO
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any, Callable

from PIL import Image

from app.config import Settings
from app.database import Database
from app.services.media_library_service import MediaLibraryService


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
mimetypes.add_type("image/webp", ".webp")

# Characters that are illegal in filenames on common filesystems, plus control chars.
_ILLEGAL_FILENAME_CHARS = re.compile(r'[\\/:*?"<>|\x00-\x1f]')
_MAX_NAME_LENGTH = 120


class ArchiveService:
    def __init__(self, db: Database, settings: Settings):
        self.db = db
        self.settings = settings
        self.settings.ensure_directories()
        self.libraries = MediaLibraryService(settings, db)
        from app.services.archive_cache_service import ArchiveCacheService
        self.cache = ArchiveCacheService(db, settings, self.libraries)

    def ingest_cbz(
        self, cbz_path: Path, source: str, title: str, remote_gallery_id: int | None, metadata: dict[str, Any],
        library_id: int | None = None,
        checkpoint: Callable[[], None] | None = None,
        index_source: bool = False,
    ) -> int:
        # A scan must not create another work before the downloaded source is linked.
        while not self.libraries._source_lock.acquire(timeout=.2):
            if checkpoint:
                checkpoint()
        try:
            if checkpoint:
                checkpoint()
            with self.cache._lock:
                return self._ingest_cbz(cbz_path, source, title, remote_gallery_id, metadata, library_id, index_source)
        finally:
            self.libraries._source_lock.release()

    def _ingest_cbz(
        self,
        cbz_path: Path,
        source: str,
        title: str,
        remote_gallery_id: int | None,
        metadata: dict[str, Any],
        library_id: int | None,
        index_source: bool = False,
    ) -> int:
        target_library, target_root = self.libraries.download_write_root(library_id)
        cbz_path = Path(cbz_path)
        if not zipfile.is_zipfile(cbz_path):
            raise ValueError(f"{cbz_path} is not a valid CBZ/ZIP archive")
        indexed = None
        if index_source or target_library["kind"] != "managed":
            from app.services.archive_manifest import inspect_archive
            indexed = inspect_archive(cbz_path)

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
            "SELECT path FROM work_files WHERE work_id = ? AND kind = 'source_cbz' AND library_item_id IS NULL "
            "ORDER BY created_at DESC, id DESC LIMIT 1",
            (work_id,),
        )
        stored_path: Path | None = None
        cover_path: Path | None = None
        try:
            stored_path = self._store_archive(
                work_id, cbz_path, title, remote_gallery_id, target_library, target_root,
            )
            read_path = cbz_path if indexed else stored_path
            page_entries = self._image_entries(read_path)
            page_members = [member for member, _size in page_entries]
            cover_path = self._extract_cover(work_id, read_path, page_members[0]) if page_members else None
            digest = self._sha256(read_path)

            with self.db.connect() as conn:
                if target_library["kind"] == "managed":
                    conn.execute("DELETE FROM work_files WHERE work_id = ? AND kind = 'source_cbz' AND library_item_id IS NULL", (work_id,))
                conn.execute("DELETE FROM work_pages WHERE work_id = ?", (work_id,))
                if indexed is None:
                    conn.execute(
                        """INSERT INTO work_files (work_id, kind, path, size_bytes, sha256)
                        VALUES (?, 'source_cbz', ?, ?, ?)""",
                        (work_id, self.db.managed_path(stored_path), stored_path.stat().st_size, digest),
                    )
                else:
                    relative = stored_path.relative_to(target_root).as_posix()
                    existing_item = conn.execute(
                        "SELECT id, work_id FROM library_items WHERE library_id = ? AND relative_path = ?",
                        (target_library["id"], relative),
                    ).fetchone()
                    if existing_item and existing_item["work_id"] not in {None, work_id}:
                        raise ValueError("默认下载媒体库已有同名作品，未覆盖源文件")
                    info = stored_path.stat()
                    library_item_id = int(conn.execute(
                        """INSERT INTO library_items(library_id, relative_path, work_id, size_bytes,
                        mtime_ns, device, inode, stable_since, status, fingerprint, manifest, metadata_json,
                        archive_info_json, indexed_at, scrape_status)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ready', ?, ?, ?, ?, CURRENT_TIMESTAMP, 'done')
                        ON CONFLICT(library_id, relative_path) DO UPDATE SET work_id=excluded.work_id,
                        size_bytes=excluded.size_bytes, mtime_ns=excluded.mtime_ns, device=excluded.device,
                        inode=excluded.inode, stable_since=excluded.stable_since, status='ready',
                        fingerprint=excluded.fingerprint, manifest=excluded.manifest,
                        metadata_json=excluded.metadata_json, archive_info_json=excluded.archive_info_json,
                        last_error=NULL, missing_since=NULL, indexed_at=CURRENT_TIMESTAMP,
                        scrape_status='done' RETURNING id""",
                        (target_library["id"], relative, work_id, info.st_size, info.st_mtime_ns,
                         info.st_dev, info.st_ino, time.time(), indexed["fingerprint"], indexed["manifest"],
                         json.dumps(indexed["metadata"], ensure_ascii=False),
                         json.dumps(indexed["archive_info"], ensure_ascii=False)),
                    ).fetchone()["id"])
                    conn.execute(
                        """INSERT INTO work_files(work_id, kind, path, size_bytes, sha256, library_item_id)
                        VALUES (?, 'source_cbz', ?, ?, ?, ?)
                        ON CONFLICT(library_item_id) WHERE library_item_id IS NOT NULL DO UPDATE SET
                        work_id=excluded.work_id, path=excluded.path, size_bytes=excluded.size_bytes,
                        sha256=excluded.sha256""",
                        (work_id, self.db.managed_path(stored_path) if target_library["kind"] == "managed" else str(stored_path), info.st_size, digest, library_item_id),
                    )
                    root_info = target_root.stat()
                    conn.execute(
                        """UPDATE media_libraries SET health='online', last_error=NULL, root_device=?,
                        root_inode=?, resolved_root_path=? WHERE id=?""",
                        (root_info.st_dev, root_info.st_ino, str(target_root), target_library["id"]),
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
                        self.db.managed_path(cover_path) if cover_path else None,
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
        if previous and target_library["kind"] == "managed":
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
        file = self.source_file(work_id) or self.source_file(work_id, available=False)
        if file and file["library_item_id"] and file.get("manifest"):
            from app.services.archive_manifest import unpack_manifest
            return [{**page, "work_id": work_id} for page in unpack_manifest(file["manifest"])]
        pages = self.db.fetchall(
            "SELECT * FROM work_pages WHERE work_id = ? ORDER BY page_index ASC",
            (work_id,),
        )
        if pages:
            return pages
        from app.services.archive_manifest import unpack_manifest
        item = self.db.fetchone(
            """SELECT i.manifest FROM library_items i JOIN media_libraries l ON l.id = i.library_id
            WHERE i.work_id = ? AND i.manifest IS NOT NULL AND l.removed_at IS NULL
            ORDER BY i.status = 'ready' DESC, i.indexed_at DESC LIMIT 1""", (work_id,),
        )
        return [{**page, "work_id": work_id} for page in unpack_manifest(item["manifest"])] if item else []

    def source_file(self, work_id: int, available: bool = True) -> dict[str, Any] | None:
        return self.libraries.source_file(work_id, available)

    def read_page(self, work_id: int, page_index: int, lease: str | None = None, source_revision: str | None = None) -> tuple[bytes, str]:
        if lease and source_revision:
            raise ValueError("不能同时指定缓存和直接阅读版本")
        archive_file = self.source_file(work_id) or self.source_file(work_id, available=False)
        if lease or (not source_revision and self.cache.required(archive_file)):
            with self.cache.source(work_id, lease) as (path, pages, _cache_id):
                return self._read_archive_page(path, pages, page_index)
        if not archive_file:
            raise FileNotFoundError(f"Archive not found for work {work_id}")
        with self.cache._lock:
            archive_file = self.cache.direct_source(work_id, source_revision)
            pages = self.list_pages(work_id)
            page = next((row for row in pages if row["page_index"] == page_index), None)
            if not page:
                raise FileNotFoundError(f"Page {page_index} not found")
            if archive_file["library_kind"] != "mounted":
                path = self.libraries.resolve_file(archive_file)
                before = path.stat()
                if archive_file["library_item_id"] and (before.st_size, before.st_mtime_ns, before.st_dev, before.st_ino) != (
                    archive_file["size_bytes"], archive_file["mtime_ns"], archive_file["device"], archive_file["inode"]):
                    raise FileNotFoundError("源归档已变化，请重新扫描后打开作品")
                result = self._read_archive_page(path, [page], page_index)
                after = path.stat()
                if (before.st_size, before.st_mtime_ns, before.st_dev, before.st_ino) != (after.st_size, after.st_mtime_ns, after.st_dev, after.st_ino):
                    raise ValueError("源归档在阅读时发生变化，请重新打开作品")
                return result
        with self.cache.mounted_read(archive_file, page) as (path, media_type):
            return path.read_bytes(), media_type

    @staticmethod
    def _read_archive_page(path: Path, pages: list[dict[str, Any]], page_index: int) -> tuple[bytes, str]:
        from app.services.archive_manifest import MAX_COVER_BYTES, open_archive
        page = next((row for row in pages if row["page_index"] == page_index), None)
        if not page:
            raise FileNotFoundError(f"Page {page_index} not found")
        with open_archive(path) as archive:
            if "archive_position" in page:
                entries = archive.infolist()
                if page["archive_position"] >= len(entries):
                    raise FileNotFoundError("源归档已改变，请重新扫描")
                member = entries[page["archive_position"]]
                if (member.filename, member.file_size, member.CRC) != (page["archive_member"], page["size_bytes"], page["crc"]):
                    raise FileNotFoundError("源归档已改变，请重新扫描")
            else:
                member = archive.getinfo(page["archive_member"])
            if member.file_size > MAX_COVER_BYTES or member.flag_bits & 1:
                raise ValueError("页面超过64MB或归档已加密，无法读取")
            return archive.read(member), mimetypes.guess_type(member.filename)[0] or page["media_type"]

    def read_page_thumbnail(self, work_id: int, page_index: int, width: int = 320, lease: str | None = None,
                            source_revision: str | None = None) -> tuple[bytes, str]:
        """Return a downscaled JPEG for a page, generating and caching it on first use."""
        if lease and source_revision:
            raise ValueError("不能同时指定缓存和直接阅读版本")
        width = max(64, min(width, 1024))
        origin = self.source_file(work_id) or self.source_file(work_id, available=False)
        if lease or (not source_revision and self.cache.required(origin)):
            with self.cache.source(work_id, lease) as (path, pages, cache_id):
                cache_path = self.settings.thumbs_dir / f"{work_id}-c{cache_id}-{page_index}-{width}.jpg"
                return self._read_thumbnail(cache_path, width, lambda: self._read_archive_page(path, pages, page_index)[0])
        origin = self.cache.direct_source(work_id, source_revision)
        revision = self.cache.revision(origin)
        # Preserve legacy URLs/cache names; indexed sources and prepared readers use versioned thumbnails.
        suffix = f"-r{revision}" if source_revision or origin["library_item_id"] else ""
        cache_path = self.settings.thumbs_dir / f"{work_id}{suffix}-{page_index}-{width}.jpg"
        return self._read_thumbnail(cache_path, width, lambda: self.read_page(work_id, page_index, source_revision=revision)[0])

    def read_cover_thumbnail(self, work_id: int, width: int = 512) -> tuple[bytes, str]:
        work = self.get_work(work_id)
        if not work or not work.get("cover_path"):
            raise FileNotFoundError("Cover not found")
        path = Path(work["cover_path"])
        if not path.is_file():
            raise FileNotFoundError("Cover file missing")
        width = max(64, min(width, 1024))
        if width >= 512 and path.name == f"{work_id}-indexed.jpg":
            return path.read_bytes(), "image/jpeg"
        cache_path = self.settings.thumbs_dir / f"{work_id}-cover-{width}.jpg"
        return self._read_thumbnail(cache_path, width, path.read_bytes)

    def _read_thumbnail(self, cache_path: Path, width: int, read_body: Callable[[], bytes]) -> tuple[bytes, str]:
        try:
            return cache_path.read_bytes(), "image/jpeg"
        except FileNotFoundError:
            pass

        thumb_bytes = _make_thumbnail(read_body(), width)
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
        library: dict[str, Any],
        root: Path,
    ) -> Path:
        # Name the stored archive after the work itself, not a bare sequence number.
        # A trailing gallery/work id keeps the name unique across same-titled works
        # (the common "Title [123456].cbz" convention).
        stem = _safe_filename(title) or f"work-{work_id}"
        marker = remote_gallery_id if remote_gallery_id else work_id
        destination = root / f"{stem} [{marker}].cbz"
        root_info = root.stat()

        cbz_path = Path(cbz_path)
        if cbz_path.resolve() != destination.resolve():
            if destination.is_symlink():
                raise ValueError("默认下载目标是符号链接，未覆盖源文件")
            if library["kind"] != "managed":
                item = self.db.fetchone(
                    "SELECT work_id FROM library_items WHERE library_id = ? AND relative_path = ?",
                    (library["id"], destination.relative_to(root).as_posix()),
                )
                if destination.exists() or item and item["work_id"] not in {None, work_id}:
                    raise ValueError("默认下载媒体库已有同名文件，未覆盖源文件")
            with NamedTemporaryFile(
                dir=destination.parent,
                prefix=f".{destination.name}.",
                suffix=".tmp",
                delete=False,
            ) as tmp:
                tmp_path = Path(tmp.name)
            try:
                shutil.copy2(cbz_path, tmp_path)
                _, current_root = self.libraries.download_write_root(library["id"])
                current_info = current_root.stat()
                if current_root != root or (current_info.st_dev, current_info.st_ino) != (root_info.st_dev, root_info.st_ino):
                    raise ValueError("默认下载媒体库在写入期间发生变化")
                if library["kind"] != "managed" and destination.exists():
                    raise ValueError("默认下载媒体库已有同名文件，未覆盖源文件")
                tmp_path.replace(destination)
            finally:
                tmp_path.unlink(missing_ok=True)

        return destination

    def _clear_cached_media(self, work_id: int, cover_path: Path | None) -> None:
        clear_direct_thumbnails(self.settings, work_id)
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


def clear_direct_thumbnails(settings: Settings, work_id: int) -> None:
    for cached in settings.thumbs_dir.glob(f"{work_id}-*.jpg"):
        # Immutable version thumbnails belong to cache leases/TTL, not source reindexing.
        if not re.fullmatch(r"c[0-9]+", cached.name.split("-", 2)[1]):
            cached.unlink(missing_ok=True)


def _make_thumbnail(body: bytes, width: int) -> bytes:
    with Image.open(BytesIO(body)) as image:
        if image.width * image.height > 30000000:
            raise ValueError("页面图片像素超过3000万，无法生成缩略图")
        image.draft("RGB", (width, max(1, round(image.height * min(1, width / image.width)))))
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


def _natural_key(value: str) -> list[tuple[int, int | str]]:
    parts: list[tuple[int, int | str]] = []
    number = ""
    text = ""
    for char in value:
        if char.isdigit():
            if text:
                parts.append((1, text.lower()))
                text = ""
            number += char
        else:
            if number:
                parts.append((0, int(number)))
                number = ""
            text += char
    if number:
        parts.append((0, int(number)))
    if text:
        parts.append((1, text.lower()))
    return parts
