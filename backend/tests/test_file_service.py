import json
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


def test_running_import_temp_file_is_not_stale(tmp_path):
    settings, db, archive, files = _setup(tmp_path)
    _import_work(db, archive, tmp_path)
    active_tmp = settings.tmp_dir / "nhentai-4321.cbz"
    active_tmp.write_bytes(b"downloading")
    stale_tmp = settings.tmp_dir / "partial.download"
    stale_tmp.write_bytes(b"old")
    db.execute(
        """
        INSERT INTO jobs (type, status, stage, target_json)
        VALUES ('remote_import', 'running', 'downloading_cbz', ?)
        """,
        (json.dumps({"gallery_id": 4321}),),
    )

    stale = files.inventory(category="stale")["result"]

    assert {entry["name"] for entry in stale} == {"partial.download"}
    assert files.overview()["stale_count"] == 1


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


def test_inventory_status_filter_isolates_size_mismatch_flag(tmp_path):
    _settings, db, archive, files = _setup(tmp_path)
    healthy = _import_work(db, archive, tmp_path, title="Healthy", gallery_id=1)
    mismatch = _import_work(db, archive, tmp_path, title="Mismatch", gallery_id=2)
    db.execute(
        "UPDATE work_files SET size_bytes = 999999999 WHERE work_id=? AND kind='source_cbz'",
        (mismatch,),
    )

    # size_mismatch work still reports status "ok" but carries the flag.
    result = files.inventory(status="size_mismatch")["result"]
    assert {e["work_id"] for e in result} == {mismatch}
    # plain "ok" status filter still returns both works.
    assert files.inventory(status="ok")["total"] == 2
    assert healthy != mismatch


def test_inventory_sort_by_size_orders_entries(tmp_path):
    settings, db, archive, files = _setup(tmp_path)
    _import_work(db, archive, tmp_path, title="Work", gallery_id=1)
    (settings.library_dir / "tiny.cbz").write_bytes(b"a")
    (settings.export_dir / "huge.cbz").write_bytes(b"z" * 5000)

    desc = files.inventory(sort="size_desc")["result"]
    sizes_desc = [e["size_bytes"] for e in desc]
    assert sizes_desc == sorted(sizes_desc, reverse=True)
    assert desc[0]["size_bytes"] >= desc[-1]["size_bytes"]

    asc = files.inventory(sort="size_asc")["result"]
    sizes_asc = [e["size_bytes"] for e in asc]
    assert sizes_asc == sorted(sizes_asc)
    assert asc[0].get("name") == "tiny.cbz"


def test_preview_delete_work_expands_cascade_without_touching_disk(tmp_path):
    _settings, db, archive, files = _setup(tmp_path)
    work_id = _import_work(db, archive, tmp_path)
    db.execute(
        "INSERT INTO remote_tags (remote_id, type, name, slug, payload_json) VALUES (5, 'tag', 't', 't', '{}') "
        "ON CONFLICT(remote_id) DO NOTHING"
    )
    db.execute(
        "INSERT INTO work_tags (work_id, remote_tag_id, tag_type, remote_name) VALUES (?, 5, 'tag', 't')",
        (work_id,),
    )
    db.execute(
        "INSERT INTO work_metadata (work_id, field, value, source) VALUES (?, 'title', 'X', 'manual')",
        (work_id,),
    )
    db.execute(
        "INSERT INTO reader_progress (work_id, page_index, page_count, progress_percent) VALUES (?, 1, 2, 50)",
        (work_id,),
    )
    source = db.fetchone("SELECT path FROM work_files WHERE work_id=? AND kind='source_cbz'", (work_id,))

    preview = files.preview_delete([{"kind": "work", "work_id": work_id}])

    item = preview["items"][0]
    assert item["work_tags"] == 1
    assert item["has_progress"] is True
    assert item["has_governance"] is True
    assert "has_progress" in item["warnings"]
    assert "has_governance" in item["warnings"]
    assert preview["works_to_remove"] == 1
    assert preview["files_to_delete"] >= 2  # source + cover
    assert preview["reclaim_bytes"] > 0
    # nothing deleted by preview
    assert Path(source["path"]).exists()
    assert db.fetchone("SELECT 1 FROM works WHERE id=?", (work_id,)) is not None


