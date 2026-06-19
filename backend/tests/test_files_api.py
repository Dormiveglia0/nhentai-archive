from fastapi.testclient import TestClient

from app import main


class FakeFiles:
    def overview(self):
        return {"work_count": 3, "reclaimable_bytes": 42}

    def inventory(self, category="all", q=None, status=None, page=1, per_page=50):
        return {"result": [{"kind": "work", "id": "work-1", "category": category, "q": q}], "total": 1, "page": page, "per_page": per_page}

    def preview_delete(self, targets):
        return {"items": targets, "files_to_delete": len(targets), "works_to_remove": 0, "reclaim_bytes": 0}

    def delete(self, targets):
        return {"deleted_files": len(targets), "removed_works": 0, "reclaimed_bytes": 7, "errors": []}


def test_files_overview_and_inventory_routes(monkeypatch):
    monkeypatch.setattr(main, "files_service", FakeFiles())
    client = TestClient(main.app)

    assert client.get("/api/files/overview").json()["work_count"] == 3
    body = client.get("/api/files/inventory?category=work&q=rain&page=2").json()
    assert body["result"][0]["category"] == "work"
    assert body["result"][0]["q"] == "rain"
    assert body["page"] == 2


def test_files_preview_and_delete_routes(monkeypatch):
    monkeypatch.setattr(main, "files_service", FakeFiles())
    client = TestClient(main.app)

    preview = client.post("/api/files/preview-delete", json={"targets": [{"kind": "work", "work_id": 1}]})
    assert preview.json()["files_to_delete"] == 1

    result = client.post("/api/files/delete", json={"targets": [{"kind": "orphan", "path": "x"}]})
    assert result.json()["deleted_files"] == 1
    assert result.json()["reclaimed_bytes"] == 7


def test_files_delete_accepts_empty_targets(monkeypatch):
    monkeypatch.setattr(main, "files_service", FakeFiles())
    client = TestClient(main.app)
    assert client.post("/api/files/delete", json={"targets": []}).status_code == 200
