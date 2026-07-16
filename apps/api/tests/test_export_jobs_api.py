import zipfile
from datetime import timedelta
from pathlib import Path

from fastapi.testclient import TestClient

from app import main
from app.config import Settings
from app.database import Database
from app.services.archive_service import ArchiveService
from app.services.export_job_service import ExportJobService, _now
from app.services.export_service import ExportService
from app.services.job_service import JobService


def _png() -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc```\x00"
        b"\x00\x00\x04\x00\x01\xf6\x178U\x00\x00\x00\x00IEND\xaeB`\x82"
    )


def _make_cbz(path: Path) -> None:
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("001.png", _png())


def _wire(tmp_path, monkeypatch):
    settings = Settings(data_dir=tmp_path / "data", database_path=tmp_path / "data" / "archive.db")
    db = Database(settings.database_path)
    db.init_schema()
    archive = ArchiveService(db, settings)
    exports = ExportService(db, settings)
    jobs = JobService(db)
    export_jobs = ExportJobService(settings, jobs, exports)
    export_jobs._start_worker = lambda _job_id: None
    monkeypatch.setattr(main.services, "jobs", jobs)
    monkeypatch.setattr(main.services, "exports", exports)
    monkeypatch.setattr(main.services, "export_jobs", export_jobs)
    return settings, db, archive, exports, jobs, export_jobs


def _import_work(db, archive, tmp_path, gallery_id=1) -> int:
    cbz = tmp_path / f"src-{gallery_id}.cbz"
    _make_cbz(cbz)
    return archive.ingest_cbz(cbz, "remote", f"Work {gallery_id}", gallery_id, {"remote": "nhentai"})


def test_enqueue_bulk_export_route(tmp_path, monkeypatch):
    _settings, db, archive, _exports, jobs, _export_jobs = _wire(tmp_path, monkeypatch)
    work_id = _import_work(db, archive, tmp_path)
    client = TestClient(main.app)

    response = client.post("/api/exports/bulk-jobs", json={"work_ids": [work_id], "options": {}})

    assert response.status_code == 200
    body = response.json()
    assert body["type"] == "bulk_export"


def test_enqueue_rejects_empty_selection(tmp_path, monkeypatch):
    _wire(tmp_path, monkeypatch)
    client = TestClient(main.app)
    assert client.post("/api/exports/bulk-jobs", json={"work_ids": []}).status_code == 422


def test_download_then_delete_removes_file_and_flags_downloaded(tmp_path, monkeypatch):
    _settings, db, archive, _exports, jobs, export_jobs = _wire(tmp_path, monkeypatch)
    work_id = _import_work(db, archive, tmp_path)
    job = export_jobs.enqueue_bulk_export([work_id], {})
    export_jobs.run_bulk_export(job["id"])
    artifact = Path(jobs.get(job["id"])["target"]["artifact_path"])
    assert artifact.exists()

    # TestClient runs the BackgroundTask after sending the response.
    with TestClient(main.app) as client:
        response = client.get(f"/api/jobs/{job['id']}/export/download")
        assert response.status_code == 200
        with zipfile.ZipFile(__import__("io").BytesIO(response.content)) as bundle:
            assert len(bundle.namelist()) == 1

    assert not artifact.exists()
    assert jobs.get(job["id"])["target"]["downloaded"] is True

    # Second download -> 410 (already downloaded).
    with TestClient(main.app) as client:
        assert client.get(f"/api/jobs/{job['id']}/export/download").status_code == 410


def test_download_expired_returns_410(tmp_path, monkeypatch):
    _settings, db, archive, _exports, jobs, export_jobs = _wire(tmp_path, monkeypatch)
    work_id = _import_work(db, archive, tmp_path)
    job = export_jobs.enqueue_bulk_export([work_id], {})
    export_jobs.run_bulk_export(job["id"])
    jobs.complete(job["id"], {"expires_at": (_now() - timedelta(hours=1)).isoformat()})

    # Plain client (no lifespan sweep) so the route's own expiry check runs.
    client = TestClient(main.app)
    assert client.get(f"/api/jobs/{job['id']}/export/download").status_code == 410


def test_download_missing_artifact_returns_404(tmp_path, monkeypatch):
    _settings, db, archive, _exports, jobs, export_jobs = _wire(tmp_path, monkeypatch)
    work_id = _import_work(db, archive, tmp_path)
    job = export_jobs.enqueue_bulk_export([work_id], {})
    export_jobs.run_bulk_export(job["id"])
    Path(jobs.get(job["id"])["target"]["artifact_path"]).unlink()

    with TestClient(main.app) as client:
        assert client.get(f"/api/jobs/{job['id']}/export/download").status_code == 404


def test_download_rejects_non_bulk_export_job(tmp_path, monkeypatch):
    _settings, _db, _archive, _exports, jobs, _export_jobs = _wire(tmp_path, monkeypatch)
    job = jobs.create("remote_import", {"gallery_id": 123})

    with TestClient(main.app) as client:
        assert client.get(f"/api/jobs/{job['id']}/export/download").status_code == 404


def test_control_routes_dispatch_by_type(tmp_path, monkeypatch):
    _settings, db, archive, _exports, jobs, export_jobs = _wire(tmp_path, monkeypatch)
    monkeypatch.setattr(export_jobs, "_start_worker", lambda job_id: None)

    calls: list[str] = []
    for name in ("resume_job", "cancel_job", "retry_job"):
        monkeypatch.setattr(main.services.imports, name, lambda job_id, n=name: calls.append(f"import:{n}"))

    bulk = jobs.create("bulk_export", {
        "work_ids": [], "options": {}, "total": 0, "packaged": 0,
        "skipped": [], "artifact_path": None, "output_name": None,
        "expires_at": None, "downloaded": False,
    })
    jobs.fail(bulk["id"], "boom")

    with TestClient(main.app) as client:
        retried = client.post(f"/api/jobs/{bulk['id']}/retry").json()
        cancelled = client.post(f"/api/jobs/{bulk['id']}/cancel").json()

    # bulk_export jobs must never fall into the import branch.
    assert calls == []
    assert retried["type"] == "bulk_export"
    assert cancelled["status"] in {"cancelled", "cancelling"}
