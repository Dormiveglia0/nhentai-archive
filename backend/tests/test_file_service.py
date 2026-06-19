import zipfile
from pathlib import Path

from app.config import Settings
from app.database import Database
from app.services.archive_service import ArchiveService
from app.services.file_service import FileMaintenanceService


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


def _setup(tmp_path):
    settings = Settings(data_dir=tmp_path / "data", database_path=tmp_path / "data" / "archive.db")
    db = Database(settings.database_path)
    db.init_schema()
    archive = ArchiveService(db, settings)
    files = FileMaintenanceService(db, settings)
    return settings, db, archive, files


def _import_work(db, archive, tmp_path, title="Rain", gallery_id=1234) -> int:
    cbz = tmp_path / f"source-{gallery_id}.cbz"
    _make_cbz(cbz)
    return archive.ingest_cbz(
        cbz, "remote", title, gallery_id,
        {"remote": "nhentai", "media_id": f"media-{gallery_id}", "title_japanese": "雨"},
    )


def test_healthy_work_is_ok_and_overview_counts_real_state(tmp_path):
    _settings, db, archive, files = _setup(tmp_path)
    work_id = _import_work(db, archive, tmp_path)

    inv = files.inventory(category="work")
    entry = inv["result"][0]
    assert entry["kind"] == "work"
    assert entry["work_id"] == work_id
    assert entry["status"] == "ok"
    assert entry["flags"] == []
    assert entry["size_bytes"] > 0

    overview = files.overview()
    assert overview["work_count"] == 1
    assert overview["missing_source"] == 0
    assert overview["missing_cover"] == 0
    assert overview["source_bytes"] > 0


def test_missing_source_and_cover_are_flagged(tmp_path):
    _settings, db, archive, files = _setup(tmp_path)
    work_id = _import_work(db, archive, tmp_path)
    source = db.fetchone(
        "SELECT path FROM work_files WHERE work_id=? AND kind='source_cbz'", (work_id,)
    )
    Path(source["path"]).unlink()
    cover = db.fetchone("SELECT cover_path FROM works WHERE id=?", (work_id,))
    Path(cover["cover_path"]).unlink()

    entry = files.inventory(category="work")["result"][0]
    assert entry["status"] == "missing_source"
    assert "missing_source" in entry["flags"]
    assert "missing_cover" in entry["flags"]
    assert files.overview()["missing_source"] == 1
    assert files.overview()["missing_cover"] == 1


def test_relative_path_is_normalized_against_cwd(tmp_path, monkeypatch):
    _settings, db, archive, files = _setup(tmp_path)
    monkeypatch.chdir(tmp_path)
    rel_dir = tmp_path / "data" / "library"
    rel_dir.mkdir(parents=True, exist_ok=True)
    _make_cbz(rel_dir / "rel.cbz")
    db.execute(
        "INSERT INTO works (title, source, page_count) VALUES ('Rel', 'local', 0)"
    )
    work_id = db.fetchone("SELECT id FROM works WHERE title='Rel'")["id"]
    db.execute(
        "INSERT INTO work_files (work_id, kind, path, size_bytes) VALUES (?, 'source_cbz', 'data/library/rel.cbz', 1)",
        (work_id,),
    )

    entry = next(e for e in files.inventory(category="work")["result"] if e["work_id"] == work_id)
    assert entry["status"] == "ok"
    assert "missing_source" not in entry["flags"]


def test_orphan_and_stale_files_are_detected(tmp_path):
    settings, db, archive, files = _setup(tmp_path)
    _import_work(db, archive, tmp_path)
    (settings.library_dir / "loose.cbz").write_bytes(b"loose-bytes")
    (settings.tmp_dir / "partial.download").write_bytes(b"tmp")
    (settings.export_dir / "old.cbz").write_bytes(b"export-leftover")

    orphans = files.inventory(category="orphan")["result"]
    assert any(e["name"] == "loose.cbz" and e["status"] == "orphan" for e in orphans)
    stale = files.inventory(category="stale")["result"]
    stale_names = {e["name"] for e in stale}
    assert {"partial.download", "old.cbz"}.issubset(stale_names)

    overview = files.overview()
    assert overview["orphan_count"] == 1
    assert overview["stale_count"] == 2
    assert overview["reclaimable_bytes"] == len(b"loose-bytes") + len(b"tmp") + len(b"export-leftover")


def test_size_mismatch_flag_when_db_size_differs(tmp_path):
    _settings, db, archive, files = _setup(tmp_path)
    work_id = _import_work(db, archive, tmp_path)
    db.execute(
        "UPDATE work_files SET size_bytes = 999999999 WHERE work_id=? AND kind='source_cbz'",
        (work_id,),
    )
    entry = files.inventory(category="work")["result"][0]
    assert "size_mismatch" in entry["flags"]


def test_inventory_filters_by_query_and_status(tmp_path):
    _settings, db, archive, files = _setup(tmp_path)
    _import_work(db, archive, tmp_path, title="Sunset Road", gallery_id=1)
    _import_work(db, archive, tmp_path, title="Rainy Day", gallery_id=2)

    hit = files.inventory(q="sunset")
    assert len(hit["result"]) == 1
    assert hit["result"][0]["title"] == "Sunset Road"
    assert files.inventory(status="ok")["total"] == 2
