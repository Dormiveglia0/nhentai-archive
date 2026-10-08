import io
import os
import shutil
import time
import zipfile
from pathlib import Path

from PIL import Image
import pytest

from app.config import Settings
from app.database import Database
from app.services.archive_manifest import MountedArchiveProbe, MountUnavailable, inspect_archive, inspect_mounted_archive, unpack_manifest
from app.services.archive_service import ArchiveService
from app.services.job_service import JobCancelled
from app.services.library_index_service import LibraryIndexService
from app.services.media_library_service import MediaLibraryService
from app.services.reader_service import ReaderService


def create_archive(path: Path, title="Book", tags=""):
    body = io.BytesIO()
    Image.new("RGB", (1200, 1600), "gray").save(body, format="JPEG")
    path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("nested/001.jpg", body.getvalue())
        archive.writestr("nested/Cover.jpg", body.getvalue())
        archive.writestr("ComicInfo.xml", f"<ComicInfo><Title>{title}</Title><Writer>Writer</Writer><Publisher>Circle</Publisher><LanguageISO>zh</LanguageISO><Tags>{tags}</Tags></ComicInfo>")


def setup_index(tmp_path, **config):
    settings = Settings(data_dir=tmp_path / "data")
    settings.ensure_directories()
    db = Database(settings.database_path)
    db.init_schema()
    libraries = MediaLibraryService(settings, db)
    root = tmp_path / "media"
    root.mkdir()
    library = libraries.create({"name": "目录", "root_path": str(root), "config": {"stable_seconds": 0, **config}})
    return settings, db, libraries, LibraryIndexService(settings, db, libraries), root, library


def test_recursive_index_keeps_sources_and_compresses_manifest(tmp_path):
    settings, db, libraries, index, root, library = setup_index(tmp_path)
    path = root / "作者" / "卷一.CBZ"
    create_archive(path, tags="one,two")
    original = path.read_bytes()
    (root / "unrelated.txt").write_text("ignored")
    first = index.scan(library["id"])
    assert first["counts"]["indexed"] == 1 and first["counts"]["ignored"] == 1
    item = db.fetchone("SELECT * FROM library_items WHERE library_id = ?", (library["id"],))
    work = db.fetchone("SELECT * FROM works WHERE id = ?", (item["work_id"],))
    assert work["page_count"] == 2 and work["title"] == "Book"
    assert len(unpack_manifest(item["manifest"])) == 2
    tags = db.fetchall("SELECT tag_type, remote_name FROM work_tags WHERE work_id = ?", (item["work_id"],))
    assert {row["tag_type"] for row in tags} == {"artist", "group", "tag"}
    reader = ArchiveService(db, settings)
    assert len(reader.list_pages(item["work_id"])) == 2
    assert reader.read_page(item["work_id"], 1)[1] == "image/jpeg"
    assert reader.read_cover_thumbnail(item["work_id"], 512)[0] == Path(work["cover_path"]).read_bytes()
    assert not list(settings.thumbs_dir.glob("*"))
    assert db.fetchone("SELECT COUNT(*) AS n FROM work_pages")["n"] == 0
    with Image.open(work["cover_path"]) as cover:
        assert cover.width <= 512 and cover.height <= 768
    assert path.read_bytes() == original and not list(settings.library_dir.glob("*.cbz"))
    second = index.scan(library["id"])
    assert second["counts"]["unchanged"] == 1 and second["counts"]["indexed"] == 0
    assert db.fetchone("SELECT COUNT(*) AS n FROM works")["n"] == 1


def test_invalid_archive_does_not_interrupt_valid_files_and_can_recover(tmp_path):
    _, db, _, index, root, library = setup_index(tmp_path)
    broken = root / "broken.cbz"
    broken.write_bytes(b"partial")
    create_archive(root / "valid.cbz")
    (root / "unsupported.cbr").write_bytes(b"unknown format")
    first = index.scan(library["id"])
    assert first["counts"]["indexed"] == 1 and first["counts"]["errors"] == 1 and first["counts"]["unsupported"] == 1
    assert db.fetchone("SELECT COUNT(*) AS n FROM works")["n"] == 1
    create_archive(broken, title="Recovered")
    second = index.scan(library["id"])
    assert second["counts"]["indexed"] == 1 and second["counts"]["errors"] == 0
    assert db.fetchone("SELECT COUNT(*) AS n FROM works")["n"] == 2


