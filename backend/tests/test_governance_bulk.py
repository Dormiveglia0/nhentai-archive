import zipfile
from pathlib import Path

import pytest

from app.config import Settings
from app.database import Database
from app.services.archive_service import ArchiveService
from app.services.governance_service import GovernanceService


def _png() -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc```\x00"
        b"\x00\x00\x04\x00\x01\xf6\x178U\x00\x00\x00\x00IEND\xaeB`\x82"
    )


def _make_cbz(path: Path, with_comicinfo: bool = False) -> None:
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("001.png", _png())
        archive.writestr("002.png", _png())
        if with_comicinfo:
            archive.writestr("ComicInfo.xml", "<ComicInfo><Title>Old</Title></ComicInfo>")


def _setup(tmp_path):
    settings = Settings(data_dir=tmp_path / "data", database_path=tmp_path / "data" / "archive.db")
    db = Database(settings.database_path)
    db.init_schema()
    archive = ArchiveService(db, settings)
    governance = GovernanceService(db, settings=settings)
    return settings, db, archive, governance


def _import(db, archive, tmp_path, gallery_id: int, *, title: str, with_comicinfo: bool = False) -> int:
    cbz = tmp_path / f"src-{gallery_id}.cbz"
    _make_cbz(cbz, with_comicinfo=with_comicinfo)
    # 写一个真实 remote payload,让 source_value 有来源(remote)。
    db.execute(
        "INSERT INTO remote_galleries (gallery_id, payload_json) VALUES (?, ?)",
        (gallery_id, '{"title": {"english": "%s"}, "num_pages": 2}' % title),
    )
    return archive.ingest_cbz(cbz, "remote", title, gallery_id, {"remote": "nhentai"})


def test_bulk_preview_lists_fillable_fields_without_writing(tmp_path):
    _settings, db, archive, governance = _setup(tmp_path)
    work_id = _import(db, archive, tmp_path, 111, title="Alpha")
    out = governance.bulk_preview([work_id], {"fill_missing_metadata": True})
    assert out["summary"]["works"] == 1
    item = out["result"][0]
    fields = {f["field"] for f in item["fill_fields"]}
    # title 已由 ingest 落到 works.title(current 非空),不应进入补全;language 等缺失且有来源才进入。
    assert "title" not in fields
    # 预览不应写任何 work_metadata。
    assert db.fetchone("SELECT COUNT(*) AS c FROM work_metadata WHERE work_id = ?", (work_id,))["c"] == 0


def test_bulk_apply_fills_only_missing_and_never_overwrites(tmp_path):
    _settings, db, archive, governance = _setup(tmp_path)
    work_id = _import(db, archive, tmp_path, 222, title="Beta")
    # 预置一个人工 language 值,batch 不得覆盖它。
    db.execute(
        "INSERT INTO work_metadata (work_id, field, value, source, source_value) "
        "VALUES (?, 'language', '中文', 'manual', NULL)",
        (work_id,),
    )
    out = governance.bulk_apply([work_id], {"fill_missing_metadata": True})
    assert "language" not in out["result"][0]["filled"]
    kept = db.fetchone("SELECT value FROM work_metadata WHERE work_id = ? AND field = 'language'", (work_id,))
    assert kept["value"] == "中文"


def test_bulk_apply_write_back_updates_hash_and_isolates_failure(tmp_path):
    _settings, db, archive, governance = _setup(tmp_path)
    ok_id = _import(db, archive, tmp_path, 333, title="Gamma", with_comicinfo=True)
    bad_id = _import(db, archive, tmp_path, 444, title="Delta", with_comicinfo=True)
    # 破坏 bad 的源文件路径,使其回写失败。
    db.execute(
        "UPDATE work_files SET path = '/nonexistent/missing.cbz' WHERE work_id = ? AND kind = 'source_cbz'",
        (bad_id,),
    )
    before = db.fetchone("SELECT sha256 FROM work_files WHERE work_id = ? AND kind = 'source_cbz'", (ok_id,))["sha256"]

    out = governance.bulk_apply([ok_id, bad_id], {"write_back": True})

    results = {r["work_id"]: r for r in out["result"]}
    assert results[ok_id]["write_back"]["written"] is True
    assert "error" in results[bad_id]["write_back"]
    assert out["summary"]["written"] == 1
    assert out["summary"]["errors"] == 1
    after = db.fetchone("SELECT sha256 FROM work_files WHERE work_id = ? AND kind = 'source_cbz'", (ok_id,))["sha256"]
    assert after != before  # ok 作品哈希已同步更新


def test_bulk_requires_an_action(tmp_path):
    _settings, db, archive, governance = _setup(tmp_path)
    work_id = _import(db, archive, tmp_path, 555, title="Echo")
    with pytest.raises(ValueError):
        governance.bulk_apply([work_id], {})
    with pytest.raises(ValueError):
        governance.bulk_preview([work_id], {"fill_missing_metadata": False, "write_back": False})


def test_bulk_apply_api_rejects_empty_actions(tmp_path, monkeypatch):
    from fastapi.testclient import TestClient
    import app.main as main

    _settings, db, archive, governance = _setup(tmp_path)
    work_id = _import(db, archive, tmp_path, 666, title="Foxtrot")
    monkeypatch.setattr(main, "governance", governance)
    client = TestClient(main.app)

    resp = client.post("/api/governance/bulk/apply", json={"work_ids": [work_id], "actions": {}})
    assert resp.status_code == 422
