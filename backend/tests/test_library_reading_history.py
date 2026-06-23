import zipfile
from pathlib import Path

from app.config import Settings
from app.database import Database
from app.services.archive_service import ArchiveService
from app.services.library_service import LibraryService
from app.services.reader_service import ReaderService


def _png() -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc```\x00"
        b"\x00\x00\x04\x00\x01\xf6\x178U\x00\x00\x00\x00IEND\xaeB`\x82"
    )


def _make_cbz(path: Path, pages: int) -> None:
    with zipfile.ZipFile(path, "w") as archive:
        for index in range(1, pages + 1):
            archive.writestr(f"{index:03d}.png", _png())


def _setup(tmp_path):
    settings = Settings(data_dir=tmp_path / "data", database_path=tmp_path / "data" / "archive.db")
    db = Database(settings.database_path)
    db.init_schema()
    archive = ArchiveService(db, settings)
    return settings, db, archive


def _import(archive, tmp_path, name, pages=10) -> int:
    cbz = tmp_path / f"{name}.cbz"
    _make_cbz(cbz, pages)
    return archive.ingest_cbz(cbz, "remote", name.title(), None, {"remote": "nhentai"})


def test_reading_history_empty(tmp_path):
    _settings, db, _archive = _setup(tmp_path)
    library = LibraryService(db)
    out = library.reading_history()
    assert out == {"result": [], "total": 0, "page": 1, "per_page": 30, "num_pages": 1}


def test_reading_history_aggregates_same_work_same_day(tmp_path):
    _settings, db, archive = _setup(tmp_path)
    library = LibraryService(db)
    reader = ReaderService(db)
    work_id = _import(archive, tmp_path, "alpha", pages=10)
    reader.update_state(work_id, page_index=2)
    reader.update_state(work_id, page_index=5)

    out = library.reading_history()
    assert out["total"] == 1
    assert len(out["result"]) == 1
    entry = out["result"][0]
    assert entry["id"] == work_id
    assert entry["read_events"] == 2
    assert entry["furthest_page"] == 5
    assert entry["progress_percent"] == 50
    assert entry["completed"] is False
    assert entry["page_count"] == 10


def test_reading_history_splits_across_days_desc(tmp_path):
    _settings, db, archive = _setup(tmp_path)
    library = LibraryService(db)
    work_id = _import(archive, tmp_path, "beta", pages=10)
    db.execute(
        "INSERT INTO reading_history (work_id, page_index, opened_at) VALUES (?, 3, '2026-06-20 08:00:00')",
        (work_id,),
    )
    db.execute(
        "INSERT INTO reading_history (work_id, page_index, opened_at) VALUES (?, 7, '2026-06-21 09:00:00')",
        (work_id,),
    )
    out = library.reading_history()
    assert out["total"] == 2
    assert [e["date"] for e in out["result"]] == ["2026-06-21", "2026-06-20"]
    assert out["result"][0]["furthest_page"] == 7


def test_reading_history_paginates(tmp_path):
    _settings, db, archive = _setup(tmp_path)
    library = LibraryService(db)
    work_id = _import(archive, tmp_path, "gamma", pages=10)
    for day in range(1, 6):
        db.execute(
            "INSERT INTO reading_history (work_id, page_index, opened_at) VALUES (?, 1, ?)",
            (work_id, f"2026-06-0{day} 08:00:00"),
        )
    out = library.reading_history(page=1, per_page=2)
    assert out["total"] == 5
    assert out["num_pages"] == 3
    assert len(out["result"]) == 2
