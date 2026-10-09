import time
from pathlib import Path

from fastapi.testclient import TestClient
from PIL import Image

from app import main
from app.services.library_service import LibraryService
from app.services.reader_service import ReaderService
from test_archive_cache import cached_library


def test_reading_cache_http_preparation_snapshot_progress_and_safe_clear(tmp_path, monkeypatch):
    _, db, _, _, root, _, archive, work_id = cached_library(tmp_path)
    cache = archive.cache
    for name, service in {"archive": archive, "library": LibraryService(db), "jobs": cache.jobs,
                          "reader": ReaderService(db, cache)}.items():
        monkeypatch.setattr(main.services, name, service)
    client = TestClient(main.create_app(enforce_auth=False))
    # Browsing the persisted cover/pages never queues a complete CBZ copy.
    covers = {}
    for query in ("", "?w=512"):
        response = client.get(f"/api/works/{work_id}/cover{query}")
        assert response.status_code == 200 and response.headers["Cache-Control"] == "private, no-cache"
        covers[query] = response
        cached = client.get(f"/api/works/{work_id}/cover{query}", headers={"If-None-Match": '"other", W/' + response.headers["ETag"]})
        assert cached.status_code == 304 and cached.content == b""
    Image.new("RGB", (20, 10), "blue").save(Path(archive.get_work(work_id)["cover_path"]), format="JPEG")
    for query, before in covers.items():
        changed = client.get(f"/api/works/{work_id}/cover{query}", headers={"If-None-Match": before.headers["ETag"]})
        assert changed.status_code == 200 and changed.headers["ETag"] != before.headers["ETag"]
    assert len(client.get(f"/api/works/{work_id}/pages").json()["result"]) == 2
    assert client.get(f"/api/works/{work_id}/pages/1").status_code == 404
    assert not db.fetchone("SELECT id FROM archive_cache")
    first = client.post(f"/api/works/{work_id}/reading-source").json()
    deadline = time.monotonic() + 6
    while time.monotonic() < deadline:
        ready = client.post(f"/api/works/{work_id}/reading-source").json()
        if ready["status"] == "ready":
            break
        time.sleep(0.03)
    assert ready["status"] == "ready" and ready["cache_id"] == first["cache_id"]
    lease = ready["lease"]
    assert client.get(f"/api/works/{work_id}/pages/1?lease={lease}").status_code == 200
    assert client.get(f"/api/works/{work_id}/pages/1?lease=invalid").status_code == 422
    assert client.get(f"/api/works/{work_id}/pages/1/thumb?w=64&lease={lease}").status_code == 200
    started = client.post(f"/api/works/{work_id}/reading-sessions", json={"session_key": "cache-http-reader", "cache_lease": lease}).json()
    state = client.patch(f"/api/works/{work_id}/reader-state", json={"page_index": 2, "completed": True, "cache_lease": lease})
    assert state.status_code == 200 and state.json()["completed"]
    assert client.post("/api/library/cache/clear").json()["deleted"] == 0
    assert client.get("/api/library/cache").json()["active_count"] == 1
    assert client.patch("/api/library/cache", json={"max_parallel": 0}).status_code == 400
    assert client.patch(f"/api/works/{work_id}/reading-sessions/{started['id']}", json={"duration_seconds": 1, "finished": True}).status_code == 200
    assert client.delete(f"/api/works/{work_id}/reading-source/{lease}").status_code == 200
    assert client.post("/api/library/cache/clear").json()["deleted"] == 1
    assert client.get(f"/api/works/{work_id}/pages/1?lease={lease}").status_code == 409
    assert (root / "one.cbz").is_file() and client.get(f"/api/works/{work_id}/cover?w=512").status_code == 200
    cache.close()
