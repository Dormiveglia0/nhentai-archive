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


def _make_cbz(path: Path) -> None:
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("001.png", _png())
        archive.writestr("002.png", _png())


class _FakeTranslation:
    def __init__(self, transform=None):
        self.calls: list[tuple[list[str], str]] = []
        self._transform = transform or (lambda text: f"[zh]{text}")

    def translate(self, texts, source="en", target=None):
        self.calls.append((list(texts), source))
        return [self._transform(text) for text in texts]

    def config(self):
        return {"provider": "google_free"}


class _FakeDict:
    def __init__(self, translation):
        self.translation = translation


def _setup(tmp_path, translation=None):
    settings = Settings(data_dir=tmp_path / "data", database_path=tmp_path / "data" / "archive.db")
    db = Database(settings.database_path)
    db.init_schema()
    archive = ArchiveService(db, settings)
    dictionary = _FakeDict(translation) if translation is not None else None
    governance = GovernanceService(db, dictionary, settings=settings)
    return settings, db, archive, governance


def _import(db, archive, tmp_path, gallery_id: int, *, title: str) -> int:
    cbz = tmp_path / f"src-{gallery_id}.cbz"
    _make_cbz(cbz)
    return archive.ingest_cbz(cbz, "remote", title, gallery_id, {"remote": "nhentai"})


def test_translate_metadata_suggests_chinese_without_writing(tmp_path):
    translation = _FakeTranslation()
    _settings, db, archive, governance = _setup(tmp_path, translation)
    work_id = _import(db, archive, tmp_path, 1, title="Sunset Road")

    out = governance.translate_metadata(work_id)

    titles = {item["field"]: item for item in out["result"]}
    assert "title" in titles
    assert titles["title"]["original"] == "Sunset Road"
    assert titles["title"]["suggestion"] == "[zh]Sunset Road"
    assert out["provider"] == "google_free"
    # 源语言自动检测。
    assert translation.calls and translation.calls[0][1] == "auto"
    # 只读:绝不写 work_metadata。
    assert db.fetchone("SELECT COUNT(*) AS c FROM work_metadata WHERE work_id = ?", (work_id,))["c"] == 0


def test_translate_metadata_skips_empty_source_fields(tmp_path):
    translation = _FakeTranslation()
    _settings, db, archive, governance = _setup(tmp_path, translation)
    work_id = _import(db, archive, tmp_path, 2, title="Only Title")

    out = governance.translate_metadata(work_id)

    translated_fields = {item["field"] for item in out["result"]}
    skipped_fields = {item["field"]: item["reason"] for item in out["skipped"]}
    # summary 无来源,应被跳过而非伪造。
    assert "summary" not in translated_fields
    assert skipped_fields.get("summary") == "no_source"


def test_translate_metadata_skips_no_change(tmp_path):
    translation = _FakeTranslation(transform=lambda text: text)  # identity → 无变化
    _settings, db, archive, governance = _setup(tmp_path, translation)
    work_id = _import(db, archive, tmp_path, 3, title="Same")

    out = governance.translate_metadata(work_id)

    assert all(item["field"] != "title" for item in out["result"])
    assert any(s["field"] == "title" and s["reason"] == "no_change" for s in out["skipped"])


def test_translate_metadata_requires_translation_service(tmp_path):
    _settings, db, archive, governance = _setup(tmp_path, translation=None)
    work_id = _import(db, archive, tmp_path, 4, title="X")

    with pytest.raises(ValueError, match="机翻服务未配置"):
        governance.translate_metadata(work_id)
