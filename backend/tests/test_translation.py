import json

import pytest

from app.config import Settings
from app.database import Database
from app.services import translation_service as ts
from app.services.dictionary_service import DictionaryService
from app.services.translation_service import TranslationError, TranslationService


def _db(tmp_path) -> Database:
    settings = Settings(data_dir=tmp_path / "data", database_path=tmp_path / "data" / "archive.db")
    db = Database(settings.database_path)
    db.init_schema()
    return db


# ---- provider adapters ----------------------------------------------------

def test_google_free_parses_segmented_response(tmp_path, monkeypatch):
    service = TranslationService(_db(tmp_path))
    captured = {}

    def fake_get(url, **kwargs):
        captured["url"] = url
        return [[["全彩", "full color", None, None]], None, "en"]

    monkeypatch.setattr(ts, "_http_get_json", fake_get)
    assert service.translate_one("full color") == "全彩"
    assert "translate.googleapis.com" in captured["url"]
    assert "tl=zh-CN" in captured["url"]


def test_deepl_uses_auth_and_parses_translations(tmp_path, monkeypatch):
    db = _db(tmp_path)
    service = TranslationService(db)
    db.execute("INSERT INTO settings (key, value) VALUES ('mt.provider', 'deepl')")
    db.execute("INSERT INTO settings (key, value) VALUES ('mt.deepl_api_key', 'secret-key')")
    captured = {}

    def fake_post(url, fields, *, headers=None, timeout=15):
        captured["url"] = url
        captured["headers"] = headers
        captured["fields"] = fields
        return {"translations": [{"text": "巨乳"}, {"text": "学校"}]}

    monkeypatch.setattr(ts, "_http_post_form", fake_post)
    assert service.translate(["big breasts", "school"]) == ["巨乳", "学校"]
    assert captured["headers"]["Authorization"] == "DeepL-Auth-Key secret-key"
    assert "api-free.deepl.com" in captured["url"]
    assert ("target_lang", "ZH") in captured["fields"]


def test_deepl_without_key_raises(tmp_path):
    db = _db(tmp_path)
    service = TranslationService(db)
    db.execute("INSERT INTO settings (key, value) VALUES ('mt.provider', 'deepl')")
    with pytest.raises(TranslationError):
        service.translate(["anything"])


def test_public_config_never_leaks_key(tmp_path):
    db = _db(tmp_path)
    service = TranslationService(db)
    db.execute("INSERT INTO settings (key, value) VALUES ('mt.deepl_api_key', 'secret')")
    public = service.public_config()
    assert public["deepl_api_key_configured"] is True
    assert "secret" not in json.dumps(public)


def test_verify_records_last_verify(tmp_path, monkeypatch):
    db = _db(tmp_path)
    service = TranslationService(db)
    monkeypatch.setattr(ts, "_http_get_json", lambda url, **k: [[["你好", "hi", None, None]]])
    result = service.verify()
    assert result["ok"] is True
    assert service.public_config()["last_verify"]["sample"] == "你好"


# ---- dictionary machine translation --------------------------------------

class FakeTranslation:
    def __init__(self, mapping):
        self.mapping = mapping

    def translate(self, texts, source="en", target=None):
        return [self.mapping.get(text, f"译{text}") for text in texts]

    def translate_one(self, text, source="en", target=None):
        return self.mapping.get(text, f"译{text}")

    def config(self):
        return {"provider": "google_free"}


def _seed_remote_tag(db, remote_id, name, slug, tag_type="tag"):
    db.execute(
        "INSERT INTO remote_tags (remote_id, type, name, slug, payload_json) VALUES (?, ?, ?, ?, '{}')",
        (remote_id, tag_type, name, slug),
    )


def test_translate_text_returns_machine_translation(tmp_path):
    db = _db(tmp_path)
    dictionary = DictionaryService(db, client=None, translation=FakeTranslation({"glasses": "眼镜"}))
    result = dictionary.translate_text("glasses")
    assert result["translation"] == "眼镜"
    assert result["provider"] == "google_free"


def test_generate_suggestions_creates_reviewable_rows_without_linking_works(tmp_path):
    db = _db(tmp_path)
    _seed_remote_tag(db, 501, "full color", "full-color")
    _seed_remote_tag(db, 502, "glasses", "glasses")
    dictionary = DictionaryService(
        db, client=None, translation=FakeTranslation({"full color": "全彩", "glasses": "眼镜"})
    )

    result = dictionary.generate_suggestions(limit=10)

    assert result["generated"] == 2
    rows = db.fetchall("SELECT zh_name, status, source, remote_tag_id FROM local_tag_dictionary ORDER BY remote_tag_id")
    assert [r["zh_name"] for r in rows] == ["全彩", "眼镜"]
    assert all(r["status"] == "suggested" and r["source"] == "machine" for r in rows)
    # Suggestions must NOT link work_tags before human review.
    assert db.fetchone("SELECT COUNT(*) AS c FROM work_tags")["c"] == 0
    assert dictionary.summary()["suggestions"] == 2
    suggested = dictionary.candidates(status="suggested", limit=10)["result"]
    assert {item["display"] for item in suggested} == {"全彩", "眼镜"}
    assert all(item["status"] == "suggested" for item in suggested)


def test_generate_suggestions_does_not_overwrite_configured_entry(tmp_path):
    db = _db(tmp_path)
    _seed_remote_tag(db, 600, "stockings", "stockings")
    dictionary = DictionaryService(db, client=None, translation=FakeTranslation({"stockings": "机翻丝袜"}))
    dictionary.apply(
        {
            "original_text": "stockings",
            "zh_name": "长袜（人工）",
            "tag_type": "tag",
            "remote_tag_id": 600,
            "status": "configured",
        }
    )

    dictionary.generate_suggestions(limit=10)

    row = db.fetchone("SELECT zh_name, status FROM local_tag_dictionary WHERE normalized_key = 'stockings'")
    assert row["zh_name"] == "长袜（人工）"
    assert row["status"] == "configured"


def test_translate_without_service_raises_value_error(tmp_path):
    db = _db(tmp_path)
    dictionary = DictionaryService(db, client=None, translation=None)
    with pytest.raises(ValueError):
        dictionary.translate_text("anything")
