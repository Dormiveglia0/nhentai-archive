"""Tests for bulk_apply backfill_source_web action (Task 5)."""
import json
import zipfile
from pathlib import Path

import pytest

from app.config import Settings
from app.database import Database
from app.services import comicinfo
from app.services.archive_service import ArchiveService
from app.services.governance_service import GovernanceService


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
        if comic_info is not None:
            archive.writestr("ComicInfo.xml", comic_info)


def _setup(tmp_path):
    settings = Settings(data_dir=tmp_path / "data", database_path=tmp_path / "data" / "archive.db")
    db = Database(settings.database_path)
    db.init_schema()
    archive = ArchiveService(db, settings)
    service = GovernanceService(db, settings=settings)
    return settings, db, archive, service


def _import_work(
    db: Database,
    archive: ArchiveService,
    tmp_path: Path,
    gallery_id: int | None,
    title: str = "Test Work",
    comic_info: str | None = None,
) -> int:
    cbz = tmp_path / f"src-{gallery_id or 'local'}-{title.replace(' ', '_')}.cbz"
    _make_cbz(cbz, comic_info=comic_info)
    source = "remote" if gallery_id else "local"
    work_id = archive.ingest_cbz(
        cbz,
        source,
        title,
        gallery_id,
        {"remote": "nhentai" if gallery_id else None},
    )
    if gallery_id:
        db.execute(
            "INSERT OR IGNORE INTO remote_galleries (gallery_id, payload_json) VALUES (?, ?)",
            (
                gallery_id,
                json.dumps(
                    {
                        "id": gallery_id,
                        "title": {"english": title},
                        "num_pages": 2,
                    }
                ),
            ),
        )
    return work_id


def _get_source_sha(db: Database, work_id: int) -> str | None:
    row = db.fetchone(
        "SELECT sha256 FROM work_files WHERE work_id = ? AND kind = 'source_cbz' "
        "ORDER BY created_at DESC, id DESC LIMIT 1",
        (work_id,),
    )
    return row["sha256"] if row else None


def _get_source_path(db: Database, work_id: int) -> Path | None:
    row = db.fetchone(
        "SELECT path FROM work_files WHERE work_id = ? AND kind = 'source_cbz' "
        "ORDER BY created_at DESC, id DESC LIMIT 1",
        (work_id,),
    )
    return Path(row["path"]) if row and row["path"] else None


# ---------------------------------------------------------------------------
# Test 1: backfill injects Web into a CBZ that has no Web element
# ---------------------------------------------------------------------------
def test_backfill_injects_web_and_updates_sha(tmp_path):
    """After backfill_source_web, the CBZ ComicInfo gains <Web> and sha256 changes."""
    _settings, db, archive, service = _setup(tmp_path)
    gallery_id = 9001
    # CBZ has ComicInfo but no <Web> element
    work_id = _import_work(
        db, archive, tmp_path, gallery_id, title="Web Backfill Work",
        comic_info="<ComicInfo><Title>Old Title</Title></ComicInfo>",
    )

    sha_before = _get_source_sha(db, work_id)
    source_path = _get_source_path(db, work_id)

    result = service.bulk_apply([work_id], {"backfill_source_web": True})

    # Entry should record written
    entries = {e["work_id"]: e for e in result["result"]}
    assert entries[work_id]["backfill_web"]["written"] is True

    # sha256 must have changed
    sha_after = _get_source_sha(db, work_id)
    assert sha_after != sha_before, "sha256 must be updated after write-back"

    # The CBZ's ComicInfo must now contain <Web> pointing to this gallery
    assert source_path is not None and source_path.exists()
    ci_fields = service._archive_metadata(str(source_path))["comicinfo"]
    assert "Web" in ci_fields, "ComicInfo must contain a Web element after backfill"

    # Verify the Web value encodes the correct gallery_id
    web_value = ci_fields["Web"]
    recovered_id = comicinfo.gallery_id_from_xml(f"<ComicInfo><Web>{web_value}</Web></ComicInfo>")
    assert recovered_id == gallery_id


