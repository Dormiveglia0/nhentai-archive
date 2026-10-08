import concurrent.futures
import json
import os
import struct
import threading
import time
import zipfile
import zlib
from pathlib import Path

import pytest

from app.services import archive_cache_service
from app.services.archive_manifest import inspect_archive
from app.services.archive_service import ArchiveService, _make_thumbnail
from app.services.reader_service import ReaderService
from test_library_index import create_archive, setup_index


def wait_for_cache(cache, prepared):
    job_id = prepared["job"]["id"]
    deadline = time.monotonic() + 8
    while time.monotonic() < deadline:
        job = cache.jobs.get(job_id)
        if job["status"] in {"completed", "failed", "cancelled"} and job_id not in cache._workers:
            return job
        time.sleep(0.02)
    raise AssertionError(cache.jobs.get(job_id))


def blocked_copy(connection, source, destination):
    Path(destination).write_bytes(b"partial")
    connection.recv()  # Simulate an IO call that never produces progress.


def unresponsive_copy(connection, source, destination):
    Path(destination).write_bytes(b"partial")
    threading.Event().wait(60)


def cached_library(tmp_path):
    settings, db, libraries, index, root, library = setup_index(tmp_path, cache_mode="always")
    source = root / "one.cbz"
    create_archive(source)
    index.scan(library["id"])
    archive = ArchiveService(db, settings)
    work_id = db.fetchone("SELECT work_id FROM library_items")["work_id"]
    archive.cache.configure({"min_free_bytes": 0})
    return settings, db, libraries, index, root, library, archive, work_id


def test_changed_source_pending_scan_cannot_cache_old_manifest_but_existing_lease_still_reads(tmp_path):
    _, db, _, _, root, _, archive, work_id = cached_library(tmp_path)
    cache = archive.cache
    prepared = cache.prepare(work_id)
    assert wait_for_cache(cache, prepared)["status"] == "completed"
    ready = cache.prepare(work_id)
    old_page = archive.read_page(work_id, 1, ready["lease"])[0]
    source = root / "one.cbz"
    with source.open("ab") as handle:
        handle.write(b"new source version")
    info = source.stat()
    db.execute("UPDATE library_items SET status = 'pending', size_bytes = ?, mtime_ns = ? WHERE work_id = ?", (info.st_size, info.st_mtime_ns, work_id))
    with pytest.raises(FileNotFoundError, match="索引尚未就绪"):
        cache.prepare(work_id)
    assert db.fetchone("SELECT COUNT(*) AS n FROM archive_cache")["n"] == 1
    assert archive.read_page(work_id, 1, ready["lease"])[0] == old_page
    cache.release(work_id, ready["lease"])
    cache.close()


def test_concurrent_prepare_copies_once_and_reads_offline(tmp_path, monkeypatch):
    settings, db, libraries, _, root, library, archive, work_id = cached_library(tmp_path)
    source = root / "one.cbz"
    original = source.read_bytes()
    cache = archive.cache
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(lambda _: cache.prepare(work_id), range(8)))
    assert len({result["cache_id"] for result in results}) == 1
    pending = next(result for result in results if result.get("job"))
    assert wait_for_cache(cache, pending)["status"] == "completed"
    ready = cache.prepare(work_id)
    assert len(ready["pages"]) == 2
    assert cache._path(ready["cache_id"]).read_bytes() == original
    assert source.read_bytes() == original and not list(settings.archive_cache_dir.glob("*.part"))
    assert db.fetchone("SELECT COUNT(*) AS n FROM jobs WHERE type = 'archive_cache'")["n"] == 1
    first = archive.read_page(work_id, 1, ready["lease"])
    source.rename(root / "offline.cbz")
    db.execute("UPDATE library_items SET status = 'missing'")
    monkeypatch.setattr(libraries, "source_path", lambda *_: (_ for _ in ()).throw(AssertionError("no mounted IO")))
    assert cache.prepare(work_id)["status"] == "ready"
    assert archive.read_page(work_id, 1, ready["lease"]) == first
    assert archive.read_page_thumbnail(work_id, 1, 64, ready["lease"])[1] == "image/jpeg"
    assert cache.cancel_job(pending["job"]["id"])["status"] == "completed"
    assert cache.sweep(clear=True)["deleted"] == 0
    cache.close()


