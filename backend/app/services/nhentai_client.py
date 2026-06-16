from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from copy import deepcopy
from typing import Any


@dataclass
class NhentaiApiError(Exception):
    status_code: int
    code: str
    message: str
    retry_after: int | None = None

    def __str__(self) -> str:
        return self.message


def normalize_remote_error(status_code: int, body: str, retry_after: int | None = None) -> NhentaiApiError:
    code = "remote_error"
    if status_code == 401:
        code = "unauthorized"
    elif status_code == 404:
        code = "not_found"
    elif status_code == 422:
        code = "validation_error"
    elif status_code == 429:
        code = "rate_limited"

    try:
        parsed = json.loads(body)
        message = parsed.get("error") or parsed.get("detail") or body
    except json.JSONDecodeError:
        message = body or f"Remote request failed with HTTP {status_code}"

    return NhentaiApiError(status_code=status_code, code=code, message=str(message), retry_after=retry_after)


def map_gallery_summary(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "remote": "nhentai",
        "gallery_id": payload["id"],
        "media_id": payload.get("media_id"),
        "title": payload.get("english_title") or payload.get("title", {}).get("english") or "Untitled",
        "title_japanese": payload.get("japanese_title") or payload.get("title", {}).get("japanese"),
        "pretty_title": payload.get("title", {}).get("pretty"),
        "thumbnail": {
            "path": payload.get("thumbnail") or payload.get("thumbnail", {}).get("path"),
            "width": payload.get("thumbnail_width") or payload.get("thumbnail", {}).get("width"),
            "height": payload.get("thumbnail_height") or payload.get("thumbnail", {}).get("height"),
        },
        "page_count": payload.get("num_pages", 0),
        "favorites": payload.get("num_favorites", 0),
        "tag_ids": payload.get("tag_ids", []),
        "blacklisted": payload.get("blacklisted", False),
    }


