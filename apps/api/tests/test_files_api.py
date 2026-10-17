from fastapi.testclient import TestClient

from app import main


class FakeFiles:
    def overview(self):
        return {"work_count": 3, "reclaimable_bytes": 42}

    def inventory(self, category="all", q=None, status=None, sort="default", page=1, per_page=50):
        return {"result": [{"kind": "work", "id": "work-1", "category": category, "q": q, "sort": sort}], "total": 1, "page": page, "per_page": per_page}

    def preview_delete(self, targets):
        return {"items": targets, "files_to_delete": len(targets), "works_to_remove": 0, "reclaim_bytes": 0}

    def delete(self, targets):
        return {"deleted_files": len(targets), "removed_works": 0, "reclaimed_bytes": 7, "errors": []}

    def duplicates(self):
        return {"hash": {"groups": 1, "files": 2}, "gallery_id": {"groups": 0, "works": 0}, "title_similar": None}


def test_files_overview_and_inventory_routes(monkeypatch):
    monkeypatch.setattr(main.services, "files", FakeFiles())
    client = TestClient(main.app)

    assert client.get("/api/files/overview").json()["work_count"] == 3
    body = client.get("/api/files/inventory?category=work&q=rain&sort=size_desc&page=2").json()
    assert body["result"][0]["category"] == "work"
    assert body["result"][0]["q"] == "rain"
    assert body["result"][0]["sort"] == "size_desc"
    assert body["page"] == 2


def test_files_preview_and_delete_routes(monkeypatch):
    monkeypatch.setattr(main.services, "files", FakeFiles())
    client = TestClient(main.app)

    preview = client.post("/api/files/preview-delete", json={"targets": [{"kind": "work", "work_id": 1}]})
    assert preview.json()["files_to_delete"] == 1

    result = client.post("/api/files/delete", json={"targets": [{"kind": "orphan", "path": "x"}]})
    assert result.json()["deleted_files"] == 1
    assert result.json()["reclaimed_bytes"] == 7


def test_files_delete_accepts_empty_targets(monkeypatch):
    monkeypatch.setattr(main.services, "files", FakeFiles())
    client = TestClient(main.app)
    assert client.post("/api/files/delete", json={"targets": []}).status_code == 200


def test_files_duplicates_route(monkeypatch):
    monkeypatch.setattr(main.services, "files", FakeFiles())
    client = TestClient(main.app)

    body = client.get("/api/files/duplicates").json()
    assert body["hash"]["files"] == 2
    assert body["title_similar"] is None


def test_derived_content_serves_actual_file_and_rejects_unmanaged_paths(tmp_path, monkeypatch):
    from test_file_service import _setup, _png

    settings, db, archive, files = _setup(tmp_path)
    monkeypatch.setattr(main.services, "files", files)
    client = TestClient(main.app)
    image = settings.covers_dir / "preview.png"
    image.write_bytes(_png())
    response = client.get("/api/files/derived/content", params={"path": str(image)})
    assert response.status_code == 200
    assert response.content == image.read_bytes()
    assert response.headers["content-type"] == "image/png"
    assert response.headers["content-disposition"].startswith("inline;")
    assert client.get("/api/files/derived/content", params={"path": str(image), "download": True}).headers["content-disposition"].startswith("attachment;")
    unsafe = settings.thumbs_dir / "document.html"
    unsafe.write_text("<html>local file</html>")
    response = client.get("/api/files/derived/content", params={"path": str(unsafe)})
    assert response.headers["content-type"] == "application/octet-stream"
    assert response.headers["content-disposition"].startswith("attachment;")
    link = settings.thumbs_dir / "link.png"
    link.symlink_to(image)
    for path in (link, settings.database_path, settings.covers_dir / ".." / "archive.db", settings.covers_dir):
        assert client.get("/api/files/derived/content", params={"path": str(path)}).status_code == 403
    image.unlink()
    assert client.get("/api/files/derived/content", params={"path": str(image)}).status_code == 404
    archive.cache.close()
