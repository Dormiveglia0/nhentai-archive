import hashlib
import json
import shutil
import zipfile
from pathlib import Path

import pytest

from app.services import comicinfo
from app.services.archive_service import ArchiveService
from app.services.export_service import ExportService
from app.services.governance_service import GovernanceService
from test_archive_cache import wait_for_cache
from test_library_index import create_archive, setup_index


def test_indexed_governance_review_and_export_preview_do_not_probe_offline_sources(tmp_path, monkeypatch):
    settings, db, libraries, index, root, library = setup_index(tmp_path)
    source = root / "book.cbz"
    create_archive(source)
    with zipfile.ZipFile(source, "a") as handle:
        handle.writestr("metadata/info.json", json.dumps({"summary": "Imported summary"}))
    index.scan(library["id"])
    libraries.update(library["id"], {"kind": "mounted"})
    work_id = db.fetchone("SELECT id FROM works")["id"]
    governance = GovernanceService(db, settings=settings)
    exports = ExportService(db, settings)
    root.rename(tmp_path / "offline-media")
    original_stat = Path.stat

    def no_source_stat(path, *args, **kwargs):
        if path == root or root in path.parents:
            raise AssertionError("Browsing must not probe the source mount")
        return original_stat(path, *args, **kwargs)

    monkeypatch.setattr(Path, "stat", no_source_stat)
    assert governance.queue()["result"][0]["work"]["id"] == work_id
    assert governance.work_governance(work_id)["files"][0]["exists"]
    assert governance.review(work_id, "approve", "已检查")["review"]["state"] == "approved"
    assert governance.queue()["result"][0]["review"]["state"] == "approved"
    assert exports.queue()["summary"]["ready"] == 1
    preview = exports.preview(work_id)
    assert preview["will_keep"] == ["metadata/info.json"]
    assert preview["comic_info"]["Summary"] == "Imported summary"
    with pytest.raises(ValueError, match="只读"):
        governance.write_back_comicinfo(work_id)


def test_writable_directory_writeback_updates_only_selected_source_and_preserves_cached_pages(tmp_path):
    settings, db, libraries, index, root, library = setup_index(tmp_path, cache_mode="always")
    first = root / "first.cbz"
    create_archive(first)
    with zipfile.ZipFile(first) as handle:
        members = [(info.filename, handle.read(info)) for info in handle.infolist()]
    with zipfile.ZipFile(first, "w") as handle:
        for name, body in sorted(members, key=lambda item: item[0] != "ComicInfo.xml"):
            handle.writestr(name, body)
    shutil.copyfile(first, root / "second.cbz")
    index.scan(library["id"])
    work_id = db.fetchone("SELECT id FROM works")["id"]
    assert db.fetchone("SELECT COUNT(*) AS n FROM works")["n"] == 1
    libraries.update(library["id"], {"read_only": False})
    original_hash = hashlib.sha256(first.read_bytes()).hexdigest()
    db.execute("UPDATE work_files SET sha256 = ? WHERE work_id = ?", (original_hash, work_id))
    archive = ArchiveService(db, settings)
    prepared = archive.cache.prepare(work_id)
    assert wait_for_cache(archive.cache, prepared)["status"] == "completed"
    ready = archive.cache.prepare(work_id)
    original_page = archive.read_page(work_id, 1, ready["lease"])[0]
    original_sources = libraries.files(work_id)
    selected = original_sources[0]
    before_pages = archive.list_pages(work_id)
    db.execute("UPDATE work_metadata SET value = 'Edited title', source = 'manual' WHERE work_id = ? AND field = 'title'", (work_id,))
    governance = GovernanceService(db, settings=settings, cache=archive.cache)
    result = governance.write_back_comicinfo(work_id)
    after_pages = archive.list_pages(work_id)
    assert before_pages[0]["archive_position"] != after_pages[0]["archive_position"]
    assert hashlib.sha256(Path(original_sources[1]["path"]).read_bytes()).hexdigest() == original_hash
    assert db.fetchone("SELECT sha256 FROM work_files WHERE id = ?", (original_sources[1]["id"],))["sha256"] == original_hash
    assert db.fetchone("SELECT sha256 FROM work_files WHERE id = ?", (selected["id"],))["sha256"] == result["new_sha256"] != original_hash
    assert index.scan(library["id"])["counts"]["unchanged"] == 2
    libraries.update(library["id"], {"config": {"cache_mode": "off"}})
    assert archive.read_page(work_id, 1)[0] == original_page
    assert archive.read_page(work_id, 1, ready["lease"])[0] == original_page
    assert governance.work_governance(work_id)["metadata"]["fields"][0]["working_value"] == "Edited title"
    archive.cache.release(work_id, ready["lease"])
    archive.cache.close()