def test_stability_wait_and_changes_do_not_create_duplicate_work(tmp_path, monkeypatch):
    _, db, _, index, root, library = setup_index(tmp_path, stable_seconds=5)
    create_archive(root / "book.cbz")
    clock = [time.time()]
    monkeypatch.setattr(time, "time", lambda: clock[0])
    assert index.scan(library["id"])["counts"]["pending"] == 1
    clock[0] += 6
    assert index.scan(library["id"])["counts"]["indexed"] == 1
    work_id = db.fetchone("SELECT id FROM works")["id"]
    db.execute("UPDATE works SET favorite = 1 WHERE id = ?", (work_id,))
    create_archive(root / "book.cbz", title="Changed")
    assert index.scan(library["id"])["counts"]["pending"] == 1
    clock[0] += 6
    assert index.scan(library["id"])["counts"]["indexed"] == 1
    assert db.fetchone("SELECT COUNT(*) AS n FROM works")["n"] == 1
    assert db.fetchone("SELECT favorite FROM works WHERE id = ?", (work_id,))["favorite"] == 1


def test_empty_or_unavailable_mount_preserves_metadata(tmp_path):
    _, db, libraries, index, root, library = setup_index(tmp_path)
    libraries.update(library["id"], {"kind": "mounted"})
    source = root / "book.cbz"
    create_archive(source)
    index.scan(library["id"])
    source.unlink()
    result = index.scan(library["id"])
    assert result["status"] == "partial" and result["counts"]["missing"] == 0
    assert libraries.get(library["id"])["health"] == "offline"
    assert db.fetchone("SELECT status FROM library_items WHERE library_id = ?", (library["id"],))["status"] == "ready"
    assert db.fetchone("SELECT COUNT(*) AS n FROM works")["n"] == 1
    root.rmdir()
    try:
        index.scan(library["id"])
    except FileNotFoundError:
        pass
    assert db.fetchone("SELECT COUNT(*) AS n FROM works")["n"] == 1


def test_replaced_root_does_not_mark_old_books_missing_on_first_observation(tmp_path):
    _, db, _, index, root, library = setup_index(tmp_path)
    create_archive(root / "old.cbz")
    index.scan(library["id"])
    root.rename(tmp_path / "previous-root")
    root.mkdir()
    create_archive(root / "new.cbz", title="New book")
    assert index.scan(library["id"])["counts"]["missing"] == 0
    assert index.scan(library["id"])["counts"]["missing"] == 1
    assert db.fetchone("SELECT COUNT(*) AS n FROM works")["n"] == 2


def test_cancelled_scan_never_marks_existing_items_missing(tmp_path):
    _, db, _, index, root, library = setup_index(tmp_path)
    create_archive(root / "book.cbz")
    index.scan(library["id"])
    (root / "book.cbz").unlink()
    def cancel():
        raise JobCancelled()
    try:
        index.scan(library["id"], checkpoint=cancel)
    except JobCancelled:
        pass
    assert db.fetchone("SELECT status FROM library_scan_runs ORDER BY id DESC LIMIT 1")["status"] == "cancelled"
    assert db.fetchone("SELECT status FROM library_items WHERE library_id = ?", (library["id"],))["status"] == "ready"


def test_manual_metadata_survives_changed_archive(tmp_path):
    _, db, _, index, root, library = setup_index(tmp_path)
    source = root / "book.cbz"
    create_archive(source)
    index.scan(library["id"])
    work_id = db.fetchone("SELECT id FROM works")["id"]
    db.execute("UPDATE work_metadata SET value = 'Edited', source = 'manual' WHERE work_id = ? AND field = 'title'", (work_id,))
    db.execute("UPDATE works SET title = 'Edited' WHERE id = ?", (work_id,))
    create_archive(source, title="Changed in file")
    index.scan(library["id"])
    title = db.fetchone("SELECT * FROM work_metadata WHERE work_id = ? AND field = 'title'", (work_id,))
    assert title["value"] == "Edited" and title["source_value"] == "Changed in file"
    assert db.fetchone("SELECT title FROM works WHERE id = ?", (work_id,))["title"] == "Edited"


