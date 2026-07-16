import io
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


def _make_cbz(path: Path, pages: int = 3) -> None:
    with zipfile.ZipFile(path, "w") as archive:
        for index in range(1, pages + 1):
            archive.writestr(f"{index:03d}.png", _png())


def _setup(tmp_path):
    settings = Settings(data_dir=tmp_path / "data", database_path=tmp_path / "data" / "archive.db")
    db = Database(settings.database_path)
    db.init_schema()
    archive = ArchiveService(db, settings)
    return settings, db, archive


def _import_work(archive: ArchiveService, tmp_path: Path, name: str, title: str, source: str, gallery_id: int | None, pages: int = 3) -> int:
    cbz = tmp_path / f"{name}.cbz"
    _make_cbz(cbz, pages)
    return archive.ingest_cbz(cbz, source, title, gallery_id, {"remote": "nhentai" if source == "remote" else None})


def _link_tags(db: Database, work_id: int, tags: list[dict]) -> None:
    for tag in tags:
        db.execute(
            """
            INSERT INTO remote_tags (remote_id, type, name, slug, payload_json)
            VALUES (?, ?, ?, ?, '{}')
            ON CONFLICT(remote_id) DO NOTHING
            """,
            (tag["id"], tag["type"], tag["name"], tag["slug"]),
        )
        db.execute(
            """
            INSERT INTO work_tags (work_id, remote_tag_id, tag_type, remote_name, remote_slug)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(work_id, remote_tag_id) DO NOTHING
            """,
            (work_id, tag["id"], tag["type"], tag["name"], tag["slug"]),
        )


def test_summary_counts_only_real_rows(tmp_path):
    settings, db, archive = _setup(tmp_path)
    library = LibraryService(db)

    assert library.summary()["total"] == 0

    a = _import_work(archive, tmp_path, "a", "Alpha", "remote", 111, pages=4)
    b = _import_work(archive, tmp_path, "b", "Beta", "local", None, pages=2)
    _import_work(archive, tmp_path, "c", "Gamma", "remote", 222, pages=6)

    reader = ReaderService(db)
    reader.update_state(a, page_index=2)  # reading
    reader.update_state(b, page_index=2, completed=True)  # completed

    summary = library.summary()
    assert summary["total"] == 3
    assert summary["reading"] == 1
    assert summary["completed"] == 1
    assert summary["unread"] == 1
    assert summary["total_pages"] == 12
    assert summary["total_size_bytes"] > 0
    assert summary["sources"] == {"remote": 2, "local": 1}
    assert summary["untagged"] == 3


def test_search_filters_and_pagination(tmp_path):
    settings, db, archive = _setup(tmp_path)
    library = LibraryService(db)

    a = _import_work(archive, tmp_path, "a", "Sunset Garden", "remote", 111)
    b = _import_work(archive, tmp_path, "b", "Winter Lights", "local", None)
    _link_tags(db, a, [{"id": 10, "type": "artist", "name": "yamada", "slug": "yamada"}, {"id": 20, "type": "language", "name": "japanese", "slug": "japanese"}])
    _link_tags(db, b, [{"id": 10, "type": "artist", "name": "yamada", "slug": "yamada"}, {"id": 30, "type": "language", "name": "english", "slug": "english"}])

    # keyword search hits title
    by_title = library.search(q="sunset")
    assert by_title["total"] == 1
    assert by_title["result"][0]["id"] == a

    # source filter
    locals_only = library.search(source="local")
    assert [row["id"] for row in locals_only["result"]] == [b]

    # language filter via work_tags
    jp = library.search(language="japanese")
    assert [row["id"] for row in jp["result"]] == [a]

    # tag AND filter
    both_artist = library.search(tag_ids=[10])
    assert {row["id"] for row in both_artist["result"]} == {a, b}
    artist_and_jp = library.search(tag_ids=[10, 20])
    assert {row["id"] for row in artist_and_jp["result"]} == {a}

    # pagination metadata
    page1 = library.search(per_page=1, page=1)
    assert page1["total"] == 2
    assert page1["num_pages"] == 2
    assert len(page1["result"]) == 1


def test_work_includes_reader_metadata_and_real_tags(tmp_path):
    settings, db, archive = _setup(tmp_path)
    library = LibraryService(db)
    work_id = _import_work(archive, tmp_path, "reader", "Reader Work", "remote", 111)
    _link_tags(db, work_id, [
        {"id": 10, "type": "artist", "name": "author", "slug": "author"},
        {"id": 20, "type": "tag", "name": "story", "slug": "story"},
    ])

    work = library.work(work_id)

    assert work is not None
    assert [(tag["type"], tag["display"]) for tag in work["tags"]] == [("artist", "author"), ("tag", "story")]


def test_search_read_status_filter(tmp_path):
    settings, db, archive = _setup(tmp_path)
    library = LibraryService(db)
    reader = ReaderService(db)

    a = _import_work(archive, tmp_path, "a", "Alpha", "remote", 111, pages=4)
    b = _import_work(archive, tmp_path, "b", "Beta", "remote", 222, pages=4)
    _import_work(archive, tmp_path, "c", "Gamma", "remote", 333, pages=4)

    reader.update_state(a, page_index=2)
    reader.update_state(b, page_index=4, completed=True)

    assert {row["id"] for row in library.search(read_status="reading")["result"]} == {a}
    assert {row["id"] for row in library.search(read_status="completed")["result"]} == {b}
    unread_ids = {row["id"] for row in library.search(read_status="unread")["result"]}
    assert a not in unread_ids and b not in unread_ids


def test_recent_and_continue_sections(tmp_path):
    settings, db, archive = _setup(tmp_path)
    library = LibraryService(db)
    reader = ReaderService(db)

    a = _import_work(archive, tmp_path, "a", "Alpha", "remote", 111, pages=4)
    b = _import_work(archive, tmp_path, "b", "Beta", "remote", 222, pages=4)

    assert library.continue_reading()["result"] == []
    reader.update_state(a, page_index=2)  # in progress

    cont = library.continue_reading()["result"]
    assert [row["id"] for row in cont] == [a]
    recent = library.recent_read()["result"]
    assert [row["id"] for row in recent] == [a]
    added = library.recent_added()["result"]
    assert {row["id"] for row in added} == {a, b}


def test_tag_filters_uses_dictionary_display(tmp_path):
    settings, db, archive = _setup(tmp_path)
    library = LibraryService(db)

    a = _import_work(archive, tmp_path, "a", "Alpha", "remote", 111)
    _link_tags(db, a, [{"id": 40, "type": "tag", "name": "schoolgirl", "slug": "schoolgirl"}])
    db.execute(
        """
        INSERT INTO local_tag_dictionary (original_text, normalized_key, zh_name, tag_type, remote_tag_id)
        VALUES ('schoolgirl', 'schoolgirl', '女学生', 'tag', 40)
        """
    )
    db.execute("UPDATE work_tags SET dictionary_id = (SELECT id FROM local_tag_dictionary WHERE remote_tag_id = 40) WHERE remote_tag_id = 40")

    filters = library.tag_filters()["result"]
    schoolgirl = next(row for row in filters if row["id"] == 40)
    assert schoolgirl["display"] == "女学生"
    assert schoolgirl["count"] == 1

    # language tags are excluded from the tag filter pool
    _link_tags(db, a, [{"id": 50, "type": "language", "name": "japanese", "slug": "japanese"}])
    assert all(row["type"] != "language" for row in library.tag_filters()["result"])
