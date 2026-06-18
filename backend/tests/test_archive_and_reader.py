import io
import zipfile
from pathlib import Path

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
