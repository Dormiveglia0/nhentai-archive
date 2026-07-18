import io
import shutil
import zipfile
from pathlib import Path

from PIL import Image

from app.config import Settings
from app.database import Database
from app.services.archive_service import ArchiveService
from app.services.reader_service import ReaderService


def make_tiny_cbz(path: Path) -> None:
    png = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc```\x00"
        b"\x00\x00\x04\x00\x01\xf6\x178U\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("002.jpg", b"fake-jpg")
        archive.writestr("001.png", png)
        archive.writestr("notes.txt", "ignored")


def make_color_cbz(path: Path, color: tuple[int, int, int]) -> None:
    body = io.BytesIO()
    Image.new("RGB", (16, 16), color).save(body, format="PNG")
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("001.png", body.getvalue())


def test_archive_service_indexes_cbz_image_pages_in_natural_order(tmp_path):
    settings = Settings(data_dir=tmp_path / "data", database_path=tmp_path / "data" / "archive.db")
    db = Database(settings.database_path)
    db.init_schema()
    cbz_path = tmp_path / "book.cbz"
    make_tiny_cbz(cbz_path)

    service = ArchiveService(db, settings)
    work_id = service.ingest_cbz(
        cbz_path,
        source="local",
        title="Tiny Archive",
        remote_gallery_id=None,
        metadata={},
    )

    pages = service.list_pages(work_id)

    assert [page["page_index"] for page in pages] == [1, 2]
    assert [page["archive_member"] for page in pages] == ["001.png", "002.jpg"]
    assert pages[0]["media_type"] == "image/png"
    with db.connect() as conn:
        source_path = conn.execute("SELECT path FROM work_files WHERE work_id = ?", (work_id,)).fetchone()[0]
        cover_path = conn.execute("SELECT cover_path FROM works WHERE id = ?", (work_id,)).fetchone()[0]
    assert source_path.startswith("library/")
    assert cover_path.startswith("covers/")


def test_archive_service_generates_and_caches_page_thumbnail(tmp_path):
    settings = Settings(data_dir=tmp_path / "data", database_path=tmp_path / "data" / "archive.db")
    db = Database(settings.database_path)
    db.init_schema()
    cbz_path = tmp_path / "book.cbz"
    make_tiny_cbz(cbz_path)

    service = ArchiveService(db, settings)
    work_id = service.ingest_cbz(cbz_path, source="local", title="Tiny Archive", remote_gallery_id=None, metadata={})

    body, media_type = service.read_page_thumbnail(work_id, 1, width=64)

    assert media_type == "image/jpeg"
    assert body[:2] == b"\xff\xd8"  # JPEG SOI marker
    cache_file = settings.thumbs_dir / f"{work_id}-1-64.jpg"
    assert cache_file.exists()
    # Second call must hit the cache and return identical bytes.
    assert service.read_page_thumbnail(work_id, 1, width=64)[0] == body


def test_reingest_invalidates_cached_page_thumbnail(tmp_path):
    settings = Settings(data_dir=tmp_path / "data", database_path=tmp_path / "data" / "archive.db")
    db = Database(settings.database_path)
    db.init_schema()
    service = ArchiveService(db, settings)
    first_path = tmp_path / "first.cbz"
    second_path = tmp_path / "second.cbz"
    make_color_cbz(first_path, (255, 0, 0))
    make_color_cbz(second_path, (0, 0, 255))

    work_id = service.ingest_cbz(first_path, "remote", "Colors", 42, {})
    first_thumb = service.read_page_thumbnail(work_id, 1, width=64)[0]
    cache_file = settings.thumbs_dir / f"{work_id}-1-64.jpg"
    assert cache_file.exists()

    reingested_id = service.ingest_cbz(second_path, "remote", "Colors", 42, {})

    assert reingested_id == work_id
    assert not cache_file.exists()
    assert service.read_page_thumbnail(work_id, 1, width=64)[0] != first_thumb


def test_reingest_copy_failure_keeps_previous_archive_intact(tmp_path, monkeypatch):
    settings = Settings(data_dir=tmp_path / "data", database_path=tmp_path / "data" / "archive.db")
    db = Database(settings.database_path)
    db.init_schema()
    service = ArchiveService(db, settings)
    first_path = tmp_path / "first.cbz"
    second_path = tmp_path / "second.cbz"
    make_color_cbz(first_path, (255, 0, 0))
    make_color_cbz(second_path, (0, 0, 255))
    work_id = service.ingest_cbz(first_path, "remote", "Colors", 42, {})
    stored_path = Path(
        db.fetchone(
            "SELECT path FROM work_files WHERE work_id = ? AND kind = 'source_cbz'", (work_id,)
        )["path"]
    )
    previous_bytes = stored_path.read_bytes()

    def interrupted_copy(_source, destination):
        Path(destination).write_bytes(b"partial")
        raise OSError("copy interrupted")

    monkeypatch.setattr(shutil, "copy2", interrupted_copy)

    try:
        service.ingest_cbz(second_path, "remote", "Colors", 42, {})
    except OSError as exc:
        assert "interrupted" in str(exc)
    else:
        raise AssertionError("ingest should surface the copy failure")

    assert stored_path.read_bytes() == previous_bytes
    assert list(settings.library_dir.glob("*.tmp")) == []


def test_failed_new_ingest_does_not_leave_an_imported_work(tmp_path, monkeypatch):
    settings = Settings(data_dir=tmp_path / "data", database_path=tmp_path / "data" / "archive.db")
    db = Database(settings.database_path)
    db.init_schema()
    service = ArchiveService(db, settings)
    source = tmp_path / "new.cbz"
    make_color_cbz(source, (255, 0, 0))

    monkeypatch.setattr(shutil, "copy2", lambda *_args: (_ for _ in ()).throw(OSError("disk full")))

    try:
        service.ingest_cbz(source, "remote", "New", 99, {})
    except OSError as exc:
        assert "disk full" in str(exc)
    else:
        raise AssertionError("ingest should surface the copy failure")

    assert db.fetchone("SELECT id FROM works WHERE remote_gallery_id = 99") is None
    assert list(settings.library_dir.glob("*.cbz")) == []


def test_reader_service_upserts_progress_and_history(tmp_path):
    settings = Settings(data_dir=tmp_path / "data", database_path=tmp_path / "data" / "archive.db")
    db = Database(settings.database_path)
    db.init_schema()
    archive = ArchiveService(db, settings)
    cbz_path = tmp_path / "book.cbz"
    make_tiny_cbz(cbz_path)
    work_id = archive.ingest_cbz(cbz_path, "local", "Tiny Archive", None, {})

    reader = ReaderService(db)
    state = reader.update_state(work_id, page_index=2, completed=True)

    assert state["page_index"] == 2
    assert state["page_count"] == 2
    assert state["progress_percent"] == 100
    assert state["completed"] is True
    assert reader.get_state(work_id)["page_index"] == 2

def test_archive_stores_cbz_named_after_work_not_sequence(tmp_path):
    settings = Settings(data_dir=tmp_path / "data", database_path=tmp_path / "data" / "archive.db")
    db = Database(settings.database_path)
    db.init_schema()
    cbz_path = tmp_path / "book.cbz"
    make_tiny_cbz(cbz_path)

    service = ArchiveService(db, settings)
    work_id = service.ingest_cbz(
        cbz_path,
        source="remote",
        title='My: Work*Title?',
        remote_gallery_id=177013,
        metadata={"remote": "nhentai"},
    )

    stored = db.fetchone(
        "SELECT path FROM work_files WHERE work_id = ? AND kind = 'source_cbz'",
        (work_id,),
    )
    name = Path(stored["path"]).name
    # Named after the (sanitized) work title with a gallery-id marker, never a bare number.
    assert name == "My WorkTitle [177013].cbz"
    assert name != f"{work_id}.cbz"