def test_reader_snapshot_stays_on_original_revision_and_protects_new_progress(tmp_path):
    settings, db, _, index, root, library, archive, work_id = cached_library(tmp_path)
    cache = archive.cache
    assert wait_for_cache(cache, cache.prepare(work_id))["status"] == "completed"
    old = cache.prepare(work_id)
    old_page = archive.read_page(work_id, 1, old["lease"])
    archive.read_page_thumbnail(work_id, 1, 240, old["lease"])
    old_thumbnail = next(settings.thumbs_dir.glob(f"{work_id}-c{old['cache_id']}-*.jpg"))
    thumbnail_bytes = old_thumbnail.read_bytes()
    reader = ReaderService(db, cache)
    session = reader.start_session(work_id, "snapshot-reader", 1, old["lease"])
    source = root / "one.cbz"
    create_archive(source, title="Metadata changed")
    index.scan(library["id"])
    assert old_thumbnail.read_bytes() == thumbnail_bytes
    assert reader.update_state(work_id, 2, True, old["lease"])["completed"]
    with zipfile.ZipFile(source, "a") as book:
        book.writestr("nested/000.jpg", old_page[0])
    assert index.scan(library["id"])["counts"]["indexed"] == 1
    assert old_thumbnail.read_bytes() == thumbnail_bytes
    assert wait_for_cache(cache, cache.prepare(work_id))["status"] == "completed"
    new = cache.prepare(work_id)
    assert new["cache_id"] != old["cache_id"] and len(new["pages"]) == 3
    assert archive.read_page(work_id, 1, old["lease"]) == old_page
    assert reader.update_session(work_id, session["id"], 15, 3)["last_page_index"] == 2
    state = reader.update_state(work_id, 2, True, old["lease"])
    assert state["page_count"] == 3 and not state["completed"]
    assert reader.update_state(work_id, 3, True, new["lease"])["completed"]
    assert reader.update_state(work_id, 1, False, old["lease"])["completed"]
    assert reader.get_state(work_id)["page_index"] == 3
    assert cache.sweep(clear=True)["deleted"] == 0
    reader.update_session(work_id, session["id"], 16, 2, finished=True)
    cache.release(work_id, old["lease"])
    assert cache.sweep(clear=True)["deleted"] == 1
    assert cache._path(new["cache_id"]).is_file()
    assert source.is_file() and Path(db.fetchone("SELECT cover_path FROM works")["cover_path"]).is_file()
    assert reader.update_state(work_id, 3, True, new["lease"])["completed"]
    cache.release(work_id, new["lease"])
    assert cache.sweep(clear=True)["deleted"] == 1 and list(settings.archive_cache_dir.iterdir()) == []
    cache.close()


def test_quota_reserves_queued_bytes_and_evicts_only_unleased_cache(tmp_path, monkeypatch):
    settings, db, _, index, root, library, archive, work_id = cached_library(tmp_path)
    cache = archive.cache
    size = (root / "one.cbz").stat().st_size
    monkeypatch.setattr(cache, "config", lambda: {**archive_cache_service.CACHE_DEFAULTS, "max_bytes": size + 100, "min_free_bytes": 0})
    create_archive(root / "two.cbz", title="Second")
    index.scan(library["id"])
    work_two = db.fetchone("SELECT work_id FROM library_items WHERE relative_path = 'two.cbz'")["work_id"]
    start = cache._start
    monkeypatch.setattr(cache, "_start", lambda *_: None)
    first = cache.prepare(work_id)
    with pytest.raises(ValueError, match="空间不足"):
        cache.prepare(work_two)
    assert cache.summary()["reserved_bytes"] == size
    cache.cancel_job(first["job"]["id"])
    monkeypatch.setattr(cache, "_start", start)
    cache.retry_job(first["job"]["id"])
    assert wait_for_cache(cache, cache.prepare(work_id))["status"] == "completed"
    ready = cache.prepare(work_id)
    with pytest.raises(ValueError, match="在用作品受保护"):
        cache.prepare(work_two)
    cache.release(work_id, ready["lease"])
    assert wait_for_cache(cache, cache.prepare(work_two))["status"] == "completed"
    assert not cache._path(first["cache_id"]).exists()
    assert len(list(settings.archive_cache_dir.glob("*.cbz"))) == 1
    assert len(list(root.glob("*.cbz"))) == 2
    cache.close()