def test_writeback_does_not_replace_source_changed_during_packaging(tmp_path, monkeypatch):
    settings, db, libraries, index, root, library = setup_index(tmp_path)
    source = root / "book.cbz"
    create_archive(source)
    index.scan(library["id"])
    libraries.update(library["id"], {"read_only": False})
    work_id = db.fetchone("SELECT id FROM works")["id"]
    newer = source.read_bytes() + b"external change"
    reseal = comicinfo.reseal_cbz_to

    def change_source(*args, **kwargs):
        reseal(*args, **kwargs)
        source.write_bytes(newer)

    monkeypatch.setattr(comicinfo, "reseal_cbz_to", change_source)
    with pytest.raises(ValueError, match="源文件已变化"):
        GovernanceService(db, settings=settings).write_back_comicinfo(work_id)
    assert source.read_bytes() == newer
    assert not list(root.glob(".writeback-*.tmp"))


def test_mounted_export_uses_existing_cache_without_upstream_reads_and_releases_lease(tmp_path, monkeypatch):
    settings, db, libraries, index, root, library = setup_index(tmp_path)
    create_archive(root / "book.cbz")
    index.scan(library["id"])
    libraries.update(library["id"], {"kind": "mounted"})
    work_id = db.fetchone("SELECT id FROM works")["id"]
    archive = ArchiveService(db, settings)
    prepared = archive.cache.prepare(work_id)
    assert wait_for_cache(archive.cache, prepared)["status"] == "completed"
    exports = ExportService(db, settings, archive.cache)
    original_stat = Path.stat

    def no_source_stat(path, *args, **kwargs):
        if path == root or root in path.parents:
            raise AssertionError("Cached export must not probe the source mount")
        return original_stat(path, *args, **kwargs)

    monkeypatch.setattr(Path, "stat", no_source_stat)
    destination = tmp_path / "download.cbz"
    assert exports.write_cbz(work_id, destination).endswith(".cbz")
    with zipfile.ZipFile(destination) as handle:
        assert "nested/001.jpg" in handle.namelist() and handle.testzip() is None
    assert db.fetchone("SELECT COUNT(*) AS n FROM archive_cache_leases")["n"] == 0
    archive.cache.close()


def test_index_commit_cannot_overwrite_a_newer_writeback_snapshot(tmp_path):
    from app.services.archive_manifest import inspect_archive
    settings, db, libraries, index, root, library = setup_index(tmp_path)
    source = root / "book.cbz"
    create_archive(source)
    index.scan(library["id"])
    libraries.update(library["id"], {"read_only": False})
    work_id = db.fetchone("SELECT id FROM works")["id"]
    db.execute("UPDATE work_metadata SET value = 'Edited', source = 'manual' WHERE work_id = ? AND field = 'title'", (work_id,))
    item_id = db.fetchone("SELECT id FROM library_items")["id"]
    old_info, old_data = source.stat(), inspect_archive(source)
    governance = GovernanceService(db, settings=settings)
    governance.write_back_comicinfo(work_id)
    with pytest.raises(ValueError, match="索引写入前变化"):
        index._persist(library, item_id, source, old_info, old_data, work_id)
    snapshot = json.loads(db.fetchone("SELECT metadata_json FROM library_items")["metadata_json"])
    assert snapshot["Title"] == "Edited"
    with zipfile.ZipFile(source) as handle:
        assert "<Title>Edited</Title>" in handle.read("ComicInfo.xml").decode()
