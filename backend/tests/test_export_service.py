import io
import zipfile
from pathlib import Path

from app.config import Settings
from app.database import Database
from app.services.archive_service import ArchiveService
from app.services.export_service import ExportService


def _png() -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc```\x00"
        b"\x00\x00\x04\x00\x01\xf6\x178U\x00\x00\x00\x00IEND\xaeB`\x82"
    )


def _make_cbz(path: Path, comic_info: str | None = None) -> None:
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("001.png", _png())
        archive.writestr("002.png", _png())
        archive.writestr("meta.json", '{"source":"real"}')
        if comic_info is not None:
            archive.writestr("ComicInfo.xml", comic_info)


def _setup(tmp_path):
    settings = Settings(data_dir=tmp_path / "data", database_path=tmp_path / "data" / "archive.db")
    db = Database(settings.database_path)
    db.init_schema()
    archive = ArchiveService(db, settings)
    exports = ExportService(db, settings)
    return settings, db, archive, exports


def _import_work(db: Database, archive: ArchiveService, tmp_path: Path, title: str = "Rain Classroom", gallery_id: int = 1234) -> int:
    cbz = tmp_path / f"source-{gallery_id}.cbz"
    _make_cbz(cbz, comic_info="<ComicInfo><Title>Old Title</Title></ComicInfo>")
    work_id = archive.ingest_cbz(
        cbz,
        "remote",
        title,
        gallery_id,
        {
            "remote": "nhentai",
            "media_id": "media-1234",
            "title_japanese": "雨后の教室",
            "pretty_title": "Rain Classroom Pretty",
        },
    )
    db.execute(
        """
        INSERT INTO remote_tags (remote_id, type, name, slug, payload_json)
        VALUES (10, 'artist', 'tonari', 'tonari', '{}'),
               (20, 'tag', 'rain', 'rain', '{}')
        ON CONFLICT(remote_id) DO NOTHING
        """
    )
    db.execute(
        """
        INSERT INTO local_tag_dictionary (original_text, normalized_key, zh_name, tag_type, remote_tag_id)
        VALUES ('rain', 'rain', '雨', 'tag', 20)
        ON CONFLICT(normalized_key, tag_type) DO NOTHING
        """
    )
    dictionary_id = db.fetchone("SELECT id FROM local_tag_dictionary WHERE remote_tag_id = 20")["id"]
    db.execute(
        """
        INSERT INTO work_tags (work_id, remote_tag_id, dictionary_id, tag_type, remote_name, remote_slug)
        VALUES (?, 10, NULL, 'artist', 'tonari', 'tonari'),
               (?, 20, ?, 'tag', 'rain', 'rain')
        """,
        (work_id, work_id, dictionary_id),
    )
    return work_id


def test_export_preview_uses_real_source_and_governance_metadata_without_writes(tmp_path):
    _settings, db, archive, exports = _setup(tmp_path)
    work_id = _import_work(db, archive, tmp_path)
    db.execute(
        """
        INSERT INTO work_metadata (work_id, field, value, source, source_value)
        VALUES (?, 'title', '雨后的教室', 'manual', 'Rain Classroom'),
               (?, 'artist', '邻里', 'manual', 'tonari'),
               (?, 'language', 'zh', 'manual', 'ja')
        """,
        (work_id, work_id, work_id),
    )

    preview = exports.preview(work_id)

    assert preview["work"]["id"] == work_id
    assert preview["source_file"]["exists"] is True
    assert preview["output_name"].endswith(".cbz")
    assert "output_path" not in preview
    assert preview["will_write"] == ["ComicInfo.xml"]
    assert "meta.json" in preview["will_keep"]
    assert preview["will_not_modify"] == [preview["source_file"]["path"]]
    assert preview["comic_info"]["Title"] == "雨后的教室"
    assert preview["comic_info"]["Writer"] == "邻里"
    assert preview["comic_info"]["LanguageISO"] == "zh"
    assert preview["comic_info"]["Tags"] == "tonari, 雨"
    assert preview["blockers"] == []


