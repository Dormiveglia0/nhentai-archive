import asyncio
import io
import zipfile

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.container import services
from app.services.upload_service import UploadService
from app.services.library_index_service import LibraryIndexService
from app.services.file_service import FileMaintenanceService
from app.services.library_migration_service import LibraryMigrationService
from test_governance_writeback import _setup, _make_cbz


def upload(service, data, filename="book.zip", library_id=None):
    async def chunks():
        for offset in range(0, len(data), 50):
            yield data[offset:offset + 50]
    return asyncio.run(service.upload(chunks(), filename, library_id))


def test_zip_upload_preserves_pages_and_waits_for_confirmation_after_scan(tmp_path, monkeypatch):
    settings, db, archive, _ = _setup(tmp_path)
    path = tmp_path / "source.zip"
    _make_cbz(path)
    managed = archive.libraries.list()["result"][0]
    archive.libraries.update(managed["id"], {"config": {**managed["config"], "auto_scrape": True, "stable_seconds": 0}})
    service = UploadService(archive)
    monkeypatch.setattr(services, "uploads", service)
    with TestClient(app) as client:
        response = client.post("/api/library/upload?filename=source.zip", content=path.read_bytes())
    assert response.status_code == 201, response.text
    result = response.json()
    work_id = result["work_id"]
    assert result["filename"] == "source.cbz" and result["page_count"] == 2
    source = archive.libraries.source_file(work_id)
    stored = archive.libraries.resolve_file(source)
    assert stored.suffix == ".cbz" and stored.read_bytes() == path.read_bytes()
    assert archive.read_page(work_id, 1)[0]
    item = db.fetchone("SELECT * FROM library_items WHERE work_id=?", (work_id,))
    LibraryIndexService(settings, db, archive.libraries).scan(managed["id"])
    assert db.fetchone("SELECT scrape_status FROM library_items WHERE id=?", (item["id"],))["scrape_status"] == "done"
    assert db.fetchone("SELECT remote_gallery_id FROM works WHERE id=?", (work_id,))["remote_gallery_id"] is None
    assert not list(settings.tmp_dir.glob(".upload-*"))


@pytest.mark.parametrize("name,data", [("file.rar", b"abc"), ("empty.cbz", b""), ("broken.zip", b"not zip")])
def test_invalid_upload_leaves_no_work_or_temp_file(tmp_path, name, data):
    settings, db, archive, _ = _setup(tmp_path)
    with pytest.raises((ValueError, zipfile.BadZipFile)):
        upload(UploadService(archive), data, name)
    assert not db.fetchall("SELECT id FROM works")
    assert not list(settings.tmp_dir.glob(".upload-*"))


def test_upload_size_and_invalid_archive_rejected_before_import(tmp_path, monkeypatch):
    settings, db, archive, _ = _setup(tmp_path)
    path = tmp_path / "book.cbz"
    _make_cbz(path)
    monkeypatch.setattr("app.services.upload_service.MAX_UPLOAD_BYTES", 30)
    with pytest.raises(ValueError, match="2 GB"):
        upload(UploadService(archive), path.read_bytes())
    monkeypatch.setattr("app.services.upload_service.MAX_UPLOAD_BYTES", 10000)
    for member in ("notes.txt", "../001.png"):
        body = io.BytesIO()
        with zipfile.ZipFile(body, "w") as cbz:
            cbz.writestr(member, b"bad")
        with pytest.raises(ValueError):
            upload(UploadService(archive), body.getvalue())
    assert not db.fetchall("SELECT id FROM works")
    assert not list(settings.tmp_dir.glob(".upload-*"))


def test_mounted_upload_writeback_and_delete_have_independent_permissions(tmp_path):
    settings, db, archive, governance = _setup(tmp_path)
    root = tmp_path / "mount"
    root.mkdir()
    library = archive.libraries.create({"name": "Mount", "kind": "mounted", "root_path": str(root), "read_only": True})
    path = tmp_path / "source.zip"
    _make_cbz(path)
    with pytest.raises(PermissionError):
        upload(UploadService(archive), path.read_bytes(), library_id=library["id"])
    archive.libraries.update(library["id"], {"read_only": False})
    result = upload(UploadService(archive), path.read_bytes(), library_id=library["id"])
    work_id = result["work_id"]
    source = archive.libraries.source_file(work_id)
    stored = archive.libraries.resolve_file(source)
    assert stored.parent == root
    files = FileMaintenanceService(db, settings)
    migration = LibraryMigrationService(settings, db, archive.libraries, None, files, None)
    target = [{"kind": "work", "work_id": work_id}]
    with pytest.raises((PermissionError, ValueError)):
        governance.write_back_comicinfo(work_id)
    assert files.preview_delete(target)["works_to_remove"] == 0
    archive.libraries.update(library["id"], {"read_only": True, "config": {"allow_writeback": True, "allow_delete": False}})
    assert governance.write_back_comicinfo(work_id)["written"]
    with pytest.raises(PermissionError):
        migration._move_allowed(work_id, source, stored)
    assert files.preview_delete(target)["works_to_remove"] == 0
    archive.libraries.update(library["id"], {"config": {"allow_writeback": False, "allow_delete": True}})
    with pytest.raises((PermissionError, ValueError)):
        governance.write_back_comicinfo(work_id)
    assert files.preview_delete(target)["works_to_remove"] == 1
    migration._move_allowed(work_id, source, stored)
    assert governance._file_summary(archive.libraries.files(work_id)[0])["read_only"]
    archive.libraries.update(library["id"], {"config": {"allow_delete": False}})
    assert files.delete(target)["removed_works"] == 0 and stored.exists()
    archive.libraries.update(library["id"], {"config": {"allow_delete": True}})
    assert files.delete(target)["removed_works"] == 1 and not stored.exists()