def test_source_change_rejects_partial_cache_and_scanned_revision_can_retry(tmp_path):
    settings, _, _, index, root, library, archive, work_id = cached_library(tmp_path)
    cache = archive.cache
    create_archive(root / "one.cbz", title="Modified")
    new_source = (root / "one.cbz").read_bytes()
    failed = cache.prepare(work_id)
    assert wait_for_cache(cache, failed)["status"] == "failed"
    assert list(settings.archive_cache_dir.iterdir()) == []
    assert (root / "one.cbz").read_bytes() == new_source
    index.scan(library["id"])
    assert wait_for_cache(cache, cache.prepare(work_id))["status"] == "completed"
    cache.close()


def test_cancel_timeout_pause_and_restart_release_owned_partial_files(tmp_path, monkeypatch):
    settings, db, _, _, _, _, archive, work_id = cached_library(tmp_path)
    cache = archive.cache
    monkeypatch.setattr(archive_cache_service, "_copy_source", blocked_copy)
    row = db.fetchone("SELECT id, config_json FROM media_libraries WHERE kind = 'local'")
    config = {**json.loads(row["config_json"]), "io_timeout_seconds": 0.8}
    db.execute("UPDATE media_libraries SET config_json = ? WHERE id = ?", (json.dumps(config), row["id"]))
    prepared = cache.prepare(work_id)
    job_id = prepared["job"]["id"]
    deadline = time.monotonic() + 3
    while not list(settings.archive_cache_dir.glob("*.part")) and time.monotonic() < deadline:
        time.sleep(0.02)
    assert list(settings.archive_cache_dir.glob("*.part"))
    cache.jobs.pause(job_id)
    time.sleep(0.95)
    assert cache.jobs.get(job_id)["status"] == "paused"
    cache.resume_job(job_id)
    assert wait_for_cache(cache, prepared)["status"] == "failed"
    assert list(settings.archive_cache_dir.iterdir()) == []
    cache.retry_job(job_id)
    cache.cancel_job(job_id)
    assert wait_for_cache(cache, prepared)["status"] == "cancelled"
    assert list(settings.archive_cache_dir.iterdir()) == []
    db.execute("UPDATE archive_cache SET status = 'downloading' WHERE id = ?", (prepared["cache_id"],))
    cache._path(prepared["cache_id"], True).write_bytes(b"interrupted")
    (settings.archive_cache_dir / "999.cbz").write_bytes(b"orphan")
    (settings.archive_cache_dir / "keep.txt").write_text("unrelated")
    cache.recover_interrupted()
    assert db.fetchone("SELECT status FROM archive_cache")["status"] == "failed"
    assert [p.name for p in settings.archive_cache_dir.iterdir()] == ["keep.txt"]
    cache.close()


def test_cache_options_and_owned_directory_boundaries(tmp_path):
    settings, _, libraries, _, _, _, archive, _ = cached_library(tmp_path)
    for bad in ({"max_bytes": -1}, {"max_parallel": True}, {"unknown": 1}, {"ttl_hours": 0}):
        with pytest.raises(ValueError):
            archive.cache.configure(bad)
    for owned in (settings.archive_cache_dir, settings.covers_dir, settings.tmp_dir / "nested"):
        with pytest.raises(ValueError, match="缓存、封面或导出"):
            libraries.create({"name": "非法目录", "root_path": str(owned)})
    archive.cache.close()


def test_in_flight_read_survives_client_release_and_clear_then_reclaims_thumbnails(tmp_path):
    settings, _, _, _, _, _, archive, work_id = cached_library(tmp_path)
    cache = archive.cache
    assert wait_for_cache(cache, cache.prepare(work_id))["status"] == "completed"
    ready = cache.prepare(work_id)
    archive.read_page_thumbnail(work_id, 1, 64, ready["lease"])
    with cache.source(work_id, ready["lease"]) as (path, _, _):
        cache.release(work_id, ready["lease"])
        assert cache.sweep(clear=True)["deleted"] == 0 and path.is_file()
    assert cache.sweep(clear=True)["deleted"] == 1
    assert list(settings.thumbs_dir.iterdir()) == []
    cache.close()


def test_pause_at_publication_can_resume_without_holding_cache_lock(tmp_path, monkeypatch):
    _, _, _, _, _, _, archive, work_id = cached_library(tmp_path)
    cache = archive.cache
    entered = threading.Event()
    complete = cache.jobs.complete
    def pause_before_complete(job_id, target):
        cache.jobs.pause(job_id)
        entered.set()
        complete(job_id, target)
    monkeypatch.setattr(cache.jobs, "complete", pause_before_complete)
    prepared = cache.prepare(work_id)
    assert entered.wait(5)
    resumed = threading.Thread(target=cache.resume_job, args=(prepared["job"]["id"],), daemon=True)
    resumed.start()
    resumed.join(2)
    if resumed.is_alive():
        cache.jobs.resume(prepared["job"]["id"])
        resumed.join(2)
        raise AssertionError("cache publication must not lock out resume")
    assert wait_for_cache(cache, prepared)["status"] == "completed"
    cache.close()