def test_build_cbz_returns_packaged_bytes_with_comicinfo_and_preserves_original(tmp_path):
    _settings, db, archive, exports = _setup(tmp_path)
    work_id = _import_work(db, archive, tmp_path)
    source_row = db.fetchone("SELECT path FROM work_files WHERE work_id = ? AND kind = 'source_cbz'", (work_id,))
    source_path = Path(source_row["path"])
    before_bytes = source_path.read_bytes()

    filename, data = exports.build_cbz(work_id)

    assert filename == "Rain Classroom Pretty [1234].cbz"
    with zipfile.ZipFile(io.BytesIO(data)) as archive_file:
        names = set(archive_file.namelist())
        comic_info = archive_file.read("ComicInfo.xml").decode("utf-8")
    assert {"001.png", "002.png", "meta.json", "ComicInfo.xml"}.issubset(names)
    assert "<Title>Rain Classroom</Title>" in comic_info
    assert "<PageCount>2</PageCount>" in comic_info
    # Original CBZ on disk is never touched.
    assert source_path.read_bytes() == before_bytes


def test_build_cbz_options_can_drop_comicinfo_and_json_and_compression(tmp_path):
    _settings, db, archive, exports = _setup(tmp_path)
    work_id = _import_work(db, archive, tmp_path)

    _filename, data = exports.build_cbz(
        work_id, {"write_comicinfo": False, "keep_json": False, "compress": False}
    )

    with zipfile.ZipFile(io.BytesIO(data)) as archive_file:
        names = set(archive_file.namelist())
        infos = archive_file.infolist()
    assert "ComicInfo.xml" not in names
    assert not any(name.endswith(".json") for name in names)
    assert {"001.png", "002.png"}.issubset(names)
    assert all(info.compress_type == zipfile.ZIP_STORED for info in infos)


def test_preview_reflects_options(tmp_path):
    _settings, db, archive, exports = _setup(tmp_path)
    work_id = _import_work(db, archive, tmp_path)

    preview = exports.preview(work_id, {"write_comicinfo": False, "keep_json": False})

    assert preview["will_write"] == []
    assert preview["will_keep"] == []
    assert preview["options"] == {"write_comicinfo": False, "keep_json": False, "compress": True}


def test_build_cbz_sanitizes_custom_output_name(tmp_path):
    _settings, db, archive, exports = _setup(tmp_path)
    work_id = _import_work(db, archive, tmp_path)

    filename, data = exports.build_cbz(work_id, {"output_name": "../Rain:Final"})

    assert filename == "RainFinal.cbz"
    with zipfile.ZipFile(io.BytesIO(data)) as archive_file:
        assert "ComicInfo.xml" in archive_file.namelist()


def test_build_cbz_raises_for_missing_source_file(tmp_path):
    _settings, db, archive, exports = _setup(tmp_path)
    work_id = _import_work(db, archive, tmp_path)
    source_row = db.fetchone("SELECT path FROM work_files WHERE work_id = ? AND kind = 'source_cbz'", (work_id,))
    Path(source_row["path"]).unlink()

    try:
        exports.build_cbz(work_id)
    except ValueError as exc:
        assert "源 CBZ" in str(exc)
    else:
        raise AssertionError("build_cbz should raise when the source file is missing")


def test_build_bundle_packs_selected_works_with_unique_member_names(tmp_path):
    _settings, db, archive, exports = _setup(tmp_path)
    first_id = _import_work(db, archive, tmp_path, title="First Work", gallery_id=1234)
    second_id = _import_work(db, archive, tmp_path, title="Second Work", gallery_id=1235)

    filename, data = exports.build_bundle(
        [
            {"work_id": first_id, "output_name": "same.cbz"},
            {"work_id": second_id, "output_name": "same.cbz"},
        ]
    )

    assert filename == "导出合集 (2).zip"
    with zipfile.ZipFile(io.BytesIO(data)) as bundle:
        members = bundle.namelist()
        assert members == ["same.cbz", "same (2).cbz"]
        for member in members:
            inner = bundle.read(member)
            with zipfile.ZipFile(io.BytesIO(inner)) as cbz:
                assert "ComicInfo.xml" in cbz.namelist()


