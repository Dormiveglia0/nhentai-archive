import zipfile
from pathlib import Path

from app.config import Settings
from app.database import Database
from app.services import comicinfo
from app.services.archive_service import ArchiveService
from app.services.job_service import JobService
from app.services.library_scan_service import LibraryScanService
from app.services.library_scan_job_service import LibraryScanJobService


def _png() -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc```\x00"
        b"\x00\x00\x04\x00\x01\xf6\x178U\x00\x00\x00\x00IEND\xaeB`\x82"
    )


def _make_cbz(path: Path, web_gallery_id=None) -> None:
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("001.png", _png())
        if web_gallery_id is not None:
            xml = comicinfo.to_xml({"Title": "T", "Web": f"https://nhentai.net/g/{web_gallery_id}/"})
            archive.writestr("ComicInfo.xml", xml)


def _setup(tmp_path):
    settings = Settings(data_dir=tmp_path / "data", database_path=tmp_path / "data" / "archive.db")
    settings.ensure_directories()
    db = Database(settings.database_path)
    db.init_schema()
    archive = ArchiveService(db, settings)
    jobs = JobService(db)
    scan = LibraryScanService(settings, db)
    return settings, db, archive, jobs, scan


def test_run_scan_ingests_linked_and_local(tmp_path):
    settings, db, archive, jobs, scan = _setup(tmp_path)
    _make_cbz(settings.library_dir / "linked.cbz", web_gallery_id=177013)
    _make_cbz(settings.library_dir / "local.cbz")
    service = LibraryScanJobService(settings, jobs, archive, scan)

    preview = scan.preview()
    paths = [p["path"] for p in preview["new_linked"] + preview["new_local"]]
    job = service.enqueue_scan(paths)
    service._workers[job["id"]].join(timeout=10)

    done = jobs.get(job["id"])
    assert done["status"] == "completed"
    assert done["target"]["ingested"] == 2
    linked = db.fetchone("SELECT remote_gallery_id FROM works WHERE remote_gallery_id = 177013")
    assert linked is not None
    local_count = db.fetchone("SELECT COUNT(*) AS c FROM works WHERE remote_gallery_id IS NULL")["c"]
    assert local_count == 1


def test_run_scan_skips_unreadable(tmp_path):
    settings, db, archive, jobs, scan = _setup(tmp_path)
    bad = settings.library_dir / "broken.cbz"
    bad.write_bytes(b"not a zip")
    service = LibraryScanJobService(settings, jobs, archive, scan)

    job = service.enqueue_scan([str(bad.resolve())])
    service._workers[job["id"]].join(timeout=10)

    done = jobs.get(job["id"])
    assert done["status"] == "completed"
    assert done["target"]["ingested"] == 0
    assert len(done["target"]["skipped"]) == 1