class NhentaiClient:
    def __init__(self, base_url: str, user_agent: str, api_key: str | None = None, timeout: int = 30):
        self.base_url = base_url.rstrip("/")
        self.user_agent = user_agent
        self.api_key = api_key
        self.timeout = timeout
        self._cdn: dict[str, Any] | None = None
        self._cache: dict[tuple[str, str, str, str], tuple[float, Any]] = {}
        self._rate_limited_until = 0.0

    def latest(self, page: int = 1, per_page: int = 25) -> dict[str, Any]:
        return self._get("/api/v2/galleries", {"page": page, "per_page": per_page})

    def tagged(self, tag_id: int, page: int = 1, per_page: int = 25, sort: str = "date") -> dict[str, Any]:
        return self._get(
            "/api/v2/galleries/tagged",
            {"tag_id": tag_id, "page": page, "per_page": per_page, "sort": sort},
        )

    def popular(self) -> list[dict[str, Any]]:
        return self._get("/api/v2/galleries/popular")

    def random(self) -> dict[str, Any]:
        return self._get("/api/v2/galleries/random")

    def search(self, query: str, page: int = 1, per_page: int = 25, sort: str = "date") -> dict[str, Any]:
        return self._get("/api/v2/search", {"query": query, "page": page, "per_page": per_page, "sort": sort})

    def gallery(self, gallery_id: int, include: str | None = None) -> dict[str, Any]:
        params = {"include": include} if include else None
        return self._get(f"/api/v2/galleries/{gallery_id}", params)

    def tag_search(self, query: str, limit: int = 20) -> dict[str, Any]:
        return self._post("/api/v2/tags/search", {"q": query, "limit": limit})

    def tags_by_ids(self, ids: list[int]) -> list[dict[str, Any]]:
        if not ids:
            return []
        unique_ids = list(dict.fromkeys(ids))[:100]
        return self._get("/api/v2/tags/ids", {"ids": ",".join(str(value) for value in unique_ids)})

    def user(self) -> dict[str, Any]:
        return self._get("/api/v2/user")

    def download_url(self, gallery_id: int, archive_format: str = "cbz") -> dict[str, Any]:
        return self._post(f"/api/v2/galleries/{gallery_id}/download", None, {"format": archive_format})

    def media_url(self, path: str | None, thumbnail: bool = False) -> str | None:
        if not path:
            return None
        if path.startswith("http://") or path.startswith("https://"):
            return path
        cdn = self._cdn_config()
        servers = cdn.get("thumb_servers" if thumbnail else "image_servers") or []
        if not servers:
            return None
        return f"{str(servers[0]).rstrip('/')}/{path.lstrip('/')}"

    def download_file(self, url: str, destination) -> None:
        request = urllib.request.Request(url, headers={"User-Agent": self.user_agent})
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                with open(destination, "wb") as output:
                    while True:
                        chunk = response.read(1024 * 256)
                        if not chunk:
                            break
                        output.write(chunk)
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", "replace")
            raise normalize_remote_error(exc.code, body, _retry_after(exc)) from exc

    def _get(self, path: str, params: dict[str, Any] | None = None) -> Any:
        return self._request("GET", path, params=params)

    def _post(self, path: str, body: dict[str, Any] | None = None, params: dict[str, Any] | None = None) -> Any:
        return self._request("POST", path, params=params, body=body)

    def _request(
        self,
        method: str,
        path: str,
        params: dict[str, Any] | None = None,
        body: dict[str, Any] | None = None,
    ) -> Any:
        ttl = self._cache_ttl(method, path)
        cache_key = self._cache_key(method, path, params, body)
        now = time.monotonic()
        cached = self._cache.get(cache_key)
        if ttl and cached and cached[0] > now:
            return deepcopy(cached[1])
        if self._rate_limited_until > now:
            if ttl and cached:
                return deepcopy(cached[1])
            retry_after = max(1, int(self._rate_limited_until - now))
            raise NhentaiApiError(
                status_code=429,
                code="rate_limited",
                message=f"Remote API rate limit cooldown active. Retry after {retry_after}s.",
                retry_after=retry_after,
            )

        query = f"?{urllib.parse.urlencode(params)}" if params else ""
        data = json.dumps(body).encode("utf-8") if body is not None else None
        headers = {"Accept": "application/json", "User-Agent": self.user_agent}
        if data is not None:
            headers["Content-Type"] = "application/json"
        if self.api_key:
            headers["Authorization"] = f"Key {self.api_key}"

        request = urllib.request.Request(
            f"{self.base_url}{path}{query}",
            data=data,
            headers=headers,
            method=method,
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                payload = json.loads(response.read().decode("utf-8"))
                if ttl:
                    self._cache[cache_key] = (now + ttl, deepcopy(payload))
                return payload
        except urllib.error.HTTPError as exc:
            body_text = exc.read().decode("utf-8", "replace")
            error = normalize_remote_error(exc.code, body_text, _retry_after(exc))
            if error.status_code == 429:
                cooldown = error.retry_after or 60
                self._rate_limited_until = max(self._rate_limited_until, time.monotonic() + cooldown)
                if ttl and cached:
                    return deepcopy(cached[1])
            raise error from exc

    def _cdn_config(self) -> dict[str, Any]:
        if self._cdn is None:
            self._cdn = self._get("/api/v2/cdn")
        return self._cdn

    def clear_runtime_cache(self) -> None:
        self._cache.clear()
        self._cdn = None
        self._rate_limited_until = 0.0

    def _cache_ttl(self, method: str, path: str) -> int:
        if method == "POST" and path == "/api/v2/tags/search":
            return 60 * 30
        if method != "GET":
            return 0
        if path == "/api/v2/cdn":
            return 60 * 60 * 24
        if path == "/api/v2/galleries/popular":
            return 60 * 15
        if path.startswith("/api/v2/galleries/") and path.rsplit("/", 1)[-1].isdigit():
            return 60 * 60
        if path in {"/api/v2/galleries", "/api/v2/galleries/tagged", "/api/v2/search"}:
            return 60 * 2
        if path == "/api/v2/tags/ids":
            return 60 * 60 * 24
        return 0

    def _cache_key(
        self,
        method: str,
        path: str,
        params: dict[str, Any] | None,
        body: dict[str, Any] | None,
    ) -> tuple[str, str, str, str]:
        params_key = json.dumps(params or {}, sort_keys=True, separators=(",", ":"))
        body_key = json.dumps(body or {}, sort_keys=True, separators=(",", ":"))
        key_source = "keyed" if self.api_key else "anonymous"
        return method, path, params_key, f"{key_source}:{body_key}"


def _retry_after(exc: urllib.error.HTTPError) -> int | None:
    value = exc.headers.get("Retry-After")
    if not value:
        return None
    try:
        return int(value)
    except ValueError:
        return None
