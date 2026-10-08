import concurrent.futures
import io
import json
import threading
import time
import zipfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import main
from app.database import Database
from app.services import archive_cache_service
from app.services.export_service import ExportService
from app.services.file_service import FileMaintenanceService
from app.services.job_service import JobCancelled
from app.services.library_service import LibraryService
from app.services.reader_service import ReaderService
from test_archive_cache import cached_library
from test_library_index import create_archive


def direct_library(tmp_path, mounted=False):
    values = cached_library(tmp_path)
    _, _, libraries, _, _, library, _, _ = values
    libraries.update(library["id"], {"kind": "mounted" if mounted else "local", "config": {"cache_mode": "off"}})
    return values


def stalled_read(connection, source, destination, page, options):
    Path(destination).write_bytes(b"partial")
    threading.Event().wait(60)


def test_direct_http_revision_rejects_changed_pages_and_progress_but_keeps_metadata_only_reads(tmp_path, monkeypatch):
    settings, db, _, index, root, library, archive, work_id = direct_library(tmp_path)
    for name, service in {"archive": archive, "library": LibraryService(db), "reader": ReaderService(db, archive.cache)}.items():
        monkeypatch.setattr(main.services, name, service)
    client = TestClient(main.create_app(enforce_auth=False))
    prepared = client.post(f"/api/works/{work_id}/reading-source").json()
    revision = prepared["source_revision"]
    assert prepared["status"] == "direct" and len(prepared["pages"]) == 2 and len(revision) == 64
    url = f"/api/works/{work_id}/pages/1"
    query = {"source_revision": revision}
    first = client.get(url, params=query)
    assert first.status_code == 200
    assert client.get(url + "/thumb", params=query).status_code == 200
    assert list(settings.thumbs_dir.glob(f"{work_id}-r{revision}-*.jpg"))
    assert client.get(url, params={"source_revision": "bad"}).status_code == 422
    assert client.get(url, params={**query, "lease": "a" * 32}).status_code == 409
    state_url = f"/api/works/{work_id}/reader-state"
    assert client.patch(state_url, json={**query, "page_index": 1}).status_code == 200
    session = client.post(f"/api/works/{work_id}/reading-sessions", json={**query, "session_key": "direct-before-change"}).json()
    assert session["page_count"] == 2
    create_archive(root / "one.cbz", title="Changed metadata")
    index.scan(library["id"])
    assert client.post(f"/api/works/{work_id}/reading-source").json()["source_revision"] == revision
    assert client.get(url, params=query).content == first.content
    with zipfile.ZipFile(root / "one.cbz", "a") as book:
        book.writestr("nested/000.jpg", first.content)
    index.scan(library["id"])
    previous_state = client.get(state_url).json()
    assert previous_state["page_count"] == 3 and not previous_state["completed"]
    assert client.get(url, params=query).status_code == 409
    assert client.get(url + "/thumb", params=query).status_code == 409
    assert client.patch(state_url, json={**query, "page_index": 3, "completed": True}).status_code == 409
    assert client.get(state_url).json() == previous_state
    assert client.post(f"/api/works/{work_id}/reading-sessions", json={**query, "session_key": "direct-after-change"}).status_code == 409
    finished = client.patch(f"/api/works/{work_id}/reading-sessions/{session['id']}", json={"duration_seconds": 15, "page_index": 3, "finished": True}).json()
    assert finished["last_page_index"] == 2 and finished["page_count"] == 2 and finished["duration_seconds"] == 15
    new = client.post(f"/api/works/{work_id}/reading-source").json()
    assert new["source_revision"] != revision and len(new["pages"]) == 3
    assert client.get(url, params={"source_revision": new["source_revision"]}).status_code == 200
    db.execute("UPDATE library_items SET status = 'pending' WHERE work_id = ?", (work_id,))
    assert client.post(f"/api/works/{work_id}/reading-source").status_code == 409
    assert not db.fetchone("SELECT id FROM archive_cache")
    archive.cache.close()


def test_uncached_mounted_page_thumbnail_and_export_never_probe_source_in_request_thread(tmp_path, monkeypatch):
    settings, db, _, _, root, _, archive, work_id = direct_library(tmp_path, mounted=True)
    before = (root / "one.cbz").read_bytes()
    real_stat = Path.stat
    def local_stat(path, *args, **kwargs):
        assert not path.is_relative_to(root), "mount stat belongs in the bounded child"
        return real_stat(path, *args, **kwargs)
    monkeypatch.setattr(Path, "stat", local_stat)
    revision = archive.cache.prepare(work_id)["source_revision"]
    assert archive.read_page(work_id, 1, source_revision=revision)[1] == "image/jpeg"
    assert archive.read_page_thumbnail(work_id, 1, 64, source_revision=revision)[1] == "image/jpeg"
    exports = ExportService(db, settings, archive.cache)
    buffer = io.BytesIO()
    assert exports.write_cbz(work_id, buffer).endswith(".cbz")
    with zipfile.ZipFile(buffer) as result:
        assert result.testzip() is None and "ComicInfo.xml" in result.namelist()
    assert not db.fetchone("SELECT id FROM archive_cache") and not db.fetchone("SELECT id FROM jobs")
    assert not archive.cache._direct_processes and not list(settings.archive_cache_dir.iterdir())
    monkeypatch.setattr(Path, "stat", real_stat)
    assert (root / "one.cbz").read_bytes() == before
    archive.cache.close()


