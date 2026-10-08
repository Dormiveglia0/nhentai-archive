from pathlib import Path
import pytest

from app.config import Settings
from app.database import Database
from app.services.archive_service import ArchiveService
from app.services.import_service import ImportService
from app.services.job_service import JobService


def _service(tmp_path):
    settings = Settings(data_dir=tmp_path / "data", database_path=tmp_path / "data" / "archive.db")
    db = Database(settings.database_path)
    db.init_schema()
    jobs = JobService(db)
    archive = ArchiveService(db, settings)
    return settings, db, jobs, ImportService(settings, None, jobs, archive, None)


def test_enqueue_remote_import_reuses_active_job(tmp_path, monkeypatch):
    _settings, _db, _jobs, imports = _service(tmp_path)
    started: list[tuple[int, int]] = []
    monkeypatch.setattr(
        imports,
        "_start_remote_import",
        lambda job_id, gallery_id: started.append((job_id, gallery_id)),
    )

    first = imports.enqueue_remote_import(42)
    second = imports.enqueue_remote_import(42)

    assert second["id"] == first["id"]
    assert started == [(first["id"], 42)]


def test_enqueue_already_imported_gallery_returns_completed_job(tmp_path):
    _settings, db, _jobs, imports = _service(tmp_path)
    db.execute(
        "INSERT INTO works (id, remote_gallery_id, title, source) VALUES (7, 42, 'Known', 'remote')"
    )

    job = imports.enqueue_remote_import(42)

    assert job["status"] == "completed"
    assert job["progress"]["percent"] == 100
    assert job["target"]["work_id"] == 7
    assert job["target"]["already_imported"] is True


def test_failed_download_removes_partial_temp_file(tmp_path):
    settings, _db, jobs, imports = _service(tmp_path)

    class FailingClient:
        def gallery(self, gallery_id, include=None):
            return {"id": gallery_id, "title": {"english": "Failure"}, "tags": []}

        def download_url(self, gallery_id):
            return {"url": f"https://example.invalid/{gallery_id}.cbz"}

        def download_file(self, _url, destination, progress=None):
            Path(destination).write_bytes(b"partial")
            if progress:
                progress(5, 10)
            raise OSError("connection lost")

    class CacheStub:
        def cache_gallery(self, _gallery):
            pass

        def cache_tags(self, _tags):
            pass

    imports.client = FailingClient()
    imports.discover = CacheStub()
    job = jobs.create("remote_import", {"gallery_id": 42})

    imports.run_remote_import(job["id"], 42)

    assert jobs.get(job["id"])["status"] == "failed"
    assert jobs.get(job["id"])["progress"] == {"current": 5, "total": 10, "percent": 53}
    assert not (settings.tmp_dir / "nhentai-42.cbz").exists()


def test_readonly_import_is_rejected_before_network_and_active_import_protects_existing_work(tmp_path):
    from app.services.file_service import FileMaintenanceService
    from test_library_index import create_archive
    settings, db, jobs, imports = _service(tmp_path)
    source = tmp_path / "source.cbz"
    create_archive(source)
    work_id = imports.archive.ingest_cbz(source, "remote", "Book", 42, {})
    job = jobs.create("remote_import", {"gallery_id": 42})
    preview = FileMaintenanceService(db, settings, imports.archive.cache).preview_delete([{"kind": "work", "work_id": work_id}])
    assert preview["works_to_remove"] == 0 and "正在导入" in preview["items"][0]["warnings"][0]
    db.execute("UPDATE media_libraries SET read_only = 1 WHERE kind = 'managed'")
    imports.run_remote_import(job["id"], 42)
    assert jobs.get(job["id"])["status"] == "failed"
    assert "只读" in jobs.get(job["id"])["error"]
    with pytest.raises(PermissionError, match="只读"):
        imports.archive.ingest_cbz(tmp_path / "not-opened.cbz", "local", "Book", None, {})
    assert db.fetchone("SELECT COUNT(*) AS n FROM works")["n"] == 1
