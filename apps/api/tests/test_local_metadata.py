from pathlib import Path

from fastapi.testclient import TestClient

from app import main
from app.services.archive_service import ArchiveService
from app.services.file_service import FileMaintenanceService
from app.services.local_metadata_service import LocalMetadataService
from test_library_index import create_archive, setup_index
from test_archive_cache import cached_library, wait_for_cache


def manager(tmp_path):
    settings, db, libraries, index, root, library = setup_index(tmp_path)
    create_archive(root / "book.cbz")
    index.scan(library["id"])
    work_id = db.fetchone("SELECT id FROM works")["id"]
    files = FileMaintenanceService(db, settings, ArchiveService(db, settings).cache)
    return settings, db, libraries, index, root, library, work_id, files, LocalMetadataService(files, libraries)


def test_metadata_lists_unlinked_retained_data_separately_from_logs(tmp_path):
    settings, db, libraries, index, root, library, work_id, files, metadata = manager(tmp_path)
    (root / "book.cbz").unlink()
    index.scan(library["id"])
    item = db.fetchone("SELECT id FROM library_items")
    db.execute("DELETE FROM works WHERE id=?", (work_id,))
    before_logs = db.fetchall("SELECT * FROM library_scan_runs")
    result = metadata.inventory(status="missing")
    assert result["summary"]["unlinked"] == result["total"] == 1
    entry = result["result"][0]
    assert entry["kind"] == "item" and entry["title"] == "Book"
    detail = metadata.detail("item", item["id"])
    assert detail["archive_metadata"]["comicinfo"]["Writer"] == "Writer"
    assert detail["record"]["manifest_bytes"] > 0
    preview = metadata.preview_delete("item", item["id"])
    assert preview["allowed"] and preview["counts"]["library_items"] == 1
    assert preview["files"] == [] and not preview["scan_logs_deleted"]
    metadata.delete("item", item["id"])
    assert not db.fetchall("SELECT id FROM library_items")
    assert db.fetchall("SELECT * FROM library_scan_runs") == before_logs
    assert not db.fetchall("PRAGMA foreign_key_check")


def test_missing_work_cleanup_previews_and_removes_all_local_data_not_sources(tmp_path):
    settings, db, libraries, index, root, library, work_id, files, metadata = manager(tmp_path)
    db.execute("UPDATE work_metadata SET value='Saved title' WHERE work_id=? AND field='title'", (work_id,))
    db.execute("INSERT INTO reader_progress(work_id,page_index,page_count,progress_percent) VALUES (?,1,2,50)", (work_id,))
    thumb = settings.thumbs_dir / f"{work_id}-cover-384.jpg"
    thumb.write_bytes(b"cached")
    (root / "book.cbz").unlink()
    index.scan(library["id"])
    logs = db.fetchall("SELECT * FROM library_scan_runs")
    preview = metadata.preview_delete("work", work_id)
    assert preview["allowed"] and preview["counts"]["work_metadata"] >= 1
    assert preview["progress"]["progress_percent"] == 50
    assert str(thumb) in preview["files"] and not preview["source_files_deleted"]
    assert db.fetchone("SELECT id FROM works WHERE id=?", (work_id,)) and thumb.exists()
    detail = metadata.detail("work", work_id)
    assert next(field for field in detail["fields"] if field["field"] == "title")["value"] == "Saved title"
    assert detail["counts"]["manifest_pages"] == 2
    result = metadata.delete("work", work_id)
    assert result["deleted_files"] == 2 and not thumb.exists()
    assert not db.fetchone("SELECT id FROM works WHERE id=?", (work_id,))
    assert not db.fetchall("SELECT id FROM library_items")
    assert db.fetchall("SELECT * FROM library_scan_runs") == logs
    assert not db.fetchall("PRAGMA foreign_key_check")