def test_removed_comicinfo_fields_clear_only_automatic_values(tmp_path):
    _, db, _, index, root, library = setup_index(tmp_path)
    source = root / "book.cbz"
    create_archive(source)
    index.scan(library["id"])
    work_id = db.fetchone("SELECT id FROM works")["id"]
    db.execute("UPDATE work_metadata SET value = 'Manual artist', source = 'manual' WHERE work_id = ? AND field = 'artist'", (work_id,))
    with zipfile.ZipFile(source) as content:
        image = content.read("nested/001.jpg")
    with zipfile.ZipFile(source, "w") as content:
        content.writestr("001.jpg", image)
    index.scan(library["id"])
    fields = {row["field"]: row for row in db.fetchall("SELECT * FROM work_metadata WHERE work_id = ?", (work_id,))}
    assert fields["title"]["value"] is None and fields["group"]["value"] is None
    assert fields["artist"]["value"] == "Manual artist" and fields["artist"]["source_value"] is None
    assert db.fetchone("SELECT title FROM works WHERE id = ?", (work_id,))["title"] == "book"


def test_page_count_changes_rebase_progress_without_creating_reading_activity(tmp_path):
    _, db, _, index, root, library = setup_index(tmp_path)
    create_archive(root / "book.cbz")
    index.scan(library["id"])
    work_id = db.fetchone("SELECT id FROM works")["id"]
    reader = ReaderService(db)
    original = reader.update_state(work_id, 2, True)
    db.execute("UPDATE works SET page_count = 3 WHERE id = ?", (work_id,))
    longer = reader.get_state(work_id)
    assert (longer["page_count"], longer["page_index"], longer["progress_percent"], longer["completed"]) == (3, 2, 67, False)
    db.execute("UPDATE works SET page_count = 1 WHERE id = ?", (work_id,))
    shorter = reader.get_state(work_id)
    assert (shorter["page_count"], shorter["page_index"], shorter["progress_percent"], shorter["completed"]) == (1, 1, 100, True)
    assert shorter["last_read_at"] == original["last_read_at"]
    assert db.fetchone("SELECT COUNT(*) AS n FROM reading_history")["n"] == 0


def test_orphaned_index_can_rebuild_metadata_without_changing_archive(tmp_path):
    _, db, _, index, root, library = setup_index(tmp_path)
    source = root / "book.cbz"
    create_archive(source)
    original = source.read_bytes()
    index.scan(library["id"])
    db.execute("DELETE FROM works")
    assert index.scan(library["id"])["counts"]["indexed"] == 1
    assert db.fetchone("SELECT COUNT(*) AS n FROM works")["n"] == 1
    assert source.read_bytes() == original


def test_changed_during_probe_is_pending_and_local_missing_keeps_work(tmp_path, monkeypatch):
    _, db, _, index, root, library = setup_index(tmp_path)
    source = root / "book.cbz"
    create_archive(source)
    def change(path):
        data = inspect_archive(path)
        create_archive(path, title="Changed while reading")
        return data
    with monkeypatch.context() as patch:
        patch.setattr("app.services.library_index_service.inspect_archive", change)
        assert index.scan(library["id"])["counts"]["pending"] == 1
        assert db.fetchone("SELECT COUNT(*) AS n FROM works")["n"] == 0
    index.scan(library["id"])
    source.unlink()
    assert index.scan(library["id"])["counts"]["missing"] == 1
    assert db.fetchone("SELECT COUNT(*) AS n FROM works")["n"] == 1


