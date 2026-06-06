from __future__ import annotations

import asyncio
import re
import tempfile
import zipfile
from pathlib import Path
from typing import Any

import httpx

from ..config import settings
from ..db import Database, dumps
from .metadata_writer import comic_info_xml, translated_metadata
from .nhentai_client import NhentaiClient, page_image_url
from .translation_service import TranslationService


def safe_filename(value: str) -> str:
    cleaned = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", value).strip()
    return cleaned[:160] or "untitled"


def page_extension(path: str) -> str:
    suffix = Path(path).suffix.lower()
    return suffix if suffix in {".jpg", ".jpeg", ".png", ".gif", ".webp"} else ".jpg"


class DownloadWorker:
    def __init__(self, db: Database, client: NhentaiClient, translations: TranslationService):
        self.db = db
        self.client = client
        self.translations = translations
        self._task: asyncio.Task[None] | None = None
        self._stopped = asyncio.Event()

    def start(self) -> None:
        if self._task is None or self._task.done():
            self._stopped.clear()
            self._task = asyncio.create_task(self._run())

    async def stop(self) -> None:
        self._stopped.set()
        if self._task:
            await self._task

    async def _run(self) -> None:
        semaphore = asyncio.Semaphore(settings.download_concurrency)
        running: set[asyncio.Task[None]] = set()
        while not self._stopped.is_set():
            queued = self.db.query_all(
                "SELECT * FROM tasks WHERE status='queued' ORDER BY created_at LIMIT ?",
                (settings.download_concurrency,),
            )
            for task in queued:
                if len(running) >= settings.download_concurrency:
                    break
                job = asyncio.create_task(self._run_one(task, semaphore))
                running.add(job)
                job.add_done_callback(running.discard)
            await asyncio.sleep(1)

    async def _run_one(self, task: dict[str, Any], semaphore: asyncio.Semaphore) -> None:
        async with semaphore:
            task_id = task["id"]
            try:
                self._update(task_id, "downloading", error=None)
                gallery = await self.client.get_gallery(int(task["gallery_id"]))
                title = self._gallery_title(gallery)
                pages = gallery.get("pages", [])
                self.db.execute(
                    """
                    UPDATE tasks SET title=?, progress_total=?, raw_json=?, updated_at=CURRENT_TIMESTAMP
                    WHERE id=?
                    """,
                    (title, len(pages), dumps(gallery), task_id),
                )
                servers = await self.client.get_cdn_servers()
                cbz_path = await self._download_cbz(task_id, gallery, servers[0])
                translated = translated_metadata(gallery, self.translations)
                self.db.execute(
                    """
                    UPDATE tasks SET status='completed', cbz_path=?, translated_json=?,
                        progress_current=progress_total, updated_at=CURRENT_TIMESTAMP
                    WHERE id=?
                    """,
                    (str(cbz_path), dumps(translated), task_id),
                )
            except Exception as exc:
                self._update(task_id, "failed", error=str(exc))

    async def _download_cbz(self, task_id: int, gallery: dict[str, Any], server: str) -> Path:
        title = self._gallery_title(gallery)
        gallery_id = gallery.get("id")
        filename = safe_filename(f"{gallery_id} - {title}") + ".cbz"
        final_path = settings.library_dir / filename
        pages = gallery.get("pages", [])
        info_xml = comic_info_xml(gallery, self.translations)

        with tempfile.NamedTemporaryFile(delete=False, suffix=".cbz") as tmp:
            tmp_path = Path(tmp.name)

        try:
            async with httpx.AsyncClient(timeout=settings.request_timeout) as http:
                with zipfile.ZipFile(tmp_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
                    for index, page in enumerate(pages, start=1):
                        url = page_image_url(server, page)
                        response = await http.get(
                            url,
                            headers={
                                "User-Agent": "nhentai-archive-platform/1.0",
                                "Referer": f"https://nhentai.net/g/{gallery_id}/",
                            },
                        )
                        if response.status_code in {401, 403, 429}:
                            raise RuntimeError(
                                "Remote service rejected image download; access controls will not be bypassed."
                            )
                        response.raise_for_status()
                        ext = page_extension(str(page.get("path", "")))
                        archive.writestr(f"{index:04d}{ext}", response.content)
                        self.db.execute(
                            "UPDATE tasks SET progress_current=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                            (index, task_id),
                        )
                    archive.writestr("ComicInfo.xml", info_xml)
            final_path.parent.mkdir(parents=True, exist_ok=True)
            tmp_path.replace(final_path)
            return final_path
        finally:
            if tmp_path.exists():
                tmp_path.unlink()

    def _update(self, task_id: int, status: str, error: str | None = None) -> None:
        self.db.execute(
            "UPDATE tasks SET status=?, error=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
            (status, error, task_id),
        )

    @staticmethod
    def _gallery_title(gallery: dict[str, Any]) -> str:
        title = gallery.get("title") or {}
        return title.get("display") or title.get("english") or title.get("japanese") or str(gallery.get("id"))