def test_unstoppable_copy_retains_capacity_after_job_history_is_cleared(tmp_path, monkeypatch):
    settings, db, _, index, root, library, archive, work_id = cached_library(tmp_path)
    cache = archive.cache
    stop = cache._stop
    monkeypatch.setattr(archive_cache_service, "_copy_source", unresponsive_copy)
    monkeypatch.setattr(cache, "_stop", lambda _process: False)
    config = {**json.loads(db.fetchone("SELECT config_json FROM media_libraries WHERE id = ?", (library["id"],))["config_json"]), "io_timeout_seconds": 0.5}
    create_archive(root / "two.cbz", title="Second")
    index.scan(library["id"])
    db.execute("UPDATE media_libraries SET config_json = ? WHERE id = ?", (json.dumps(config), library["id"]))
    work_two = db.fetchone("SELECT work_id FROM library_items WHERE relative_path = 'two.cbz'")["work_id"]
    size = (root / "one.cbz").stat().st_size
    monkeypatch.setattr(cache, "config", lambda: {**archive_cache_service.CACHE_DEFAULTS, "max_bytes": size + 100, "min_free_bytes": 0})
    prepared = cache.prepare(work_id)
    try:
        assert wait_for_cache(cache, prepared)["status"] == "failed"
        assert db.fetchone("SELECT status FROM archive_cache")["status"] == "blocked"
        cache.jobs.clear_finished()
        assert cache.prepare(work_id)["status"] == "failed"
        assert cache.summary()["reserved_bytes"] == size
        assert cache.sweep(clear=True)["deleted"] == 0
        with pytest.raises(ValueError, match="空间不足"):
            cache.prepare(work_two)
    finally:
        for child in list(cache._processes.values()):
            stop(child)
        monkeypatch.setattr(cache, "_stop", stop)
        cache.sweep(clear=True)
        cache.close()
    assert not list(settings.archive_cache_dir.glob("*.part"))


def test_oversized_zip_directory_is_rejected_before_allocation(tmp_path, monkeypatch):
    source = tmp_path / "oversized.cbz"
    source.write_bytes(struct.pack(zipfile.structEndArchive, zipfile.stringEndArchive, 0, 0, 60000, 60000, 0, 0, 0))
    monkeypatch.setattr(zipfile, "ZipFile", lambda *_: (_ for _ in ()).throw(AssertionError("directory must be bounded first")))
    with pytest.raises(ValueError, match="归档目录过大"):
        inspect_archive(source)


def test_thumbnail_rejects_oversized_image_header_before_decoding(tmp_path):
    from test_archive_and_reader import make_tiny_cbz
    source = tmp_path / "one.cbz"
    make_tiny_cbz(source)
    with zipfile.ZipFile(source) as content:
        png = content.read("001.png")
    oversized_header = png[:16] + struct.pack(">II", 6000, 6000) + png[24:29]
    oversized = oversized_header + struct.pack(">I", zlib.crc32(oversized_header[12:])) + png[33:]
    with pytest.raises(ValueError, match="3000万"):
        _make_thumbnail(oversized, 320)


def test_cache_checks_crc_of_pages_not_read_by_cover_index(tmp_path):
    settings, _, _, _, root, _, archive, work_id = cached_library(tmp_path)
    source = root / "one.cbz"
    before = source.stat()
    with zipfile.ZipFile(source) as book:
        info = book.getinfo("nested/Cover.jpg")
        offset = info.header_offset + 30 + len(info.filename.encode()) + len(info.extra)
    with source.open("r+b") as stream:
        stream.seek(offset + 100)
        original = stream.read(1)
        stream.seek(offset + 100)
        stream.write(bytes([original[0] ^ 1]))
    os.utime(source, ns=(before.st_atime_ns, before.st_mtime_ns))
    prepared = archive.cache.prepare(work_id)
    assert wait_for_cache(archive.cache, prepared)["status"] == "failed"
    assert not list(settings.archive_cache_dir.glob("*.cbz"))
    archive.cache.close()
