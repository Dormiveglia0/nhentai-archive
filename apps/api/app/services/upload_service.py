from __future__ import annotations

from collections.abc import AsyncIterator
from pathlib import Path
from tempfile import TemporaryDirectory

from starlette.concurrency import run_in_threadpool

from app.services.archive_manifest import inspect_archive, open_archive, MAX_COVER_BYTES
from app.services.archive_service import ArchiveService, IMAGE_EXTENSIONS

MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024


class UploadService:
    def __init__(self, archive: ArchiveService):
        self.archive = archive

    async def upload(self, chunks: AsyncIterator[bytes], filename: str, library_id: int | None = None) -> dict:
        name = Path(filename.replace("\\", "/")).name
        if Path(name).suffix.lower() not in {".zip", ".cbz"}:
            raise ValueError("请选择 ZIP 或 CBZ 文件")
        library, _ = await run_in_threadpool(self.archive.libraries.download_write_root, library_id)
        with TemporaryDirectory(dir=self.archive.settings.tmp_dir, prefix=".upload-") as directory, (Path(directory) / "source.cbz").open("wb") as temporary:
            size = 0
            async for chunk in chunks:
                size += len(chunk)
                if size > MAX_UPLOAD_BYTES:
                    raise ValueError("文件不能超过 2 GB")
                await run_in_threadpool(temporary.write, chunk)
            if not size:
                raise ValueError("上传文件为空")
            temporary.flush()
            return await run_in_threadpool(self._import, Path(temporary.name), name, library["id"])

    def _import(self, path: Path, filename: str, library_id: int) -> dict:
        with open_archive(path) as archive:
            if any(Path(info.filename).suffix.lower() in IMAGE_EXTENSIONS and info.file_size > MAX_COVER_BYTES for info in archive.infolist()):
                raise ValueError("归档中单张图片不能超过 64 MB")
        inspected = inspect_archive(path)
        metadata = inspected["metadata"]
        title = metadata.get("Title") or Path(filename).stem
        work_id = self.archive.ingest_cbz(path, "local", title, None, {
            "title_japanese": metadata.get("AlternateSeries"),
            "pretty_title": metadata.get("LocalizedSeries"),
        }, library_id=library_id, index_source=True)
        return {"work_id": work_id, "title": title, "page_count": inspected["page_count"],
                "filename": Path(filename).with_suffix(".cbz").name, "warnings": inspected["warnings"],
                "metadata": {"title": title, "title_japanese": metadata.get("AlternateSeries", ""),
                             "artist": metadata.get("Writer", ""), "group": metadata.get("Publisher", ""),
                             "language": metadata.get("LanguageISO", ""), "tags": metadata.get("Tags", ""),
                             "summary": metadata.get("Summary", "")}}