# ---------------------------------------------------------------------------
# Test 2: backfill on a CBZ with no ComicInfo at all also works
# ---------------------------------------------------------------------------
def test_backfill_injects_web_when_no_comicinfo(tmp_path):
    """Backfill works even when source CBZ contains no ComicInfo.xml at all."""
    _settings, db, archive, service = _setup(tmp_path)
    gallery_id = 9002
    work_id = _import_work(
        db, archive, tmp_path, gallery_id, title="No ComicInfo Work",
        comic_info=None,
    )

    sha_before = _get_source_sha(db, work_id)
    result = service.bulk_apply([work_id], {"backfill_source_web": True})

    entries = {e["work_id"]: e for e in result["result"]}
    assert entries[work_id]["backfill_web"]["written"] is True

    sha_after = _get_source_sha(db, work_id)
    assert sha_after != sha_before

    source_path = _get_source_path(db, work_id)
    ci_fields = service._archive_metadata(str(source_path))["comicinfo"]
    assert "Web" in ci_fields


# ---------------------------------------------------------------------------
# Test 3: work without remote_gallery_id is skipped as no_gallery_id
# ---------------------------------------------------------------------------
def test_backfill_skips_work_without_gallery_id(tmp_path):
    """A work with no remote_gallery_id is skipped with reason no_gallery_id."""
    _settings, db, archive, service = _setup(tmp_path)
    # gallery_id=None → local import, remote_gallery_id stays NULL
    work_id = _import_work(
        db, archive, tmp_path, gallery_id=None, title="Local Only Work",
        comic_info=None,
    )

    sha_before = _get_source_sha(db, work_id)
    result = service.bulk_apply([work_id], {"backfill_source_web": True})

    # Entry must record skipped reason
    entries = {e["work_id"]: e for e in result["result"]}
    assert entries[work_id]["backfill_web"] == {"skipped": "no_gallery_id"}

    # Skipped list in summary must include this work
    skipped_reasons = {s["work_id"]: s["reason"] for s in result["summary"]["skipped"]}
    assert skipped_reasons[work_id] == "no_gallery_id"

    # Source CBZ must NOT have been modified (sha unchanged)
    sha_after = _get_source_sha(db, work_id)
    assert sha_after == sha_before, "sha256 must not change for a skipped work"


# ---------------------------------------------------------------------------
# Test 4: work whose ComicInfo already has <Web> is skipped as already_has_web
# ---------------------------------------------------------------------------
def test_backfill_skips_work_that_already_has_web(tmp_path):
    """A work whose ComicInfo already has <Web> is skipped with reason already_has_web."""
    _settings, db, archive, service = _setup(tmp_path)
    gallery_id = 9003
    work_id = _import_work(
        db, archive, tmp_path, gallery_id, title="Already Has Web",
        comic_info=f"<ComicInfo><Title>X</Title><Web>https://nhentai.net/g/{gallery_id}/</Web></ComicInfo>",
    )

    sha_before = _get_source_sha(db, work_id)
    result = service.bulk_apply([work_id], {"backfill_source_web": True})

    entries = {e["work_id"]: e for e in result["result"]}
    assert entries[work_id]["backfill_web"] == {"skipped": "already_has_web"}

    skipped_reasons = {s["work_id"]: s["reason"] for s in result["summary"]["skipped"]}
    assert skipped_reasons[work_id] == "already_has_web"

    sha_after = _get_source_sha(db, work_id)
    assert sha_after == sha_before


# ---------------------------------------------------------------------------
# Test 5: backfill_source_web alone is accepted as a valid action
# ---------------------------------------------------------------------------
def test_backfill_alone_is_a_valid_action(tmp_path):
    """bulk_apply must not raise ValueError when only backfill_source_web is set."""
    _settings, db, archive, service = _setup(tmp_path)
    work_id = _import_work(db, archive, tmp_path, 9004, title="Valid Action Work")
    # Must not raise
    result = service.bulk_apply([work_id], {"backfill_source_web": True})
    assert "result" in result
    assert "summary" in result


# ---------------------------------------------------------------------------
# Test 6: bulk_apply with no action still raises ValueError
# ---------------------------------------------------------------------------
def test_backfill_false_still_raises_if_no_action(tmp_path):
    """bulk_apply still raises when backfill_source_web is False and no other action."""
    _settings, db, archive, service = _setup(tmp_path)
    work_id = _import_work(db, archive, tmp_path, 9005, title="No Action Work")
    with pytest.raises(ValueError):
        service.bulk_apply([work_id], {"backfill_source_web": False})