def test_preview_delete_treats_review_history_as_governance(tmp_path):
    _settings, db, archive, files = _setup(tmp_path)
    work_id = _import_work(db, archive, tmp_path)
    db.execute(
        "INSERT INTO governance_reviews (work_id, action, snapshot_hash) VALUES (?, 'approve', 'test')",
        (work_id,),
    )

    item = files.preview_delete([{"kind": "work", "work_id": work_id}])["items"][0]

    assert item["has_governance"] is True
    assert "has_governance" in item["warnings"]


def test_preview_delete_orphan_reports_reclaim_bytes(tmp_path):
    settings, _db, _archive, files = _setup(tmp_path)
    orphan = settings.library_dir / "loose.cbz"
    orphan.write_bytes(b"xyz")

    preview = files.preview_delete([{"kind": "orphan", "path": str(orphan)}])

    assert preview["items"][0]["exists"] is True
    assert preview["reclaim_bytes"] == 3
    assert orphan.exists()


def test_preview_delete_flags_already_gone_and_forbidden(tmp_path):
    _settings, _db, _archive, files = _setup(tmp_path)
    outside = tmp_path / "outside.cbz"
    outside.write_bytes(b"nope")

    preview = files.preview_delete(
        [{"kind": "work", "work_id": 999}, {"kind": "stale", "path": str(outside)}]
    )

    assert "already_gone" in preview["items"][0]["warnings"]
    assert "forbidden_path" in preview["items"][1]["warnings"]
    assert preview["reclaim_bytes"] == 0


def test_delete_work_cascades_all_tables_and_files(tmp_path):
    _settings, db, archive, files = _setup(tmp_path)
    keep_id = _import_work(db, archive, tmp_path, title="Keep", gallery_id=1)
    drop_id = _import_work(db, archive, tmp_path, title="Drop", gallery_id=2)
    db.execute(
        "INSERT INTO remote_tags (remote_id, type, name, slug, payload_json) VALUES (5, 'tag', 't', 't', '{}') "
        "ON CONFLICT(remote_id) DO NOTHING"
    )
    db.execute("INSERT INTO work_tags (work_id, remote_tag_id, tag_type) VALUES (?, 5, 'tag')", (drop_id,))
    db.execute("INSERT INTO work_metadata (work_id, field, value, source) VALUES (?, 'title', 'X', 'manual')", (drop_id,))
    db.execute("INSERT INTO governance_reviews (work_id, action, snapshot_hash) VALUES (?, 'approve', 'test')", (drop_id,))
    db.execute("INSERT INTO reader_progress (work_id, page_index, page_count, progress_percent) VALUES (?, 1, 2, 50)", (drop_id,))
    db.execute("INSERT INTO reading_history (work_id, page_index) VALUES (?, 1)", (drop_id,))
    drop_source = Path(db.fetchone("SELECT path FROM work_files WHERE work_id=? AND kind='source_cbz'", (drop_id,))["path"])
    drop_cover = Path(db.fetchone("SELECT cover_path FROM works WHERE id=?", (drop_id,))["cover_path"])
    keep_source = Path(db.fetchone("SELECT path FROM work_files WHERE work_id=? AND kind='source_cbz'", (keep_id,))["path"])
    keep_bytes = keep_source.read_bytes()

    result = files.delete([{"kind": "work", "work_id": drop_id}])

    assert result["removed_works"] == 1
    assert result["deleted_files"] >= 2
    assert result["reclaimed_bytes"] > 0
    assert result["errors"] == []
    assert not drop_source.exists()
    assert not drop_cover.exists()
    for table in ("works", "work_files", "work_pages", "work_tags", "work_metadata", "governance_reviews", "reader_progress", "reading_history"):
        assert db.fetchone(f"SELECT 1 FROM {table} WHERE work_id=?", (drop_id,)) is None if table != "works" else db.fetchone("SELECT 1 FROM works WHERE id=?", (drop_id,)) is None
    # other work untouched
    assert db.fetchone("SELECT 1 FROM works WHERE id=?", (keep_id,)) is not None
    assert keep_source.read_bytes() == keep_bytes


