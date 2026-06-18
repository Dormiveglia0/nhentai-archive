import json
import zipfile
from pathlib import Path

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


def _make_cbz(path: Path, comic_info: str | None = None, metadata: dict | None = None) -> None:
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("001.png", _png())
        archive.writestr("002.png", _png())
        if comic_info is not None:
            archive.writestr("ComicInfo.xml", comic_info)
        if metadata is not None:
            archive.writestr("metadata.json", json.dumps(metadata, ensure_ascii=False))


def _setup(tmp_path):
    settings = Settings(data_dir=tmp_path / "data", database_path=tmp_path / "data" / "archive.db")
    db = Database(settings.database_path)
    db.init_schema()
    archive = ArchiveService(db, settings)
    service = GovernanceService(db)
    return db, archive, service


def _import_work(
    db: Database,
    archive: ArchiveService,
    tmp_path: Path,
    title: str = "Rain Classroom",
    gallery_id: int | None = 1234,
    comic_info: str | None = None,
) -> int:
    cbz = tmp_path / f"{title.replace(' ', '_')}.cbz"
    _make_cbz(cbz, comic_info=comic_info)
    work_id = archive.ingest_cbz(
        cbz,
        "remote" if gallery_id else "local",
        title,
        gallery_id,
        {
            "remote": "nhentai" if gallery_id else None,
            "media_id": "media-1234" if gallery_id else None,
            "title_japanese": "雨后の教室",
            "pretty_title": "Rain Classroom Pretty",
        },
    )
    if gallery_id:
        db.execute(
            """
            INSERT INTO remote_galleries (gallery_id, media_id, payload_json)
            VALUES (?, 'media-1234', ?)
            """,
            (
                gallery_id,
                json.dumps(
                    {
                        "id": gallery_id,
                        "media_id": "media-1234",
                        "title": {"english": title, "japanese": "雨后の教室", "pretty": "Rain Classroom Pretty"},
                        "num_pages": 2,
                        "upload_date": 1714177920,
                        "tags": [
                            {"id": 10, "type": "artist", "name": "tonari", "slug": "tonari"},
                            {"id": 20, "type": "language", "name": "japanese", "slug": "japanese"},
                        ],
                    },
                    ensure_ascii=False,
                ),
            ),
        )
    return work_id


def _link_tag(
    db: Database,
    work_id: int,
    remote_id: int = 10,
    tag_type: str = "artist",
    name: str = "tonari",
    dictionary_status: str | None = None,
) -> int | None:
    db.execute(
        """
        INSERT INTO remote_tags (remote_id, type, name, slug, payload_json)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(remote_id) DO NOTHING
        """,
        (remote_id, tag_type, name, name, json.dumps({"id": remote_id, "type": tag_type, "name": name, "slug": name})),
    )
    dictionary_id = None
    if dictionary_status:
        db.execute(
            """
            INSERT INTO local_tag_dictionary (original_text, normalized_key, zh_name, tag_type, remote_tag_id, status)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (name, name, "邻里", tag_type, remote_id, dictionary_status),
        )
        dictionary_id = db.fetchone("SELECT id FROM local_tag_dictionary WHERE remote_tag_id = ?", (remote_id,))["id"]
    db.execute(
        """
        INSERT INTO work_tags (work_id, remote_tag_id, dictionary_id, tag_type, remote_name, remote_slug)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(work_id, remote_tag_id) DO UPDATE SET dictionary_id = excluded.dictionary_id
        """,
        (work_id, remote_id, dictionary_id, tag_type, name, name),
    )
    return dictionary_id


def test_queue_is_empty_for_empty_library(tmp_path):
    _db, _archive, service = _setup(tmp_path)

    queue = service.queue()

    assert queue["result"] == []
    assert queue["summary"]["total"] == 0


def test_queue_reports_real_reasons_for_work_without_comicinfo_or_tags(tmp_path):
    _db, archive, service = _setup(tmp_path)
    work_id = _import_work(_db, archive, tmp_path, comic_info=None)

    queue = service.queue()

    item = queue["result"][0]
    assert item["work"]["id"] == work_id
    reason_codes = {reason["code"] for reason in item["reasons"]}
    assert {"missing_comicinfo", "untagged"}.issubset(reason_codes)
    assert item["completeness_percent"] < 100


def test_aggregate_parses_real_comicinfo_fields(tmp_path):
    db, archive, service = _setup(tmp_path)
    work_id = _import_work(
        db,
        archive,
        tmp_path,
        comic_info="""
        <ComicInfo>
          <Title>Rain Classroom ComicInfo</Title>
          <Writer>tonari</Writer>
          <Publisher>Tonari Teas</Publisher>
          <LanguageISO>ja</LanguageISO>
          <PageCount>2</PageCount>
          <Summary>Quiet after-school rain.</Summary>
        </ComicInfo>
        """,
    )
    _link_tag(db, work_id, remote_id=10, tag_type="artist", name="tonari")

    aggregate = service.work_governance(work_id)

    fields = {field["field"]: field for field in aggregate["metadata"]["fields"]}
    assert fields["title"]["source_value"] == "Rain Classroom ComicInfo"
    assert fields["artist"]["source_value"] == "tonari"
    assert fields["group"]["source_value"] == "Tonari Teas"
    assert fields["language"]["source_value"] == "ja"
    assert aggregate["tags"]["summary"]["confirmed"] == 1


def test_apply_persists_local_metadata_decisions(tmp_path):
    db, archive, service = _setup(tmp_path)
    work_id = _import_work(db, archive, tmp_path)

    result = service.apply(
        work_id,
        {
            "metadata": [
                {"field": "title", "value": "雨后的教室", "source": "manual"},
                {"field": "language", "value": "日语", "source": "remote"},
            ]
        },
    )
    reloaded = service.work_governance(work_id)
    fields = {field["field"]: field for field in reloaded["metadata"]["fields"]}

    assert result["saved"] == 2
    assert fields["title"]["working_value"] == "雨后的教室"
    assert fields["title"]["working_source"] == "manual"
    assert fields["language"]["working_value"] == "日语"


def test_dictionary_review_tags_surface_pending_and_conflict_summary(tmp_path):
    db, archive, service = _setup(tmp_path)
    work_id = _import_work(db, archive, tmp_path)
    _link_tag(db, work_id, remote_id=10, tag_type="artist", name="tonari", dictionary_status="review")
    _link_tag(db, work_id, remote_id=11, tag_type="tag", name="rain", dictionary_status="conflict")

    aggregate = service.work_governance(work_id)

    assert aggregate["dictionary"] == {"matched": 0, "pending": 1, "conflicts": 1}
    assert aggregate["tags"]["summary"]["pending"] == 1
    assert aggregate["tags"]["summary"]["conflicts"] == 1
