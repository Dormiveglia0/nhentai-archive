import pytest
import urllib.error
import time
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


def test_map_gallery_summary_reads_nested_thumbnail_payload():
    summary = map_gallery_summary(
        {
            "id": 123456,
            "title": {"english": "Nested", "pretty": "Nested Pretty"},
            "thumbnail": {"path": "thumb.jpg", "width": 320, "height": 480},
        }
    )

    assert summary["pretty_title"] == "Nested Pretty"
    assert summary["thumbnail"] == {"path": "thumb.jpg", "width": 320, "height": 480}


def test_normalize_remote_error_marks_429_as_rate_limited():
    error = normalize_remote_error(429, '{"error":"too many requests"}')

    assert isinstance(error, NhentaiApiError)
    assert error.status_code == 429
    assert error.code == "rate_limited"
    assert "too many requests" in error.message


def test_normalize_remote_error_accepts_non_object_json():
    error = normalize_remote_error(502, '["upstream unavailable"]')

    assert error.code == "remote_error"
    assert "upstream unavailable" in error.message


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


def test_client_fresh_gallery_bypasses_cached_payload(monkeypatch):
    calls = []

    def fake_urlopen(request, timeout):
        calls.append(request.full_url)
        title = "First" if len(calls) == 1 else "Fresh"
        return FakeHttpResponse(f'{{"id":7,"title":{{"english":"{title}"}}}}'.encode())

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)
    client = NhentaiClient("https://api.example", "tests")

    assert client.gallery(7)["title"]["english"] == "First"
    assert client.gallery(7)["title"]["english"] == "First"
    assert client.gallery(7, fresh=True)["title"]["english"] == "Fresh"
    assert len(calls) == 2


def test_fresh_search_and_tagged_use_current_contract_and_reject_stale_cooldown(monkeypatch):
    calls = []
    def response(request, timeout):
        calls.append(request.full_url)
        return FakeHttpResponse(b'{"result":[],"num_pages":1}')
    monkeypatch.setattr("urllib.request.urlopen", response)
    client = NhentaiClient("https://api.example", "tests")
    client.search("winter", per_page=10)
    client.search("winter", per_page=10)
    client.search("winter", per_page=10, fresh=True)
    client.tagged(20, fresh=True)
    assert calls == ["https://api.example/api/v2/search?query=winter&page=1&sort=date",
                     "https://api.example/api/v2/search?query=winter&page=1&sort=date",
                     "https://api.example/api/v2/galleries/tagged?tag_id=20&page=1&per_page=25&sort=date"]
    client._rate_limited_until = time.monotonic() + 120
    with pytest.raises(NhentaiApiError) as exc:
        client.search("winter", fresh=True)
    assert exc.value.status_code == 429 and exc.value.retry_after >= 119
    assert len(calls) == 3


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


def test_client_normalizes_network_and_invalid_json_failures(monkeypatch):
    client = NhentaiClient("https://api.example", "tests")
    monkeypatch.setattr(
        "urllib.request.urlopen",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(urllib.error.URLError("offline")),
    )

    with pytest.raises(NhentaiApiError) as network:
        client.latest(page=1, per_page=24)
    assert network.value.code == "network_error"
    assert network.value.status_code == 502

    monkeypatch.setattr(
        "urllib.request.urlopen", lambda *_args, **_kwargs: FakeHttpResponse(b"not-json")
    )
    with pytest.raises(NhentaiApiError) as invalid:
        client.latest(page=2, per_page=24)
    assert invalid.value.code == "invalid_response"


def test_media_url_repairs_repeated_image_extensions_from_upstream():
    client = NhentaiClient("https://api.example", "tests")
    client._cdn = {
        "image_servers": ["https://i.example"],
        "thumb_servers": ["https://t.example"],
    }

    assert client.media_url("galleries/42/cover.webp.webp") == "https://i.example/galleries/42/cover.webp"
    assert client.media_url("galleries/42/thumb.jpg.jpg", thumbnail=True) == "https://t.example/galleries/42/thumb.jpg"
    assert client.media_url("https://cdn.example/1.png.png?size=2") == "https://cdn.example/1.png?size=2"


def test_media_proxy_url_is_same_origin_and_rejects_absolute_fetch_paths():
    client = NhentaiClient("https://api.example", "tests")

    assert client.media_proxy_url(
        "https://t.example/galleries/42/thumb.webp.webp", thumbnail=True
    ) == "/api/discover/media?path=%2Fgalleries%2F42%2Fthumb.webp&thumbnail=true"
    with pytest.raises(NhentaiApiError) as error:
        client.open_media("https://private.example/secret.png")
    assert error.value.code == "invalid_media_path"


def test_uncached_requests_are_paced_and_background_leaves_browsing_room(monkeypatch):
    clock = [100.0]
    starts = []
    client = NhentaiClient("https://api.example", "tests")
    monkeypatch.setattr("app.services.nhentai_client.time.monotonic", lambda: clock[0])
    monkeypatch.setattr(client._request_condition, "wait", lambda delay: clock.__setitem__(0, clock[0] + delay + .0001))
    def request(*args, **kwargs):
        starts.append(clock[0])
        return FakeHttpResponse(b'{"result": []}')
    monkeypatch.setattr("urllib.request.urlopen", request)
    client.latest(page=1)
    client.latest(page=1)  # Cache hits consume no request slot.
    client.latest(page=2)
    with client.background_requests(lambda: False):
        client.latest(page=3)
        client.latest(page=4)
    assert len(starts) == 4
    assert starts[1] - starts[0] >= 1
    assert starts[2] - starts[1] >= 2
    assert starts[3] - starts[2] >= 3


def test_background_waits_out_cooldown_and_can_cancel_without_network(monkeypatch):
    clock = [100.0]
    client = NhentaiClient("https://api.example", "tests")
    monkeypatch.setattr("app.services.nhentai_client.time.monotonic", lambda: clock[0])
    monkeypatch.setattr(client._request_condition, "wait", lambda delay: clock.__setitem__(0, clock[0] + delay + .0001))
    calls = []
    monkeypatch.setattr("urllib.request.urlopen", lambda *a, **k: calls.append(clock[0]) or FakeHttpResponse(b'{}'))
    client._rate_limited_until = 103
    with client.background_requests(lambda: False):
        client.latest()
    assert calls[0] >= 103
    with client.background_requests(lambda: True), pytest.raises(InterruptedError):
        client.latest(page=2)
    assert len(calls) == 1


def test_foreground_request_preempts_queued_background_work(monkeypatch):
    import threading
    client = NhentaiClient('https://api.example', 'tests')
    client._next_request_at = time.monotonic() + .15
    calls, errors = [], []
    monkeypatch.setattr('urllib.request.urlopen', lambda request, **kwargs: calls.append((request.full_url, time.monotonic())) or FakeHttpResponse(b'{}'))
    def background():
        try:
            with client.background_requests(lambda: False):
                client.latest(page=2)
        except Exception as exc:
            errors.append(exc)
    worker = threading.Thread(target=background, daemon=True)
    worker.start()
    client.latest(page=1)
    worker.join(4)
    assert not worker.is_alive() and not errors
    assert 'page=1' in calls[0][0] and 'page=2' in calls[1][0]
    assert calls[1][1] - calls[0][1] >= 1.9