def test_malformed_metadata_and_bad_first_page_use_readable_cover(tmp_path):
    _, db, _, index, root, library = setup_index(tmp_path)
    source = root / "book.cbz"
    create_archive(source)
    with zipfile.ZipFile(source) as original:
        image = original.read("nested/001.jpg")
    with zipfile.ZipFile(source, "w") as archive:
        archive.writestr("001.jpg", b"broken image")
        archive.writestr("002.jpg", image)
        archive.writestr("ComicInfo.xml", "<ComicInfo><Title>incomplete")
    assert index.scan(library["id"])["counts"]["indexed"] == 1
    item = db.fetchone("SELECT * FROM library_items WHERE library_id = ?", (library["id"],))
    assert item["status"] == "ready" and "ComicInfo" in item["last_error"]
    assert unpack_manifest(item["manifest"])[1]["width"] == 1200


@pytest.mark.skipif(not hasattr(os, "mkfifo"), reason="requires a POSIX pipe")
def test_non_regular_source_is_rejected_without_blocking_and_can_cancel(tmp_path):
    os.mkfifo(tmp_path / "blocked.cbz")
    started = time.monotonic()
    with pytest.raises(OSError, match="普通文件"):
        inspect_mounted_archive(tmp_path, "blocked.cbz", False, 0.4, lambda: None)
    assert time.monotonic() - started < 3
    def cancel():
        raise JobCancelled()
    with pytest.raises(JobCancelled):
        inspect_mounted_archive(tmp_path, "blocked.cbz", False, 30, cancel)


def test_mounted_probe_reuses_worker_and_recovers_after_bad_file(tmp_path):
    create_archive(tmp_path / "one.cbz")
    create_archive(tmp_path / "two.cbz")
    (tmp_path / "bad.cbz").write_bytes(b"broken")
    probe = MountedArchiveProbe(tmp_path, False, 5)
    try:
        probe.inspect("one.cbz", lambda: None)
        pid = probe.process.pid
        probe.inspect("two.cbz", lambda: None)
        assert probe.process.pid == pid
        with pytest.raises(OSError):
            probe.inspect("bad.cbz", lambda: None)
        assert probe.inspect("one.cbz", lambda: None)["page_count"] == 2
    finally:
        assert probe.close()


def test_local_rename_hardlink_and_copy_keep_single_work(tmp_path):
    _, db, _, index, root, library = setup_index(tmp_path)
    source = root / "book.cbz"
    create_archive(source)
    index.scan(library["id"])
    item = db.fetchone("SELECT * FROM library_items WHERE library_id = ?", (library["id"],))
    moved = root / "renamed.cbz"
    source.rename(moved)
    assert index.scan(library["id"])["counts"]["unchanged"] == 1
    assert db.fetchone("SELECT relative_path FROM library_items WHERE id = ?", (item["id"],))["relative_path"] == "renamed.cbz"
    os.link(moved, root / "hardlink.cbz")
    shutil.copyfile(moved, root / "copy.cbz")
    result = index.scan(library["id"])
    assert result["counts"]["indexed"] == 2 and result["counts"]["missing"] == 0
    assert db.fetchone("SELECT COUNT(*) AS n FROM works")["n"] == 1
    assert db.fetchone("SELECT COUNT(*) AS n FROM library_items")["n"] == 3
    assert len(ArchiveService(db, index.settings).list_pages(item["work_id"])) == 2


def test_conflicting_web_binding_does_not_overwrite_existing_work(tmp_path):
    _, db, _, index, root, library = setup_index(tmp_path)
    create_archive(root / "book.cbz")
    original_id = db.execute("INSERT INTO works(title, source, remote_gallery_id, page_count, language) VALUES ('Original', 'remote', 123, 100, 'chinese')").lastrowid
    with zipfile.ZipFile(root / "book.cbz", "a") as archive:
        archive.writestr("meta/ComicInfo.xml", "<ComicInfo><Title>Other</Title><LanguageISO>zh</LanguageISO><Web>https://nhentai.net/g/123/</Web></ComicInfo>")
    assert index.scan(library["id"])["counts"]["indexed"] == 1
    assert db.fetchone("SELECT title, page_count FROM works WHERE id = ?", (original_id,)) == {"title": "Original", "page_count": 100}
    item = db.fetchone("SELECT * FROM library_items WHERE library_id = ?", (library["id"],))
    assert item["work_id"] != original_id and "未自动合并" in item["last_error"]


