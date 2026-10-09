import shutil

import pytest

from app.services.archive_service import ArchiveService
from app.services.directory_browser import browse_directories
from app.services.file_service import FileMaintenanceService
from test_library_index import create_archive, setup_index
from test_archive_cache import cached_library, wait_for_cache


def test_removed_readonly_library_allows_record_cleanup_without_touching_source(tmp_path):
    settings, db, libraries, index, root, library = setup_index(tmp_path)
    source = root / "one.cbz"
    create_archive(source)
    body = source.read_bytes()
    index.scan(library["id"])
    work_id = db.fetchone("SELECT id FROM works")["id"]
    archive = ArchiveService(db, settings)
    files = FileMaintenanceService(db, settings, archive.cache)
    libraries.remove(library["id"])
    target = [{"kind": "work", "work_id": work_id}]
    assert files.preview_delete(target)["works_to_remove"] == 1
    assert files.delete(target)["removed_works"] == 1
    assert source.read_bytes() == body
    assert not db.fetchone("SELECT id FROM works WHERE id=?", (work_id,))
    assert not db.fetchall("PRAGMA foreign_key_check")


def test_library_purge_cleans_exclusive_records_and_preserves_shared_sources(tmp_path):
    settings, db, libraries, index, root, library = setup_index(tmp_path)
    create_archive(root / "shared.cbz", title="Shared")
    create_archive(root / "exclusive.cbz", title="Exclusive")
    index.scan(library["id"])
    other = tmp_path / "other"
    other.mkdir()
    shutil.copyfile(root / "shared.cbz", other / "shared.cbz")
    second = libraries.create({"name": "Other", "root_path": str(other), "config": {"stable_seconds": 0}})
    index.scan(second["id"])
    files = FileMaintenanceService(db, settings, ArchiveService(db, settings).cache)
    preview = files.library_removal_preview(library["id"])
    assert preview["exclusive_works"] == 1 and preview["shared_works"] == 1
    result = files.remove_library(library["id"], purge=True)
    assert result["removed_works"] == 1
    assert db.fetchone("SELECT COUNT(*) AS n FROM works")["n"] == 1
    assert (root / "shared.cbz").is_file() and (root / "exclusive.cbz").is_file() and (other / "shared.cbz").is_file()
    assert files.library_removal_preview(second["id"])["exclusive_works"] == 1
    assert files.remove_library(second["id"], purge=True)["removed_works"] == 1
    assert db.fetchone("SELECT COUNT(*) AS n FROM works")["n"] == 0
    assert (root / "shared.cbz").is_file() and (other / "shared.cbz").is_file()
    assert not db.fetchall("PRAGMA foreign_key_check")


def test_library_purge_refuses_active_reader_before_any_changes(tmp_path):
    settings, db, libraries, index, root, library, archive, work_id = cached_library(tmp_path)
    prepared = archive.cache.prepare(work_id)
    wait_for_cache(archive.cache, prepared)
    opened = archive.cache.prepare(work_id)
    files = FileMaintenanceService(db, settings, archive.cache)
    try:
        assert not files.library_removal_preview(library["id"])["purge_allowed"]
        with pytest.raises((OSError, ValueError), match="阅读"):
            files.remove_library(library["id"], purge=True)
        assert libraries.get(library["id"])["enabled"]
        assert (root / "one.cbz").is_file() and db.fetchone("SELECT id FROM works WHERE id=?", (work_id,))
    finally:
        archive.cache.release(work_id, opened["lease"])
        archive.cache.close()


def test_directory_browser_lists_directories_only_and_rejects_system_paths(tmp_path):
    (tmp_path / "comics").mkdir()
    (tmp_path / ".hidden").mkdir()
    (tmp_path / "file.txt").write_text("unit")
    result = browse_directories(str(tmp_path))
    assert result["result"] == [{"name": "comics", "path": str(tmp_path / "comics")}]
    for path in ("relative", "/proc", "/sys", "/dev"):
        with pytest.raises(ValueError):
            browse_directories(path)