def test_delete_work_retains_metadata_when_file_removal_fails(tmp_path, monkeypatch):
    _settings, db, archive, files = _setup(tmp_path)
    work_id = _import_work(db, archive, tmp_path)
    source = Path(
        db.fetchone(
            "SELECT path FROM work_files WHERE work_id=? AND kind='source_cbz'", (work_id,)
        )["path"]
    )

    def reject_unlink(path, target, errors):
        errors.append({"target": target, "code": "unlink_failed", "message": f"blocked: {path.name}"})
        return 0

    monkeypatch.setattr(files, "_unlink", reject_unlink)

    result = files.delete([{"kind": "work", "work_id": work_id}])

    assert result["removed_works"] == 0
    assert result["deleted_files"] == 0
    assert source.exists()
    assert db.fetchone("SELECT 1 FROM works WHERE id=?", (work_id,)) is not None
    assert db.fetchone("SELECT 1 FROM work_files WHERE work_id=?", (work_id,)) is not None
    assert {error["code"] for error in result["errors"]} == {"unlink_failed", "work_retained"}


def test_delete_orphan_removes_only_that_file(tmp_path):
    settings, _db, _archive, files = _setup(tmp_path)
    orphan = settings.library_dir / "loose.cbz"
    orphan.write_bytes(b"xyz")

    result = files.delete([{"kind": "orphan", "path": str(orphan)}])

    assert result["deleted_files"] == 1
    assert result["reclaimed_bytes"] == 3
    assert not orphan.exists()


def test_delete_rejects_path_outside_managed_roots(tmp_path):
    _settings, _db, _archive, files = _setup(tmp_path)
    outside = tmp_path / "evil.cbz"
    outside.write_bytes(b"nope")

    result = files.delete([{"kind": "stale", "path": str(outside)}])

    assert result["deleted_files"] == 0
    assert any(err["code"] == "forbidden_path" for err in result["errors"])
    assert outside.exists()


def test_inventory_work_entry_has_tags_and_modified_time(tmp_path):
    _settings, db, archive, files = _setup(tmp_path)
    work_id = _import_work(db, archive, tmp_path)
    db.execute(
        "INSERT INTO remote_tags (remote_id, type, name, slug, payload_json) "
        "VALUES (30, 'tag', 'big', 'big', '{}') ON CONFLICT(remote_id) DO NOTHING"
    )
    db.execute(
        "INSERT INTO local_tag_dictionary (original_text, normalized_key, zh_name, tag_type, remote_tag_id) "
        "VALUES ('big', 'big', '巨乳', 'tag', 30) ON CONFLICT(normalized_key, tag_type) DO NOTHING"
    )
    dict_id = db.fetchone("SELECT id FROM local_tag_dictionary WHERE remote_tag_id=30")["id"]
    db.execute(
        "INSERT INTO work_tags (work_id, remote_tag_id, dictionary_id, tag_type, remote_name, remote_slug) "
        "VALUES (?, 30, ?, 'tag', 'big', 'big')",
        (work_id, dict_id),
    )

    entry = next(e for e in files.inventory(category="work")["result"] if e["work_id"] == work_id)
    assert "巨乳" in entry["tags"]
    assert any(tag["display"] == "巨乳" and tag["id"] == 30 for tag in entry["tag_items"])
    assert entry["updated_at"]


def test_duplicates_detects_real_hash_and_gallery_id_matches(tmp_path):
    _settings, db, archive, files = _setup(tmp_path)
    first = _import_work(db, archive, tmp_path, title="One", gallery_id=1)
    second = _import_work(db, archive, tmp_path, title="Two", gallery_id=2)
    db.execute("UPDATE work_files SET sha256='SAMEHASH' WHERE work_id IN (?, ?) AND kind='source_cbz'", (first, second))

    dup = files.duplicates()

    assert dup["hash"]["groups"] == 1
    assert dup["hash"]["files"] == 2
    assert dup["gallery_id"]["groups"] == 0
    assert dup["title_similar"] is None
