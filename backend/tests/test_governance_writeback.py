import hashlib
import io
import zipfile
from pathlib import Path

import pytest

from app.config import Settings
from app.database import Database
from app.services.archive_service import ArchiveService
from app.services.export_service import ExportService
from app.services.governance_service import GovernanceService


def _png() -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc```\x00"
        b"\x00\x00\x04\x00\x01\xf6\x178U\x00\x00\x00\x00IEND\xaeB`\x82"
    )


def _make_cbz(path: Path) -> None:
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("001.png", _png())
        archive.writestr("002.png", _png())
        archive.writestr("meta.json", '{"source":"real"}')
        archive.writestr("ComicInfo.xml", "<ComicInfo><Title>Old Title</Title></ComicInfo>")


def _setup(tmp_path):
    settings = Settings(data_dir=tmp_path / "data", database_path=tmp_path / "data" / "archive.db")
    db = Database(settings.database_path)
    db.init_schema()
    archive = ArchiveService(db, settings)
    governance = GovernanceService(db, settings=settings)
    return settings, db, archive, governance


def _import_work(db, archive, tmp_path, gallery_id: int = 1234) -> int:
    cbz = tmp_path / f"source-{gallery_id}.cbz"
    _make_cbz(cbz)
    work_id = archive.ingest_cbz(
        cbz, "remote", "Rain Classroom", gallery_id,
        {"remote": "nhentai", "media_id": "media-1234",
         "title_japanese": "雨后の教室", "pretty_title": "Rain Classroom Pretty"},
    )
    db.execute(
        "INSERT INTO work_metadata (work_id, field, value, source, source_value) "
        "VALUES (?, 'title', 'New Title', 'manual', NULL)",
        (work_id,),
    )
    return work_id


def _source_path(db, work_id: int) -> Path:
    row = db.fetchone(
        "SELECT path FROM work_files WHERE work_id = ? AND kind = 'source_cbz'", (work_id,)
    )
    return Path(row["path"])


def test_write_back_injects_comicinfo_and_preserves_pages(tmp_path):
    _settings, db, archive, governance = _setup(tmp_path)
    work_id = _import_work(db, archive, tmp_path)
    source = _source_path(db, work_id)
    with zipfile.ZipFile(source) as original:
        pages = {n: original.read(n) for n in ("001.png", "002.png")}

    result = governance.write_back_comicinfo(work_id)

    assert result["written"] is True
    assert result["fields"]["Title"] == "New Title"
    with zipfile.ZipFile(source) as written:
        assert written.namelist().count("ComicInfo.xml") == 1
        assert "<Title>New Title</Title>" in written.read("ComicInfo.xml").decode()
        for name, body in pages.items():
            assert written.read(name) == body


def test_write_back_updates_work_files_hash_and_size(tmp_path):
    _settings, db, archive, governance = _setup(tmp_path)
    work_id = _import_work(db, archive, tmp_path)
    source = _source_path(db, work_id)

    result = governance.write_back_comicinfo(work_id)

    on_disk = source.read_bytes()
    expected_sha = hashlib.sha256(on_disk).hexdigest()
    row = db.fetchone(
        "SELECT sha256, size_bytes FROM work_files WHERE work_id = ? AND kind = 'source_cbz'",
        (work_id,),
    )
    assert row["sha256"] == expected_sha == result["new_sha256"]
    assert int(row["size_bytes"]) == len(on_disk) == result["new_size_bytes"]


def test_write_back_matches_export_comicinfo_fields(tmp_path):
    settings, db, archive, governance = _setup(tmp_path)
    work_id = _import_work(db, archive, tmp_path)
    exports = ExportService(db, settings)

    _name, export_bytes = exports.build_cbz(work_id)
    with zipfile.ZipFile(io.BytesIO(export_bytes)) as exported:
        export_xml = exported.read("ComicInfo.xml").decode()

    governance.write_back_comicinfo(work_id)
    with zipfile.ZipFile(_source_path(db, work_id)) as written:
        write_back_xml = written.read("ComicInfo.xml").decode()

    assert export_xml == write_back_xml


def test_write_back_raises_for_missing_source_without_touching_disk(tmp_path):
    _settings, db, archive, governance = _setup(tmp_path)
    work_id = _import_work(db, archive, tmp_path)
    source = _source_path(db, work_id)
    source.unlink()

    with pytest.raises(ValueError):
        governance.write_back_comicinfo(work_id)
    assert not source.exists()
    assert list(source.parent.glob("*.tmp")) == []


def test_write_back_rejects_path_outside_library(tmp_path):
    _settings, db, archive, governance = _setup(tmp_path)
    work_id = _import_work(db, archive, tmp_path)
    outside = tmp_path / "outside.cbz"
    _make_cbz(outside)
    db.execute(
        "UPDATE work_files SET path = ? WHERE work_id = ? AND kind = 'source_cbz'",
        (str(outside), work_id),
    )
    before = outside.read_bytes()

    with pytest.raises(ValueError):
        governance.write_back_comicinfo(work_id)
    assert outside.read_bytes() == before


def test_write_back_keeps_source_intact_when_reseal_fails(tmp_path, monkeypatch):
    _settings, db, archive, governance = _setup(tmp_path)
    work_id = _import_work(db, archive, tmp_path)
    source = _source_path(db, work_id)
    before = source.read_bytes()

    from app.services import comicinfo
    monkeypatch.setattr(comicinfo, "reseal_cbz", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("boom")))

    with pytest.raises(RuntimeError):
        governance.write_back_comicinfo(work_id)
    assert source.read_bytes() == before
    assert list(source.parent.glob("*.tmp")) == []