def test_detached_metadata_cleanup_keeps_real_readonly_source(tmp_path):
    settings, db, libraries, index, root, library, work_id, files, metadata = manager(tmp_path)
    original = (root / "book.cbz").read_bytes()
    libraries.remove(library["id"])
    assert metadata.inventory(status="detached")["total"] == 1
    assert metadata.preview_delete("work", work_id)["allowed"]
    metadata.delete("work", work_id)
    assert (root / "book.cbz").read_bytes() == original
    assert not db.fetchall("PRAGMA foreign_key_check")


def test_offline_mount_is_not_garbage_and_reads_do_not_probe_it(tmp_path, monkeypatch):
    settings, db, libraries, index, root, library, work_id, files, metadata = manager(tmp_path)
    libraries.update(library["id"], {"kind": "mounted"})
    db.execute("UPDATE media_libraries SET health='offline' WHERE id=?", (library["id"],))
    original_stat = Path.stat

    def no_mount_stat(path, *args, **kwargs):
        if path == root or root in path.parents:
            raise AssertionError("metadata page must not probe mounts")
        return original_stat(path, *args, **kwargs)

    monkeypatch.setattr(Path, "stat", no_mount_stat)
    assert metadata.inventory(status="offline")["total"] == 1
    assert metadata.detail("work", work_id)["sources"][0]["status"] == "offline"
    assert not metadata.preview_delete("work", work_id)["allowed"]
    item_id = db.fetchone("SELECT id FROM library_items")["id"]
    assert not metadata.preview_delete("item", item_id)["allowed"]


def test_cleanup_rechecks_restored_source_and_active_reader_after_preview(tmp_path):
    settings, db, libraries, index, root, library, work_id, files, metadata = manager(tmp_path)
    body = (root / "book.cbz").read_bytes()
    (root / "book.cbz").unlink()
    index.scan(library["id"])
    assert metadata.preview_delete("work", work_id)["allowed"]
    (root / "book.cbz").write_bytes(body)
    assert not metadata.preview_delete("work", work_id)["allowed"]
    (root / "book.cbz").unlink()
    db.execute("INSERT INTO reading_sessions(client_key,work_id) VALUES ('active-reader',?)", (work_id,))
    assert not metadata.preview_delete("work", work_id)["allowed"]
    assert db.fetchone("SELECT id FROM works WHERE id=?", (work_id,))


def test_shared_work_preserved_while_only_stale_file_association_is_removed(tmp_path):
    settings, db, libraries, index, root, library, work_id, files, metadata = manager(tmp_path)
    cursor = db.execute("INSERT INTO work_files(work_id,kind,path) VALUES (?,'source_cbz',?)", (work_id, str(settings.library_dir / "old.cbz")))
    assert metadata.inventory(status="partial_missing")["total"] == 1
    assert not metadata.preview_delete("work", work_id)["allowed"]
    assert metadata.preview_delete("source", cursor.lastrowid)["allowed"]
    metadata.delete("source", cursor.lastrowid)
    assert db.fetchone("SELECT id FROM works WHERE id=?", (work_id,))
    assert metadata.inventory(status="partial_missing")["total"] == 0
    assert (root / "book.cbz").is_file()


def test_derived_inventory_cleanup_keeps_work_metadata_progress_and_current_cover(tmp_path):
    settings, db, libraries, index, root, library, work_id, files, metadata = manager(tmp_path)
    thumb = settings.thumbs_dir / f"{work_id}-cover-384.jpg"
    thumb.write_bytes(b"cached")
    orphan = settings.thumbs_dir / "999999-cover-384.jpg"
    orphan.write_bytes(b"old cached")
    covers = files.derived_inventory(category="cover")
    assert covers["total"] == 1 and covers["result"][0]["work_id"] == work_id
    assert files.derived_inventory(status="orphan")["result"][0]["path"] == str(orphan)
    assert files.preview_delete([{"kind": "derived", "path": covers["result"][0]["path"]}])["files_to_delete"] == 0
    preview = files.preview_delete([{"kind": "derived", "path": str(thumb)}])
    assert preview["files_to_delete"] == 1 and thumb.exists()
    db.execute("INSERT INTO reading_sessions(client_key,work_id) VALUES ('active-reader',?)", (work_id,))
    assert files.derived_inventory(status="active")["total"] == 2
    assert files.delete([{"kind": "derived", "path": str(thumb)}])["deleted_files"] == 0
    db.execute("UPDATE reading_sessions SET ended_at=CURRENT_TIMESTAMP")
    assert files.delete([{"kind": "derived", "path": str(thumb)}])["deleted_files"] == 1
    assert db.fetchone("SELECT id FROM works WHERE id=?", (work_id,)) and (root / "book.cbz").exists()
    assert Path(covers["result"][0]["path"]).exists()