def test_uncached_mount_timeout_cancel_and_unstoppable_processes_keep_bounded_slots(tmp_path, monkeypatch):
    settings, db, _, _, _, library, archive, work_id = direct_library(tmp_path, mounted=True)
    cache = archive.cache
    row = db.fetchone("SELECT config_json FROM media_libraries WHERE id = ?", (library["id"],))
    db.execute("UPDATE media_libraries SET config_json = ? WHERE id = ?", (json.dumps({**json.loads(row["config_json"]), "io_timeout_seconds": .2}), library["id"]))
    source = cache.direct_source(work_id)
    page = archive.list_pages(work_id)[0]
    monkeypatch.setattr(archive_cache_service, "_read_mounted", stalled_read)
    started = time.monotonic()
    with pytest.raises(TimeoutError):
        archive.read_page(work_id, 1)
    assert time.monotonic() - started < 3 and not cache._direct_processes
    for name, service in {"archive": archive, "settings": settings, "exports": ExportService(db, settings, cache)}.items():
        monkeypatch.setattr(main.services, name, service)
    client = TestClient(main.create_app(enforce_auth=False))
    assert client.get(f"/api/works/{work_id}/pages/1").status_code == 503
    assert client.get(f"/api/works/{work_id}/export/download").status_code == 503
    assert not list(settings.export_jobs_dir.glob("download-*.zip"))
    assert not list(settings.archive_cache_dir.iterdir())
    def cancelled():
        raise JobCancelled()
    with pytest.raises(JobCancelled):
        with cache.mounted_read(source, page, checkpoint=cancelled):
            pytest.fail("cancelled read must not publish")
    assert not cache._direct_processes
    real_stop = cache._stop
    monkeypatch.setattr(cache, "_stop", lambda _process: False)
    try:
        for _ in range(4):
            with pytest.raises(TimeoutError):
                with cache.mounted_read(source, page):
                    pytest.fail("timed out read must not publish")
        assert len(cache._direct_processes) == 4 and cache.direct_in_use(work_id)
        with pytest.raises(OSError, match="繁忙"):
            with cache.mounted_read(source, page):
                pytest.fail("must not spawn a fifth process")
        targets = [{"kind": "work", "work_id": work_id}]
        assert "读取或导出" in FileMaintenanceService(db, settings, cache).preview_delete(targets)["items"][0]["warnings"][0]
    finally:
        monkeypatch.setattr(cache, "_stop", real_stop)
        cache.close()
        cache._reap_direct()
    assert not cache._direct_processes and not list(settings.archive_cache_dir.iterdir())


def test_direct_read_checks_indexed_stat_before_member_read_and_process_start_failure_cleans_pipes(tmp_path, monkeypatch):
    settings, _, _, _, root, _, archive, work_id = direct_library(tmp_path)
    revision = archive.cache.prepare(work_id)["source_revision"]
    with (root / "one.cbz").open("ab") as book:
        book.write(b"changed without reindex")
    with pytest.raises(FileNotFoundError, match="重新扫描"):
        archive.read_page(work_id, 1, source_revision=revision)
    from multiprocessing.process import BaseProcess
    def unavailable(_self):
        raise OSError("cannot spawn")
    monkeypatch.setattr(BaseProcess, "start", unavailable)
    with pytest.raises(OSError, match="cannot spawn"):
        with archive.cache.mounted_read(archive.cache.direct_source(work_id), archive.list_pages(work_id)[0]):
            pytest.fail("failed spawn must not publish")
    assert not archive.cache._direct_processes and not list(settings.archive_cache_dir.iterdir())
    archive.cache.close()


def test_reading_session_page_count_migration_preserves_old_sessions(tmp_path):
    db = Database(tmp_path / "migration.db")
    db.init_schema()
    work_id = db.execute("INSERT INTO works(title, source, page_count) VALUES ('Old', 'local', 9)").lastrowid
    db.execute("INSERT INTO reading_sessions(client_key, work_id, page_count, last_page_index, duration_seconds) VALUES ('old-session', ?, 9, 7, 30)", (work_id,))
    db.execute("ALTER TABLE reading_sessions DROP COLUMN page_count")
    db.init_schema()
    session = db.fetchone("SELECT * FROM reading_sessions")
    assert session["page_count"] == 9 and session["last_page_index"] == 7 and session["duration_seconds"] == 30
    db.execute("UPDATE works SET page_count = 3")
    db.init_schema()
    assert ReaderService(db).update_session(work_id, session["id"], 31, 8, True)["last_page_index"] == 8


def test_mounted_export_pause_time_does_not_count_toward_io_timeout(tmp_path):
    settings, db, _, _, _, library, archive, work_id = direct_library(tmp_path, mounted=True)
    row = db.fetchone("SELECT config_json FROM media_libraries WHERE id = ?", (library["id"],))
    db.execute("UPDATE media_libraries SET config_json = ? WHERE id = ?", (json.dumps({**json.loads(row["config_json"]), "io_timeout_seconds": .5}), library["id"]))
    paused = False
    def checkpoint():
        nonlocal paused
        if not paused:
            paused = True
            time.sleep(.6)
    output = io.BytesIO()
    ExportService(db, settings, archive.cache).write_cbz(work_id, output, checkpoint=checkpoint)
    with zipfile.ZipFile(output) as exported:
        assert exported.testzip() is None
    assert paused and not list(settings.archive_cache_dir.iterdir())
    archive.cache.close()


def test_six_concurrent_browser_reads_queue_without_spurious_mount_errors(tmp_path):
    settings, _, _, _, _, _, archive, work_id = direct_library(tmp_path, mounted=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as readers:
        results = list(readers.map(lambda _: archive.read_page_thumbnail(work_id, 1, 64), range(6)))
    assert len(results) == 6 and all(result == results[0] for result in results)
    assert not archive.cache._direct_processes and not archive.cache._direct_waiters
    assert not list(settings.archive_cache_dir.iterdir())
    archive.cache.close()
