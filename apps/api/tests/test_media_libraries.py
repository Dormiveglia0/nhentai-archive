from pathlib import Path

import pytest

from app.config import Settings
from app.database import Database
from app.services.media_library_service import MediaLibraryService


def setup_libraries(tmp_path):
    settings = Settings(data_dir=tmp_path / "data")
    settings.ensure_directories()
    db = Database(settings.database_path)
    db.init_schema()
    return settings, db, MediaLibraryService(settings, db)


def test_libraries_reject_overlaps_and_unsafe_paths(tmp_path):
    settings, db, libraries = setup_libraries(tmp_path)
    root = tmp_path / "media"
    libraries.create({"name": "目录", "root_path": str(root)})
    for path in (root, root / "nested", tmp_path, Path("../outside"), Path("/proc")):
        with pytest.raises(ValueError):
            libraries.create({"name": "重叠", "root_path": str(path)})
    with pytest.raises(ValueError):
        libraries.create({"name": "配置", "root_path": str(tmp_path / "other"), "config": {"language_mode": []}})
    assert len(libraries.list()["result"]) == 2


def test_mounted_library_is_read_only_and_removal_preserves_sources(tmp_path):
    settings, db, libraries = setup_libraries(tmp_path)
    root = tmp_path / "remote"
    root.mkdir()
    source = root / "book.cbz"
    source.write_bytes(b"unchanged source")
    library = libraries.create({"name": "网盘", "root_path": str(root), "kind": "mounted", "read_only": False})
    assert library["read_only"]
    item = db.execute("INSERT INTO library_items(library_id, relative_path) VALUES (?, ?)", (library["id"], "book.cbz")).lastrowid
    with pytest.raises(PermissionError):
        libraries.resolve_item(item, for_write=True)
    result = libraries.remove(library["id"])
    assert result["metadata_preserved"] and not result["source_files_deleted"]
    assert source.read_bytes() == b"unchanged source"
    with pytest.raises(FileNotFoundError):
        libraries.resolve_item(item)


def test_source_symlinks_cannot_escape_library(tmp_path):
    _, _, libraries = setup_libraries(tmp_path)
    root = tmp_path / "media"
    root.mkdir()
    outside = tmp_path / "outside.cbz"
    outside.write_bytes(b"outside")
    (root / "escape.cbz").symlink_to(outside)
    for follow in (False, True):
        with pytest.raises(ValueError):
            libraries.source_path(root, "escape.cbz", follow)
    for relative in ("../outside.cbz", "/outside.cbz", "a\\outside.cbz"):
        with pytest.raises(ValueError):
            libraries.source_path(root, relative)


def test_library_root_change_rebases_locations_without_moving_files(tmp_path):
    _, db, libraries = setup_libraries(tmp_path)
    root = tmp_path / "first"
    root.mkdir()
    source = root / "original.cbz"
    source.write_bytes(b"source")
    library = libraries.create({"name": "目录", "root_path": str(root)})
    work = db.execute("INSERT INTO works(title, source) VALUES ('original', 'local')").lastrowid
    item = db.execute("INSERT INTO library_items(library_id, relative_path, work_id) VALUES (?, ?, ?)", (library["id"], "original.cbz", work)).lastrowid
    db.execute("INSERT INTO work_files(work_id, kind, path, library_item_id) VALUES (?, 'source_cbz', ?, ?)", (work, str(source), item))
    changed = libraries.update(library["id"], {"root_path": str(tmp_path / "second")})
    assert changed["root_path"] == str(tmp_path / "second")
    assert db.fetchone("SELECT path FROM work_files WHERE work_id = ?", (work,))["path"] == str(tmp_path / "second" / "original.cbz")
    assert source.read_bytes() == b"source"
