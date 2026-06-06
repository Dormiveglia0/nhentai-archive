from __future__ import annotations

import asyncio
from typing import Any

import httpx

from ..config import settings


class NhentaiClientError(RuntimeError):
    pass


class NhentaiClient:
    base_url = "https://nhentai.net"

    def __init__(self) -> None:
        self._last_request = 0.0

    async def _rate_limit(self) -> None:
        now = asyncio.get_running_loop().time()
        delay = settings.request_interval_seconds - (now - self._last_request)
        if delay > 0:
            await asyncio.sleep(delay)
        self._last_request = asyncio.get_running_loop().time()

    async def _get_json(self, path: str, params: dict[str, Any] | None = None) -> Any:
        headers = {
            "User-Agent": "nhentai-archive-platform/1.0 (+authorized-personal-archive)",
            "Accept": "application/json",
        }
        last_error: Exception | None = None
        for attempt in range(settings.request_retries):
            await self._rate_limit()
            try:
                async with httpx.AsyncClient(timeout=settings.request_timeout, headers=headers) as client:
                    response = await client.get(f"{self.base_url}{path}", params=params)
                if response.status_code in {401, 403, 429}:
                    raise NhentaiClientError(
                        "Remote service rejected the request; the platform will not bypass access controls."
                    )
                response.raise_for_status()
                return response.json()
            except Exception as exc:
                last_error = exc
                if attempt + 1 < settings.request_retries:
                    await asyncio.sleep(2**attempt)
        raise NhentaiClientError(str(last_error)) from last_error

    async def get_gallery(self, gallery_id: int) -> dict[str, Any]:
        return await self._get_json(f"/api/v2/galleries/{gallery_id}")

    async def search(self, query: str) -> list[dict[str, Any]]:
        data = await self._get_json("/api/v2/search", {"query": query})
        result = data.get("result", data if isinstance(data, list) else [])
        return result if isinstance(result, list) else []

    async def get_cdn_servers(self) -> list[str]:
        data = await self._get_json("/api/v2/cdn")
        servers = data.get("image_servers") if isinstance(data, dict) else None
        if not servers:
            return ["https://i.nhentai.net"]
        return [server if server.startswith("http") else f"https://{server}" for server in servers]


def page_image_url(server: str, page: dict[str, Any]) -> str:
    path = str(page.get("path", "")).lstrip("/")
    if not path:
        raise NhentaiClientError("Gallery page is missing image path")
    return f"{server.rstrip('/')}/{path}"
