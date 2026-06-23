import zipfile
from datetime import timedelta
from pathlib import Path

from app.config import Settings
from app.database import Database
from app.services.archive_service import ArchiveService
from app.services.export_job_service import _now
from app.services.export_job_service import ExportJobService
from app.services.export_service import ExportService
from app.services.job_service import JobCancelled, JobService


def _png() -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc```\x00"
        b"\x00\x00\x04\x00\x01\xf6\x178U\x00\x00\x00\x00IEND\xaeB`\x82"
    )


def _make_cbz(path: Path) -> None:
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("001.png", _png())
        archive.writestr("meta.json", '{"source":"real"}')


def _setup(tmp_path):
    settings = Settings(data_dir=tmp_path / "data", database_path=tmp_path / "data" / "archive.db")
    db = Database(settings.database_path)
    db.init_schema()
    archive = ArchiveService(db, settings)
    exports = ExportService(db, settings)
    jobs = JobService(db)
    export_jobs = ExportJobService(settings, jobs, exports)
    return settings, db, archive, exports, jobs, export_jobs


def _import_work(db, archive, tmp_path, title="Work", gallery_id=1234) -> int:
    cbz = tmp_path / f"source-{gallery_id}.cbz"
    _make_cbz(cbz)
    return archive.ingest_cbz(
        cbz,
        "remote",
        title,
        gallery_id,
        {"remote": "nhentai", "media_id": f"m-{gallery_id}", "pretty_title": title},
    )


def test_enqueue_creates_bulk_export_job(tmp_path):
    _settings, db, archive, _exports, jobs, export_jobs = _setup(tmp_path)
    work_id = _import_work(db, archive, tmp_path)

    job = export_jobs.enqueue_bulk_export([work_id], {})

    assert job["type"] == "bulk_export"
    refreshed = jobs.get(job["id"])
    assert refreshed["target"]["total"] == 1
    assert refreshed["target"]["work_ids"] == [work_id]


def test_worker_packages_artifact_and_completes(tmp_path):
    _settings, db, archive, _exports, jobs, export_jobs = _setup(tmp_path)
    first = _import_work(db, archive, tmp_path, title="A", gallery_id=1)
    second = _import_work(db, archive, tmp_path, title="B", gallery_id=2)
    job = jobs.create("bulk_export", {
        "work_ids": [first, second], "options": {}, "total": 2,
        "packaged": 0, "skipped": [], "artifact_path": None,
        "output_name": None, "expires_at": None, "downloaded": False,
    })

    export_jobs.run_bulk_export(job["id"])

    done = jobs.get(job["id"])
    assert done["status"] == "completed"
    assert done["target"]["packaged"] == 2
    assert done["target"]["output_name"] == "导出合集 (2).zip"
    artifact = Path(done["target"]["artifact_path"])
    assert artifact.exists()
    with zipfile.ZipFile(artifact) as bundle:
        assert len(bundle.namelist()) == 2


def test_worker_skips_blocked_works(tmp_path):
    _settings, db, archive, _exports, jobs, export_jobs = _setup(tmp_path)
    ready = _import_work(db, archive, tmp_path, title="Ready", gallery_id=1)
    blocked = _import_work(db, archive, tmp_path, title="Blocked", gallery_id=2)
    blocked_src = db.fetchone("SELECT path FROM work_files WHERE work_id = ? AND kind = 'source_cbz'", (blocked,))
    Path(blocked_src["path"]).unlink()
    job = jobs.create("bulk_export", {
        "work_ids": [ready, blocked], "options": {}, "total": 2,
        "packaged": 0, "skipped": [], "artifact_path": None,
        "output_name": None, "expires_at": None, "downloaded": False,
    })

    export_jobs.run_bulk_export(job["id"])

    done = jobs.get(job["id"])
    assert done["status"] == "completed"
    assert done["target"]["packaged"] == 1
    assert [s["work_id"] for s in done["target"]["skipped"]] == [blocked]


def test_worker_fails_when_nothing_packaged_and_deletes_zip(tmp_path):
    _settings, db, archive, _exports, jobs, export_jobs = _setup(tmp_path)
    blocked = _import_work(db, archive, tmp_path, title="Blocked", gallery_id=2)
    blocked_src = db.fetchone("SELECT path FROM work_files WHERE work_id = ? AND kind = 'source_cbz'", (blocked,))
    Path(blocked_src["path"]).unlink()
    job = jobs.create("bulk_export", {
        "work_ids": [blocked], "options": {}, "total": 1,
        "packaged": 0, "skipped": [], "artifact_path": None,
        "output_name": None, "expires_at": None, "downloaded": False,
    })

    export_jobs.run_bulk_export(job["id"])

    done = jobs.get(job["id"])
    assert done["status"] == "failed"
    assert not export_jobs._artifact_path(job["id"]).exists()


def test_cancel_during_packaging_deletes_half_built_zip(tmp_path, monkeypatch):
    _settings, db, archive, exports, jobs, export_jobs = _setup(tmp_path)
    work_id = _import_work(db, archive, tmp_path)
    job = jobs.create("bulk_export", {
        "work_ids": [work_id], "options": {}, "total": 1,
        "packaged": 0, "skipped": [], "artifact_path": None,
        "output_name": None, "expires_at": None, "downloaded": False,
    })

    def _raise(_job_id):
        raise JobCancelled("cancelled")

    monkeypatch.setattr(jobs, "checkpoint", _raise)
    export_jobs.run_bulk_export(job["id"])

    done = jobs.get(job["id"])
    assert done["status"] == "cancelled"
    assert not export_jobs._artifact_path(job["id"]).exists()


