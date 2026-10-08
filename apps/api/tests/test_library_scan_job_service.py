import time
import threading
import zipfile
from pathlib import Path

from app.config import Settings
from app.database import Database
from app.services import comicinfo
from app.services.archive_service import ArchiveService
from app.services.job_service import JobService
from app.services.library_scan_service import LibraryScanService
from app.services.library_scan_job_service import LibraryScanJobService
from app.services.library_index_service import LibraryIndexService


def _wait_for_job(jobs, job_id, timeout=10.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        job = jobs.get(job_id)
        if job["status"] in {"completed", "failed", "cancelled"}:
            return job
        time.sleep(0.02)
    raise AssertionError(f"job {job_id} did not finish within {timeout}s (status={jobs.get(job_id)['status']})")


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
    managed = archive.libraries.list()["result"][0]
    archive.libraries.update(managed["id"], {"config": {"stable_seconds": 0}})
    jobs = JobService(db)
    scan = LibraryScanService(settings, db)
    index = LibraryIndexService(settings, db, archive.libraries)
    return settings, db, archive, jobs, scan, index


def test_run_scan_ingests_linked_and_local(tmp_path):
    settings, db, archive, jobs, scan, index = _setup(tmp_path)
    _make_cbz(settings.library_dir / "linked.cbz", web_gallery_id=177013)
    _make_cbz(settings.library_dir / "local.cbz")
    service = LibraryScanJobService(settings, jobs, index, archive.libraries)

    preview = scan.preview()
    paths = [p["path"] for p in preview["new_linked"] + preview["new_local"]]
    job = service.enqueue_scan(paths)
    done = _wait_for_job(jobs, job["id"])

    assert done["status"] == "completed"
    assert done["target"]["ingested"] == 2
    linked = db.fetchone("SELECT remote_gallery_id FROM works WHERE remote_gallery_id = 177013")
    assert linked is not None
    local_count = db.fetchone("SELECT COUNT(*) AS c FROM works WHERE remote_gallery_id IS NULL")["c"]
    assert local_count == 1


def test_run_scan_skips_unreadable(tmp_path):
    settings, db, archive, jobs, scan, index = _setup(tmp_path)
    bad = settings.library_dir / "broken.cbz"
    bad.write_bytes(b"not a zip")
    service = LibraryScanJobService(settings, jobs, index, archive.libraries)

    job = service.enqueue_scan([str(bad.resolve())])
    done = _wait_for_job(jobs, job["id"])

    assert done["status"] == "completed"
    assert done["target"]["ingested"] == 0
    assert len(done["target"]["skipped"]) == 1


def test_enqueue_scan_rejects_out_of_library_paths(tmp_path):
    """Fix 1: paths outside library_dir must be silently dropped (containment guard)."""
    settings, db, archive, jobs, scan, index = _setup(tmp_path)

    # One valid in-library CBZ, one out-of-tree CBZ written directly under tmp_path.
    in_lib = settings.library_dir / "inside.cbz"
    _make_cbz(in_lib)
    out_of_tree = tmp_path / "outside.cbz"
    _make_cbz(out_of_tree)

    service = LibraryScanJobService(settings, jobs, index, archive.libraries)
    job = service.enqueue_scan([str(in_lib), str(out_of_tree)])
    done = _wait_for_job(jobs, job["id"])

    assert done["status"] == "completed"
    assert done["target"]["ingested"] == 1
    # Out-of-tree file must not have been touched.
    assert out_of_tree.exists(), "out-of-tree file must remain untouched"
    work_count = db.fetchone("SELECT COUNT(*) AS c FROM works")["c"]
    assert work_count == 1


def test_run_scan_preserves_original_without_creating_canonical_copy(tmp_path):
    settings, db, archive, jobs, scan, index = _setup(tmp_path)

    loose = settings.library_dir / "loose_copy.cbz"
    _make_cbz(loose)

    original = loose.read_bytes()
    service = LibraryScanJobService(settings, jobs, index, archive.libraries)
    job = service.enqueue_scan([str(loose)])
    done = _wait_for_job(jobs, job["id"])

    assert done["status"] == "completed"
    assert done["target"]["ingested"] == 1

    assert loose.read_bytes() == original

    cbzs = list(settings.library_dir.glob("*.cbz"))
    assert cbzs == [loose]

    row = db.fetchone(
        "SELECT path FROM work_files WHERE kind = 'source_cbz' ORDER BY id DESC LIMIT 1"
    )
    assert row is not None
    stored = Path(row["path"])
    assert stored.exists()
    assert stored == loose


def test_active_scan_is_reused_and_pause_resume_cancel_preserve_sources(tmp_path, monkeypatch):
    settings, db, archive, jobs, scan, index = _setup(tmp_path)
    source = settings.library_dir / "book.cbz"
    _make_cbz(source)
    original = source.read_bytes()
    entered, release = threading.Event(), threading.Event()
    from app.services.archive_manifest import inspect_archive
    def blocked_probe(path):
        entered.set()
        assert release.wait(5)
        return inspect_archive(path)
    monkeypatch.setattr("app.services.library_index_service.inspect_archive", blocked_probe)
    service = LibraryScanJobService(settings, jobs, index, archive.libraries)
    job = service.enqueue_scan()
    try:
        assert entered.wait(5)
        assert service.enqueue_scan()["id"] == job["id"]
        assert jobs.pause(job["id"])["status"] == "paused"
        assert service.resume_job(job["id"])["status"] == "running"
        assert service.cancel_job(job["id"])["status"] == "cancelling"
    finally:
        release.set()
    assert _wait_for_job(jobs, job["id"])["status"] == "cancelled"
    assert db.fetchone("SELECT COUNT(*) AS n FROM works")["n"] == 0
    assert source.read_bytes() == original


def test_interrupted_scan_retry_preserves_work_identity(tmp_path):
    settings, db, archive, jobs, scan, index = _setup(tmp_path)
    _make_cbz(settings.library_dir / "book.cbz")
    library_id = archive.libraries.list()["result"][0]["id"]
    job = jobs.create("library_scan", {"library_id": library_id})
    result = index.scan(library_id, job_id=job["id"])
    work_id = db.fetchone("SELECT id FROM works")["id"]
    db.execute("UPDATE works SET favorite = 1 WHERE id = ?", (work_id,))
    db.execute("UPDATE library_scan_runs SET status = 'running' WHERE id = ?", (result["run_id"],))
    assert jobs.recover_interrupted() == 1
    assert index.recover_interrupted() == 1
    service = LibraryScanJobService(settings, jobs, index, archive.libraries)
    service.retry_job(job["id"])
    assert _wait_for_job(jobs, job["id"])["status"] == "completed"
    assert db.fetchone("SELECT COUNT(*) AS n FROM works")["n"] == 1
    assert db.fetchone("SELECT favorite FROM works WHERE id = ?", (work_id,))["favorite"] == 1


def test_shutdown_preserves_paused_scan_and_restart_can_resume(tmp_path, monkeypatch):
    settings, db, archive, jobs, _, index = _setup(tmp_path)
    source = settings.library_dir / 'book.cbz'
    _make_cbz(source)
    original = source.read_bytes()
    entered, release = threading.Event(), threading.Event()
    from app.services.archive_manifest import inspect_archive
    def blocked_probe(path):
        entered.set()
        assert release.wait(5)
        return inspect_archive(path)
    monkeypatch.setattr('app.services.library_index_service.inspect_archive', blocked_probe)
    service = LibraryScanJobService(settings, jobs, index, archive.libraries)
    job = service.enqueue_scan()
    assert entered.wait(5)
    jobs.pause(job['id'])
    release.set()
    service.close()
    assert jobs.get(job['id'])['status'] == 'paused'
    assert not service._workers and source.read_bytes() == original
    monkeypatch.setattr('app.services.library_index_service.inspect_archive', inspect_archive)
    service.start()
    service.resume_job(job['id'])
    assert _wait_for_job(jobs, job['id'])['status'] == 'completed'
    assert source.read_bytes() == original
    service.close()
