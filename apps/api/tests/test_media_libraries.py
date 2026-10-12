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


def test_mounted_library_can_be_writable_and_removal_preserves_sources(tmp_path):
    settings, db, libraries = setup_libraries(tmp_path)
    root = tmp_path / "remote"
    root.mkdir()
    source = root / "book.cbz"
    source.write_bytes(b"unchanged source")
    library = libraries.create({"name": "网盘", "root_path": str(root), "kind": "mounted", "read_only": False})
    assert not library["read_only"]
    item = db.execute("INSERT INTO library_items(library_id, relative_path) VALUES (?, ?)", (library["id"], "book.cbz")).lastrowid
    assert libraries.download_write_root(library["id"])[1] == root
    with pytest.raises(PermissionError):
        libraries.resolve_item(item, for_write=True)
    result = libraries.remove(library["id"])
    assert result["metadata_preserved"] and not result["source_files_deleted"]
    assert source.read_bytes() == b"unchanged source"
    with pytest.raises(FileNotFoundError):
        libraries.resolve_item(item)


def test_missing_record_can_be_inspected_and_forgotten_without_deleting_source_or_work(tmp_path):
    _, db, libraries = setup_libraries(tmp_path)
    root = tmp_path / "media"
    root.mkdir()
    source = root / "book.cbz"
    source.write_bytes(b"still here")
    library = libraries.create({"name": "目录", "root_path": str(root)})
    work_id = db.execute("INSERT INTO works(title, source) VALUES ('Saved work', 'local')").lastrowid
    db.execute("INSERT INTO reader_progress(work_id, page_index, page_count, progress_percent) VALUES (?, 1, 2, 50)", (work_id,))
    item_id = db.execute(
        """INSERT INTO library_items(library_id, relative_path, work_id, status, size_bytes, metadata_json)
        VALUES (?, 'book.cbz', ?, 'missing', 10, '{\"Title\": \"Archived title\", \"Writer\": \"Author\"}')""",
        (library["id"], work_id),
    ).lastrowid
    db.execute("INSERT INTO work_files(work_id, kind, path, library_item_id) VALUES (?, 'source_cbz', ?, ?)",
               (work_id, str(source), item_id))
    db.execute("INSERT INTO library_changes(library_id, relative_path, due_at) VALUES (?, 'book.cbz', 1)", (library["id"],))

    listed = libraries.items(library["id"], "missing")["result"]
    assert listed[0]["title"] == "Saved work"
    assert listed[0]["metadata"] == {"Title": "Archived title", "Writer": "Author"}
    result = libraries.forget_missing_item(library["id"], item_id)

    assert result["work_metadata_preserved"] is True
    assert source.read_bytes() == b"still here"
    assert db.fetchone("SELECT id FROM works WHERE id = ?", (work_id,))
    assert db.fetchone("SELECT work_id FROM reader_progress WHERE work_id = ?", (work_id,))
    assert not db.fetchone("SELECT id FROM work_files WHERE library_item_id = ?", (item_id,))
    assert not db.fetchone("SELECT id FROM library_items WHERE id = ?", (item_id,))
    assert not db.fetchone("SELECT 1 FROM library_changes WHERE library_id = ?", (library["id"],))


def test_ready_record_cannot_be_forgotten(tmp_path):
    _, db, libraries = setup_libraries(tmp_path)
    root = tmp_path / "media"
    root.mkdir()
    library = libraries.create({"name": "目录", "root_path": str(root)})
    item_id = db.execute(
        "INSERT INTO library_items(library_id, relative_path, status) VALUES (?, 'book.cbz', 'ready')",
        (library["id"],),
    ).lastrowid

    with pytest.raises(ValueError, match="只能移除"):
        libraries.forget_missing_item(library["id"], item_id)
    assert db.fetchone("SELECT id FROM library_items WHERE id = ?", (item_id,))


def test_forgetting_unlinked_missing_record_removes_its_metadata(tmp_path):
    _, db, libraries = setup_libraries(tmp_path)
    library = libraries.list()["result"][0]
    item_id = db.execute(
        """INSERT INTO library_items(library_id, relative_path, status, metadata_json, archive_info_json)
        VALUES (?, 'deleted.cbz', 'missing', '[]', '{"json": {"title": "Archived title"}}')""",
        (library["id"],),
    ).lastrowid
    item = libraries.items(library["id"], "missing")["result"][0]
    assert item["title"] == "deleted.cbz"
    assert item["metadata"] == {"JSON": {"title": "Archived title"}}
    assert not libraries.forget_missing_item(library["id"], item_id)["work_metadata_preserved"]
    assert libraries.items(library["id"], "missing")["total"] == 0


def test_removed_library_records_are_visible_and_cleanup_keeps_source_files(tmp_path):
    _, db, libraries = setup_libraries(tmp_path)
    root = tmp_path / "media"
    root.mkdir()
    source = root / "book.cbz"
    source.write_bytes(b"unchanged source")
    library = libraries.create({"name": "旧库", "root_path": str(root)})
    item_id = db.execute("INSERT INTO library_items(library_id,relative_path,metadata_json) VALUES (?, 'book.cbz', '{\"Title\":\"Archived\"}')", (library["id"],)).lastrowid
    libraries.remove(library["id"])
    assert library["id"] not in {row["id"] for row in libraries.list()["result"]}
    assert library["id"] in {row["id"] for row in libraries.list(include_removed=True)["result"]}
    item = libraries.items(library["id"])["result"][0]
    assert item["status"] == "detached" and item["metadata"]["Title"] == "Archived"
    libraries.forget_missing_item(library["id"], item_id)
    assert libraries.items(library["id"])["total"] == 0
    assert source.read_bytes() == b"unchanged source"


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