def test_failure_during_packaging_deletes_zip_and_fails(tmp_path, monkeypatch):
    _settings, db, archive, exports, jobs, export_jobs = _setup(tmp_path)
    work_id = _import_work(db, archive, tmp_path)
    job = jobs.create("bulk_export", {
        "work_ids": [work_id], "options": {}, "total": 1,
        "packaged": 0, "skipped": [], "artifact_path": None,
        "output_name": None, "expires_at": None, "downloaded": False,
    })

    def _boom(*_a, **_k):
        raise RuntimeError("disk on fire")

    monkeypatch.setattr(exports, "build_cbz", _boom)
    export_jobs.run_bulk_export(job["id"])

    done = jobs.get(job["id"])
    assert done["status"] == "failed"
    assert "disk on fire" in (done["error"] or "")
    assert not export_jobs._artifact_path(job["id"]).exists()


def test_mark_downloaded_deletes_artifact_and_flags_target(tmp_path):
    _settings, db, archive, _exports, jobs, export_jobs = _setup(tmp_path)
    work_id = _import_work(db, archive, tmp_path)
    job = export_jobs.enqueue_bulk_export([work_id], {})
    export_jobs.run_bulk_export(job["id"])
    artifact = Path(jobs.get(job["id"])["target"]["artifact_path"])
    assert artifact.exists()

    export_jobs.mark_downloaded(job["id"])

    assert not artifact.exists()
    assert jobs.get(job["id"])["target"]["downloaded"] is True


def test_sweep_removes_orphan_downloaded_and_expired(tmp_path):
    _settings, db, archive, _exports, jobs, export_jobs = _setup(tmp_path)
    directory = export_jobs._exports_dir()
    directory.mkdir(parents=True, exist_ok=True)

    # Orphan: no matching job.
    orphan = directory / "job-9999.zip"
    orphan.write_bytes(b"PK")

    # Downloaded: job exists, flag set.
    work_id = _import_work(db, archive, tmp_path, gallery_id=1)
    downloaded_job = export_jobs.enqueue_bulk_export([work_id], {})
    export_jobs.run_bulk_export(downloaded_job["id"])
    jobs.complete(downloaded_job["id"], {"downloaded": True})
    downloaded_artifact = export_jobs._artifact_path(downloaded_job["id"])
    downloaded_artifact.write_bytes(b"PK")  # re-create to prove sweep removes it

    # Expired: job completed but expires_at in the past.
    work2 = _import_work(db, archive, tmp_path, gallery_id=2)
    expired_job = export_jobs.enqueue_bulk_export([work2], {})
    export_jobs.run_bulk_export(expired_job["id"])
    jobs.complete(expired_job["id"], {"expires_at": (_now() - timedelta(hours=1)).isoformat()})
    expired_artifact = export_jobs._artifact_path(expired_job["id"])

    # Fresh: job completed, not expired, not downloaded -> kept.
    work3 = _import_work(db, archive, tmp_path, gallery_id=3)
    fresh_job = export_jobs.enqueue_bulk_export([work3], {})
    export_jobs.run_bulk_export(fresh_job["id"])
    fresh_artifact = export_jobs._artifact_path(fresh_job["id"])

    export_jobs.sweep_exports()

    assert not orphan.exists()
    assert not downloaded_artifact.exists()
    assert not expired_artifact.exists()
    assert fresh_artifact.exists()


def test_retry_only_failed_bulk_export(tmp_path, monkeypatch):
    _settings, db, archive, _exports, jobs, export_jobs = _setup(tmp_path)
    work_id = _import_work(db, archive, tmp_path)
    job = jobs.create("bulk_export", {
        "work_ids": [work_id], "options": {}, "total": 1,
        "packaged": 0, "skipped": [], "artifact_path": None,
        "output_name": None, "expires_at": None, "downloaded": False,
    })
    jobs.fail(job["id"], "boom")
    monkeypatch.setattr(export_jobs, "_start_worker", lambda job_id: None)

    retried = export_jobs.retry_job(job["id"])
    assert retried["status"] == "queued"


def test_cancel_orphaned_bulk_export_marks_terminal(tmp_path):
    _settings, db, archive, _exports, jobs, export_jobs = _setup(tmp_path)
    work_id = _import_work(db, archive, tmp_path)
    job = jobs.create("bulk_export", {
        "work_ids": [work_id], "options": {}, "total": 1,
        "packaged": 0, "skipped": [], "artifact_path": None,
        "output_name": None, "expires_at": None, "downloaded": False,
    })
    jobs.mark_running(job["id"], "packaging", 0, 1)
    # leave a half-built artifact to prove cancel deletes it
    export_jobs._exports_dir().mkdir(parents=True, exist_ok=True)
    export_jobs._artifact_path(job["id"]).write_bytes(b"PK")

    cancelled = export_jobs.cancel_job(job["id"])

    assert cancelled["status"] == "cancelled"
    assert not export_jobs._artifact_path(job["id"]).exists()