def test_build_bundle_skips_blocked_items_and_raises_when_none_left(tmp_path):
    _settings, db, archive, exports = _setup(tmp_path)
    ready_id = _import_work(db, archive, tmp_path, title="Ready", gallery_id=1234)
    blocked_id = _import_work(db, archive, tmp_path, title="Blocked", gallery_id=1235)
    blocked_source = db.fetchone("SELECT path FROM work_files WHERE work_id = ? AND kind = 'source_cbz'", (blocked_id,))
    Path(blocked_source["path"]).unlink()

    filename, data = exports.build_bundle([{"work_id": ready_id}, {"work_id": blocked_id}])
    with zipfile.ZipFile(io.BytesIO(data)) as bundle:
        assert len(bundle.namelist()) == 1
    assert filename == "导出合集 (1).zip"

    try:
        exports.build_bundle([{"work_id": blocked_id}])
    except ValueError as exc:
        assert "没有可导出" in str(exc)
    else:
        raise AssertionError("build_bundle should raise when no item can be exported")


def test_summary_reports_only_queue_counts(tmp_path):
    _settings, db, archive, exports = _setup(tmp_path)
    _import_work(db, archive, tmp_path, title="First Work", gallery_id=1234)

    summary = exports.summary()

    assert set(summary.keys()) == {"total", "ready", "blocked", "warnings"}
    assert summary["total"] == 1


def test_queue_summary_counts_ready_blocked_and_warning_items(tmp_path):
    _settings, db, archive, exports = _setup(tmp_path)
    ready_id = _import_work(db, archive, tmp_path, title="Ready Work", gallery_id=1234)
    warning_id = _import_work(db, archive, tmp_path, title="Warning Work", gallery_id=1235)
    blocked_id = _import_work(db, archive, tmp_path, title="Blocked Work", gallery_id=1236)
    db.execute(
        """
        INSERT INTO work_metadata (work_id, field, value, source)
        VALUES (?, 'language', 'ja', 'manual'),
               (?, 'language', 'ja', 'manual'),
               (?, 'language', 'ja', 'manual')
        """,
        (ready_id, warning_id, blocked_id),
    )
    db.execute("DELETE FROM work_tags WHERE work_id = ?", (warning_id,))
    blocked_source = db.fetchone("SELECT path FROM work_files WHERE work_id = ? AND kind = 'source_cbz'", (blocked_id,))
    Path(blocked_source["path"]).unlink()

    queue = exports.queue()
    by_id = {item["work"]["id"]: item for item in queue["result"]}

    assert queue["summary"] == {"total": 3, "ready": 2, "blocked": 1, "warnings": 1}
    assert "generated_at" not in by_id[ready_id]
    assert by_id[ready_id]["blockers"] == []
    assert by_id[ready_id]["warnings"] == []
    assert any(warning["code"] == "missing_writer" for warning in by_id[warning_id]["warnings"])
    assert any(blocker["code"] == "missing_source_file" for blocker in by_id[blocked_id]["blockers"])


def test_preview_reports_real_blockers_for_missing_source_file(tmp_path):
    _settings, db, archive, exports = _setup(tmp_path)
    work_id = _import_work(db, archive, tmp_path)
    source_row = db.fetchone("SELECT path FROM work_files WHERE work_id = ? AND kind = 'source_cbz'", (work_id,))
    Path(source_row["path"]).unlink()

    preview = exports.preview(work_id)

    assert preview["source_file"]["exists"] is False
    assert any(blocker["code"] == "missing_source_file" for blocker in preview["blockers"])
