import zipfile
from dataclasses import replace
import time
from pathlib import Path

from fastapi.testclient import TestClient

from app import main
from app.config import Settings
from app.database import Database
from app.services.archive_service import ArchiveService
from app.services.job_service import JobService
from app.services.library_index_service import LibraryIndexService
from app.services.library_scan_job_service import LibraryScanJobService


def _png() -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc```\x00"
        b"\x00\x00\x04\x00\x01\xf6\x178U\x00\x00\x00\x00IEND\xaeB`\x82"
    )


def test_scan_preview_lists_new_local(tmp_path, monkeypatch):
    lib = tmp_path / "library"
    lib.mkdir()
    monkeypatch.setattr(main.services.library_scan, "settings", replace(main.services.settings, data_dir=tmp_path))
    with zipfile.ZipFile(lib / "fresh.cbz", "w") as archive:
        archive.writestr("001.png", _png())
    client = TestClient(main.app)
    resp = client.post("/api/library/scan/preview")
    assert resp.status_code == 200
    assert resp.json()["counts"]["new_local"] >= 1


def test_directory_api_scans_nested_source_and_preserves_it_on_removal(tmp_path, monkeypatch):
    settings = Settings(data_dir=tmp_path / "data")
    settings.ensure_directories()
    db = Database(settings.database_path)
    db.init_schema()
    archive = ArchiveService(db, settings)
    jobs = JobService(db)
    index = LibraryIndexService(settings, db, archive.libraries)
    scan_jobs = LibraryScanJobService(settings, jobs, index, archive.libraries)
    for name, value in {"media_libraries": archive.libraries, "library_scan_jobs": scan_jobs, "archive": archive}.items():
        monkeypatch.setattr(main.services, name, value)
    root = tmp_path / "media"
    (root / "nested").mkdir(parents=True)
    source = root / "nested" / "fresh.CBZ"
    with zipfile.ZipFile(source, "w") as content:
        content.writestr("001.png", _png())
    original = source.read_bytes()
    client = TestClient(main.app)
    payload = {"name": "目录", "root_path": str(root), "config": {"stable_seconds": 0}}
    added = client.post("/api/library/directories", json=payload)
    assert added.status_code == 201
    library_id = added.json()["id"]
    assert client.post("/api/library/directories", json=payload).status_code == 400
    assert client.post("/api/library/directories", json={**payload, "root_path": str(root / "nested")}).status_code == 400
    response = client.post("/api/library/scan", json={"library_id": library_id})
    assert response.status_code == 200
    job_id = response.json()["id"]
    deadline = time.monotonic() + 5
    while jobs.get(job_id)["status"] not in {"completed", "failed"} and time.monotonic() < deadline:
        time.sleep(0.02)
    assert jobs.get(job_id)["status"] == "completed"
    items = client.get(f"/api/library/directories/{library_id}/items").json()
    assert items["total"] == 1 and items["result"][0]["status"] == "ready"
    assert "manifest" not in items["result"][0]
    work_id = items["result"][0]["work_id"]
    assert client.get(f"/api/works/{work_id}/pages").json()["result"][0]["page_index"] == 1
    assert client.get(f"/api/works/{work_id}/pages/1").headers["content-type"] == "image/png"
    assert client.get(f"/api/library/directories/{library_id}/runs").json()["result"][0]["counts"]["indexed"] == 1
    assert client.delete(f"/api/library/directories/{library_id}").status_code == 200
    assert client.get(f"/api/works/{work_id}/pages/1").status_code == 404
    assert source.read_bytes() == original and db.fetchone("SELECT COUNT(*) AS n FROM works")["n"] == 1
    restored = client.post("/api/library/directories", json=payload)
    assert restored.status_code == 201 and restored.json()["id"] == library_id
    assert client.patch(f"/api/library/directories/{library_id}", json={"enabled": False}).status_code == 200
    assert client.post("/api/library/scan", json={"library_id": library_id}).status_code == 400