def test_metadata_http_routes_real_data_and_conflict(tmp_path, monkeypatch):
    settings, db, libraries, index, root, library, work_id, files, metadata = manager(tmp_path)
    monkeypatch.setattr(main.services, "local_metadata", metadata)
    monkeypatch.setattr(main.services, "files", files)
    client = TestClient(main.create_app(enforce_auth=False))
    assert client.get("/api/files/metadata").json()["summary"]["works"] == 1
    assert client.get(f"/api/files/metadata/work/{work_id}").json()["record"]["title"] == "Book"
    assert client.get("/api/files/metadata/item/99999").status_code == 404
    target = {"kind": "work", "id": work_id}
    assert not client.post("/api/files/metadata/preview-delete", json=target).json()["allowed"]
    assert client.post("/api/files/metadata/delete", json=target).status_code == 409
    assert client.post("/api/files/metadata/delete", json={"kind": "unknown", "id": -1}).status_code == 422
    assert client.get("/api/files/derived?category=cover").json()["total"] == 1


def test_derived_cache_preview_covers_archive_and_thumbnails_and_rechecks_lease(tmp_path):
    settings, db, libraries, _, root, library, archive, work_id = cached_library(tmp_path)
    prepared = archive.cache.prepare(work_id)
    assert wait_for_cache(archive.cache, prepared)["status"] == "completed"
    opened = archive.cache.prepare(work_id)
    archive.read_page_thumbnail(work_id, 1, 240, opened["lease"])
    files = FileMaintenanceService(db, settings, archive.cache)
    path = archive.cache._path(opened["cache_id"])
    target = [{"kind": "derived", "path": str(path)}]
    try:
        assert files.preview_delete(target)["files_to_delete"] == 0
        archive.cache.release(work_id, opened["lease"])
        preview = files.preview_delete(target)
        assert preview["files_to_delete"] == 2 and len(preview["items"][0]["files"]) == 2
        targets = target + [{"kind": "derived", "path": file} for file in preview["items"][0]["files"]]
        batch = files.preview_delete(targets)
        assert batch["files_to_delete"] == 2 and batch["reclaim_bytes"] == preview["reclaim_bytes"]
        result = files.delete(targets)
        assert result["deleted_files"] == 2 and not path.exists()
        assert db.fetchone("SELECT id FROM works WHERE id=?", (work_id,))
        assert (root / "one.cbz").is_file() and archive.cache.summary()["ready_count"] == 0
        assert not db.fetchall("PRAGMA foreign_key_check")
    finally:
        archive.cache.close()


def test_derived_cleanup_rejects_symlink_and_metadata_handles_broken_page_directory(tmp_path):
    settings, db, libraries, index, root, library, work_id, files, metadata = manager(tmp_path)
    target = settings.thumbs_dir / f"{work_id}-cover-384.jpg"
    target.symlink_to(root / "book.cbz")
    assert files.preview_delete([{"kind": "derived", "path": str(target)}])["files_to_delete"] == 0
    assert files.delete([{"kind": "derived", "path": str(target)}])["deleted_files"] == 0
    assert (root / "book.cbz").exists()
    db.execute("UPDATE library_items SET manifest=?", (b"broken",))
    detail = metadata.detail("work", work_id)
    assert detail["manifest_errors"] and detail["counts"]["manifest_pages"] == 0