def test_reader_rejects_unscanned_source_changes(tmp_path):
    settings, db, _, index, root, library = setup_index(tmp_path)
    create_archive(root / "book.cbz")
    index.scan(library["id"])
    work_id = db.fetchone("SELECT id FROM works")["id"]
    with zipfile.ZipFile(root / "book.cbz", "w") as archive:
        archive.writestr("different.jpg", b"different")
    with pytest.raises(FileNotFoundError, match="重新扫描"):
        ArchiveService(db, settings).read_page(work_id, 1)


def test_stuck_kernel_worker_prevents_unbounded_process_creation(tmp_path):
    from types import SimpleNamespace
    _, db, libraries, index, root, library = setup_index(tmp_path)
    create_archive(root / "book.cbz")
    index.scan(library["id"])
    libraries.update(library["id"], {"kind": "mounted"})
    stuck = SimpleNamespace(is_alive=lambda: True, terminate=lambda: None, kill=lambda: None, join=lambda timeout: None)
    index._walk_process = stuck
    with pytest.raises(MountUnavailable):
        index.scan(library["id"])
    assert index._walk_process is stuck
    assert db.fetchone("SELECT status FROM library_items WHERE library_id = ?", (library["id"],))["status"] == "ready"


@pytest.mark.parametrize("kind", ["local", "mounted"])
def test_root_aliases_cannot_index_another_library_or_application_cache(tmp_path, kind):
    settings, db, libraries, index, root, library = setup_index(tmp_path)
    create_archive(root / "book.cbz")
    index.scan(library["id"])
    for name, target in (("existing", root), ("cache", settings.archive_cache_dir)):
        alias = tmp_path / name
        alias.symlink_to(target, target_is_directory=True)
        registered = libraries.create({"name": name, "root_path": str(alias), "kind": kind})
        with pytest.raises((ValueError, OSError), match="重叠"):
            index.scan(registered["id"])
        assert db.fetchone("SELECT COUNT(*) AS n FROM library_items WHERE library_id = ?", (registered["id"],))["n"] == 0
    assert db.fetchone("SELECT COUNT(*) AS n FROM works")["n"] == 1
    assert (root / "book.cbz").exists()


def test_root_replaced_with_cache_alias_cannot_be_read_or_cached(tmp_path):
    from test_archive_cache import cached_library, wait_for_cache
    settings, db, libraries, index, root, library, archive, work_id = cached_library(tmp_path)
    item_id = db.fetchone("SELECT id FROM library_items")["id"]
    original_root = tmp_path / "original-media"
    root.rename(original_root)
    root.symlink_to(settings.archive_cache_dir, target_is_directory=True)
    with pytest.raises(ValueError, match="重叠"):
        libraries.resolve_item(item_id)
    with pytest.raises(ValueError, match="重叠"):
        index.scan(library["id"])
    prepared = archive.cache.prepare(work_id)
    failed = wait_for_cache(archive.cache, prepared)
    assert failed["status"] == "failed" and "重叠" in failed["error"]
    assert not list(settings.archive_cache_dir.glob("*.cbz"))
    assert db.fetchone("SELECT id FROM works WHERE id = ?", (work_id,))
    assert (original_root / "one.cbz").exists()
    archive.cache.close()


def test_recorded_directory_identity_rejects_bind_alias_without_probing_other_mount(tmp_path):
    root = tmp_path / "media"
    root.mkdir()
    info = root.stat()
    boundary = {"path": str(tmp_path / "unavailable-bind-mount"), "device": info.st_dev, "inode": info.st_ino}
    with pytest.raises(ValueError, match="重叠"):
        MediaLibraryService.validate_root(root, [boundary])
    boundary["inode"] += 1
    assert MediaLibraryService.validate_root(root, [boundary]) == root
