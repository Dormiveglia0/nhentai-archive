import hashlib
import zipfile
from pathlib import Path

from app.config import Settings
from app.database import Database
from app.services import comicinfo
from app.services.archive_service import ArchiveService
from app.services.library_scan_service import LibraryScanService


def _png() -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc```\x00"
        b"\x00\x00\x04\x00\x01\xf6\x178U\x00\x00\x00\x00IEND\xaeB`\x82"
    )


def _make_cbz(path: Path, web_gallery_id=None) -> None:
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("001.png", _png())
        if web_gallery_id is not None:
            xml = comicinfo.to_xml({"Title": "T", "Web": f"https://nhentai.net/g/{web_gallery_id}/"})
            archive.writestr("ComicInfo.xml", xml)


def _setup(tmp_path):
    settings = Settings(data_dir=tmp_path / "data", database_path=tmp_path / "data" / "archive.db")
    settings.ensure_directories()
    db = Database(settings.database_path)
    db.init_schema()
    archive = ArchiveService(db, settings)
    return settings, db, archive


def test_preview_classifies_linked_local_and_unreadable(tmp_path):
    settings, db, _ = _setup(tmp_path)
    _make_cbz(settings.library_dir / "linked.cbz", web_gallery_id=177013)
    _make_cbz(settings.library_dir / "local.cbz")
    (settings.library_dir / "broken.cbz").write_bytes(b"not a zip")

    preview = LibraryScanService(settings, db).preview()

    assert [p["gallery_id"] for p in preview["new_linked"]] == [177013]
    assert len(preview["new_local"]) == 1
    assert len(preview["unreadable"]) == 1
    assert preview["counts"]["new_linked"] == 1


def test_preview_skips_already_indexed(tmp_path):
    settings, db, archive = _setup(tmp_path)
    src = tmp_path / "seed.cbz"
    _make_cbz(src)
    archive.ingest_cbz(src, source="local", title="seed", remote_gallery_id=None, metadata={})

    preview = LibraryScanService(settings, db).preview()

    assert preview["new_local"] == []
    assert preview["new_linked"] == []
