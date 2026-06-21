import io
import zipfile
from pathlib import Path

from app.config import Settings
from app.database import Database
from app.services.archive_service import ArchiveService
from app.services.export_service import ExportService
from app.services.file_service import FileMaintenanceService
from app.services.governance_service import GovernanceService
from app.services.dictionary_service import DictionaryService
from app.services.job_service import JobService
from app.services.library_service import LibraryService
from app.services.reader_service import ReaderService
from app.services.workbench_service import WorkbenchService


def _png() -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc```\x00"
        b"\x00\x00\x04\x00\x01\xf6\x178U\x00\x00\x00\x00IEND\xaeB`\x82"
    )


def _make_cbz(path: Path, pages: int = 3) -> None:
    with zipfile.ZipFile(path, "w") as archive:
        for index in range(1, pages + 1):
            archive.writestr(f"{index:03d}.png", _png())


def _build(tmp_path):
    settings = Settings(data_dir=tmp_path / "data", database_path=tmp_path / "data" / "archive.db")
    db = Database(settings.database_path)
    db.init_schema()
    archive = ArchiveService(db, settings)
    library = LibraryService(db)
    dictionary = DictionaryService(db, client=None)
    governance = GovernanceService(db, dictionary)
    jobs = JobService(db)
    files = FileMaintenanceService(db, settings)
    exports = ExportService(db, settings)
    reader = ReaderService(db)
    workbench = WorkbenchService(library, governance, jobs, files, exports)
    return settings, db, archive, reader, jobs, workbench


def _import_work(archive, tmp_path, name, title, source, gallery_id, pages=3):
    cbz = tmp_path / f"{name}.cbz"
    _make_cbz(cbz, pages)
    return archive.ingest_cbz(cbz, source, title, gallery_id, {"remote": "nhentai" if source == "remote" else None})


def test_overview_empty_db_is_all_real_zeros(tmp_path):
    _, _, _, _, _, workbench = _build(tmp_path)

    data = workbench.overview()

    assert data["library"]["total"] == 0
    assert data["governance"]["total"] == 0
    assert data["files"]["work_count"] == 0
    assert data["exports"]["total"] == 0
    assert data["jobs"] == {
        "running": 0,
        "queued": 0,
        "paused": 0,
        "cancelling": 0,
        "failed": 0,
        "completed": 0,
        "cancelled": 0,
        "failed_recent": [],
    }
    assert data["continue_reading"] == []
    assert data["recent_added"] == []


def test_overview_reflects_real_works_jobs_and_progress(tmp_path):
    settings, db, archive, reader, jobs, workbench = _build(tmp_path)
    work_id = _import_work(archive, tmp_path, "w1", "Rainy Day", "remote", 100001, pages=4)
    reader.update_state(work_id, page_index=2, completed=False)

    failed = jobs.create("remote_import", {"gallery_id": 100001})
    jobs.fail(failed["id"], "remote limited", retry_after=60)
    done = jobs.create("remote_import", {"gallery_id": 100002})
    jobs.complete(done["id"])

    data = workbench.overview()

    assert data["library"]["total"] == 1
    assert data["library"]["reading"] == 1
    assert data["jobs"]["failed"] == 1
    assert data["jobs"]["completed"] == 1
    assert len(data["jobs"]["failed_recent"]) == 1
    recent_fail = data["jobs"]["failed_recent"][0]
    assert recent_fail["id"] == failed["id"]
    assert recent_fail["error"] == "remote limited"
    assert recent_fail["target"] == {"gallery_id": 100001}
    assert [w["id"] for w in data["continue_reading"]] == [work_id]
    assert work_id in [w["id"] for w in data["recent_added"]]


def test_overview_caps_failed_recent_at_five(tmp_path):
    _, _, _, _, jobs, workbench = _build(tmp_path)
    for i in range(7):
        job = jobs.create("remote_import", {"gallery_id": 200000 + i})
        jobs.fail(job["id"], f"boom {i}")

    data = workbench.overview()

    assert data["jobs"]["failed"] == 7
    assert len(data["jobs"]["failed_recent"]) == 5
