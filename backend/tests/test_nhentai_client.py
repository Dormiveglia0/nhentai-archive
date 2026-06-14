import pytest
import urllib.error
from email.message import Message
from io import BytesIO

from app.services.nhentai_client import NhentaiApiError, NhentaiClient, map_gallery_summary, normalize_remote_error


def test_map_gallery_summary_preserves_remote_identity_and_titles():
    payload = {
        "id": 123456,
        "media_id": "98765",
        "english_title": "After School Room",
        "japanese_title": "放課後のふたり",
        "thumbnail": "/galleries/98765/thumb.jpg",
        "thumbnail_width": 350,
        "thumbnail_height": 500,
        "num_pages": 32,
        "num_favorites": 40,
        "tag_ids": [1, 2],
        "blacklisted": False,
    }

    summary = map_gallery_summary(payload)

    assert summary["gallery_id"] == 123456
    assert summary["media_id"] == "98765"
    assert summary["title"] == "After School Room"
    assert summary["title_japanese"] == "放課後のふたり"
    assert summary["page_count"] == 32
    assert summary["thumbnail"]["path"] == "/galleries/98765/thumb.jpg"
    assert summary["remote"] == "nhentai"


def test_normalize_remote_error_marks_429_as_rate_limited():
    error = normalize_remote_error(429, '{"error":"too many requests"}')

    assert isinstance(error, NhentaiApiError)
    assert error.status_code == 429
    assert error.code == "rate_limited"
    assert "too many requests" in error.message


class FakeHttpResponse:
    def __init__(self, body: bytes):
        self.body = BytesIO(body)

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self):
        return self.body.read()


def test_client_caches_repeated_discover_gets(monkeypatch):
    calls = []

    def fake_urlopen(request, timeout):
        calls.append(request.full_url)
        return FakeHttpResponse(b'{"result":[],"num_pages":1,"per_page":24,"total":0}')

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)
    client = NhentaiClient("https://api.example", "tests")

    first = client.latest(page=1, per_page=24)
    second = client.latest(page=1, per_page=24)

    assert first == second
    assert calls == ["https://api.example/api/v2/galleries?page=1&per_page=24"]


def test_client_enters_rate_limit_cooldown_without_repeating_remote_call(monkeypatch):
    calls = []
    headers = Message()
    headers["Retry-After"] = "90"

    def fake_urlopen(request, timeout):
        calls.append(request.full_url)
        raise urllib.error.HTTPError(
            request.full_url,
            429,
            "Too Many Requests",
            headers,
            BytesIO(b'{"error":"Rate limit exceeded"}'),
        )

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)
    client = NhentaiClient("https://api.example", "tests")

    with pytest.raises(NhentaiApiError) as first:
        client.latest(page=1, per_page=24)
    with pytest.raises(NhentaiApiError) as second:
        client.latest(page=2, per_page=24)

    assert first.value.code == "rate_limited"
    assert second.value.code == "rate_limited"
    assert second.value.retry_after is not None
    assert calls == ["https://api.example/api/v2/galleries?page=1&per_page=24"]
