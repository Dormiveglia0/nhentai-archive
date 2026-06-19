import io
import zipfile

from fastapi.testclient import TestClient

from app import main


class FakeExports:
    def summary(self):
        return {"total": 2, "ready": 1, "blocked": 1, "warnings": 0}

    def queue(self):
        return {
            "result": [{"work": {"id": 7}, "output_name": "book.cbz"}],
            "summary": {"total": 1, "ready": 1, "blocked": 0, "warnings": 0},
        }

    def preview(self, work_id, options=None):
        if work_id == 404:
            raise ValueError("missing work")
        output_name = (options or {}).get("output_name") or f"work-{work_id}.cbz"
        return {"work": {"id": work_id}, "output_name": output_name, "blockers": []}

    def build_cbz(self, work_id, options=None):
        if work_id == 422:
            raise ValueError("blocked export")
        name = (options or {}).get("output_name") or f"work-{work_id}.cbz"
        return name, b"FAKECBZBYTES"

    def build_bundle(self, items):
        if not items:
            raise ValueError("没有可导出的作品（所选项均存在阻塞）。")
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as bundle:
            for item in items:
                bundle.writestr(f"work-{item['work_id']}.cbz", b"FAKE")
        return f"导出合集 ({len(items)}).zip", buffer.getvalue()


def test_export_routes_return_service_payloads(monkeypatch):
    monkeypatch.setattr(main, "exports", FakeExports())
    client = TestClient(main.app)

    assert client.get("/api/exports/queue").json()["summary"]["ready"] == 1
    assert client.get("/api/exports/summary").json()["total"] == 2
    assert client.get("/api/works/7/export-preview").json()["output_name"] == "work-7.cbz"
    assert (
        client.post("/api/works/7/export-preview", json={"output_name": "renamed.cbz"}).json()["output_name"]
        == "renamed.cbz"
    )


def test_export_download_streams_cbz_as_attachment(monkeypatch):
    monkeypatch.setattr(main, "exports", FakeExports())
    client = TestClient(main.app)

    response = client.get("/api/works/7/export/download")
    assert response.status_code == 200
    assert response.content == b"FAKECBZBYTES"
    assert response.headers["content-type"] == "application/vnd.comicbook+zip"
    assert "attachment" in response.headers["content-disposition"]
    assert "work-7.cbz" in response.headers["content-disposition"]


def test_export_download_bundle_streams_zip(monkeypatch):
    monkeypatch.setattr(main, "exports", FakeExports())
    client = TestClient(main.app)

    response = client.post(
        "/api/exports/download", json={"items": [{"work_id": 7}, {"work_id": 8}]}
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    with zipfile.ZipFile(io.BytesIO(response.content)) as bundle:
        assert bundle.namelist() == ["work-7.cbz", "work-8.cbz"]


def test_export_routes_map_service_errors(monkeypatch):
    monkeypatch.setattr(main, "exports", FakeExports())
    client = TestClient(main.app)

    assert client.get("/api/works/404/export-preview").status_code == 404
    response = client.get("/api/works/422/export/download")
    assert response.status_code == 422
    assert response.json()["detail"] == "blocked export"
    assert client.post("/api/exports/download", json={"items": []}).status_code == 422
