import json
import sqlite3

from app.config import Settings
from app.database import Database
from app.services.dictionary_service import DictionaryService
from app.services.discover_service import DiscoverService


class FakeDictionaryClient:
    def __init__(self):
        self.calls = []

    def tag_search(self, query, limit):
        self.calls.append(("tag_search", query, limit))
        return {"result": [{"id": 202, "type": "tag", "name": "winter", "slug": "winter"}]}


def make_service(tmp_path):
    settings = Settings(data_dir=tmp_path / "data", database_path=tmp_path / "data" / "archive.db")
    db = Database(settings.database_path)
    db.init_schema()
    client = FakeDictionaryClient()
    return db, client, DictionaryService(db, client)


def insert_remote_tag(db, remote_id=101, name="snowmelt"):
    db.execute(
        """
        INSERT INTO remote_tags (remote_id, type, name, slug, payload_json)
        VALUES (?, 'tag', ?, ?, ?)
        """,
        (remote_id, name, name, json.dumps({"id": remote_id, "type": "tag", "name": name, "slug": name})),
    )


def insert_remote_work(db, gallery_id=88, tag_id=101):
    db.execute(
        """
        INSERT INTO works (remote, remote_gallery_id, title, source, page_count)
        VALUES ('nhentai', ?, 'Remote Work', 'remote', 12)
        """,
        (gallery_id,),
    )
    db.execute(
        """
        INSERT INTO remote_galleries (gallery_id, media_id, payload_json)
        VALUES (?, 'media', ?)
        """,
        (
            gallery_id,
            json.dumps(
                {
                    "id": gallery_id,
                    "tags": [{"id": tag_id, "type": "tag", "name": "snowmelt", "slug": "snowmelt"}],
                }
            ),
        ),
    )


def insert_work_tag(db, work_id=1, remote_tag_id=101, name="snowmelt", tag_type="tag"):
    db.execute(
        """
        INSERT INTO work_tags (work_id, remote_tag_id, tag_type, remote_name, remote_slug)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(work_id, remote_tag_id) DO UPDATE SET remote_name = excluded.remote_name
        """,
        (work_id, remote_tag_id, tag_type, name, name),
    )


def test_dictionary_autocomplete_uses_local_alias_cached_remote_and_remote_search(tmp_path):
    db, client, service = make_service(tmp_path)
    insert_remote_tag(db)
    service.apply(
        {
            "original_text": "snowmelt",
            "zh_name": "雪融",
            "tag_type": "tag",
            "remote_tag_id": 101,
            "aliases": ["融雪"],
        }
    )

    local = service.autocomplete("融", limit=10)
    remote = service.autocomplete("winter", limit=10)

    assert local["result"][0]["display"] == "雪融"
    assert local["result"][0]["source"] in {"dictionary", "alias"}
    assert any(item["id"] == 101 and item["display"] == "雪融" for item in service.autocomplete("snow", 10)["result"])
    assert client.calls == [("tag_search", "winter", 10)]
    assert any(item["id"] == 202 and item["source"] == "remote" for item in remote["result"])
    assert db.fetchone("SELECT remote_id FROM remote_tags WHERE remote_id = ?", (202,)) is not None


def test_dictionary_preview_apply_does_not_write_then_apply_updates_work_tags(tmp_path):
    db, _client, service = make_service(tmp_path)
    insert_remote_tag(db)
    insert_remote_work(db)

    payload = {
        "original_text": "snowmelt",
        "zh_name": "雪融",
        "tag_type": "tag",
        "remote_tag_id": 101,
        "aliases": ["融雪"],
    }
    preview = service.preview_apply(payload)

    assert preview["writes"] is False
    assert preview["impact"]["work_count"] == 1
    assert db.fetchone("SELECT id FROM local_tag_dictionary WHERE zh_name = ?", ("雪融",)) is None

    applied = service.apply(payload)
    link = db.fetchone("SELECT work_id, remote_tag_id, dictionary_id FROM work_tags WHERE remote_tag_id = ?", (101,))

    assert applied["dictionary"]["zh_name"] == "雪融"
    assert applied["impact"]["work_count"] == 1
    assert link is not None
    assert link["dictionary_id"] == applied["dictionary"]["id"]


def test_dictionary_bulk_import_previews_conflicts_and_imports_valid_rows(tmp_path):
    db, _client, service = make_service(tmp_path)
    service.apply({"original_text": "snowmelt", "zh_name": "雪融", "tag_type": "tag"})

    rows = [
        {"original_text": "snowmelt", "zh_name": "雪融新", "tag_type": "tag", "aliases": ["snow"]},
        {"original_text": "blue reverie", "zh_name": "蓝色遐想", "tag_type": "tag", "aliases": ["蓝想"]},
        {"original_text": "", "zh_name": "缺原词", "tag_type": "tag"},
    ]
    preview = service.preview_bulk_import(rows)
    imported = service.bulk_import(rows)

    assert preview["summary"] == {"valid": 1, "duplicate": 1, "conflict": 0, "invalid": 1}
    assert imported["summary"]["imported"] == 1
    assert db.fetchone("SELECT id FROM local_tag_dictionary WHERE zh_name = ?", ("蓝色遐想",)) is not None


def test_dictionary_links_imported_work_to_real_gallery_tags(tmp_path):
    db, _client, service = make_service(tmp_path)
    insert_remote_tag(db)
    db.execute(
        """
        INSERT INTO works (id, remote, remote_gallery_id, title, source, page_count)
        VALUES (7, 'nhentai', 88, 'Remote Work', 'remote', 12)
        """
    )
    service.apply({"original_text": "snowmelt", "zh_name": "雪融", "tag_type": "tag", "remote_tag_id": 101})

    service.link_work_tags(7, [{"id": 101, "type": "tag", "name": "snowmelt", "slug": "snowmelt"}])

    link = db.fetchone("SELECT work_id, remote_tag_id, dictionary_id FROM work_tags WHERE work_id = 7")
    assert link["remote_tag_id"] == 101
    assert link["dictionary_id"] is not None


def test_dictionary_summary_candidates_evidence_and_status_actions_use_real_rows(tmp_path):
    db, _client, service = make_service(tmp_path)
    insert_remote_tag(db)
    insert_remote_tag(db, remote_id=102, name="winter")
    insert_remote_work(db, gallery_id=88, tag_id=101)
    insert_work_tag(db, work_id=1, remote_tag_id=101)
    insert_work_tag(db, work_id=1, remote_tag_id=102, name="winter")
    configured = service.apply(
        {
            "original_text": "snowmelt",
            "zh_name": "雪融",
            "tag_type": "tag",
            "remote_tag_id": 101,
            "aliases": ["融雪"],
        }
    )

    service.mark_review(configured["dictionary"]["id"])
    summary = service.summary()
    candidates = service.candidates(limit=10)["result"]
    evidence = service.evidence(remote_tag_id=101, dictionary_id=configured["dictionary"]["id"])
    service.ignore(configured["dictionary"]["id"])
    ignored_summary = service.summary()

    snow = next(item for item in candidates if item["id"] == 101)
    assert summary["configured"] == 1
    assert summary["review"] == 1
    assert summary["unconfigured"] == 1
    assert snow["impact_work_count"] == 1
    assert snow["configured"] is True
    assert evidence["remote_tag"]["id"] == 101
    assert evidence["related_works"][0]["id"] == 1
    assert evidence["co_tags"][0]["id"] == 102
    assert evidence["history"][0]["status"] == "review"
    assert ignored_summary["ignored"] == 1


def test_dictionary_preview_shape_and_bulk_import_conflicts_are_explicit(tmp_path):
    db, _client, service = make_service(tmp_path)
    insert_remote_tag(db)
    insert_remote_work(db, gallery_id=88, tag_id=101)
    service.apply({"original_text": "snowmelt", "zh_name": "雪融", "tag_type": "tag", "remote_tag_id": 101})

    preview = service.preview_apply(
        {"original_text": "snowmelt", "zh_name": "雪融新", "tag_type": "tag", "remote_tag_id": 101, "aliases": ["融雪"]}
    )
    bulk = service.preview_bulk_import(
        [
            {"original_text": "snowmelt", "zh_name": "雪融新", "tag_type": "tag"},
            {"original_text": "blue reverie", "zh_name": "蓝色遐想", "tag_type": "tag"},
            {"original_text": "alias-only", "zh_name": "", "tag_type": "tag"},
        ]
    )

    assert preview["writes"] is False
    assert preview["will_update_tags"] == 1
    assert preview["will_update_works"] == 1
    assert preview["ignored"] == 0
    assert preview["samples"][0]["id"] == 1
    assert bulk["summary"] == {"valid": 1, "duplicate": 1, "conflict": 0, "invalid": 1}
    assert [row["status"] for row in bulk["rows"]] == ["duplicate", "valid", "invalid"]


def test_database_migrates_legacy_dictionary_tables_without_dropping_data(tmp_path):
    path = tmp_path / "archive.db"
    with sqlite3.connect(path) as conn:
        conn.executescript(
            """
            CREATE TABLE remote_tags (
              remote_id INTEGER PRIMARY KEY,
              type TEXT,
              name TEXT,
              slug TEXT,
              payload_json TEXT NOT NULL,
              cached_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE works (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              remote TEXT,
              remote_gallery_id INTEGER UNIQUE,
              media_id TEXT,
              title TEXT NOT NULL,
              title_japanese TEXT,
              pretty_title TEXT,
              source TEXT NOT NULL,
              language TEXT,
              page_count INTEGER NOT NULL DEFAULT 0,
              cover_path TEXT,
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE local_tag_dictionary (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              remote_tag_id INTEGER,
              type TEXT NOT NULL,
              source_text TEXT NOT NULL,
              display_zh TEXT NOT NULL,
              confidence REAL NOT NULL DEFAULT 1.0,
              locked INTEGER NOT NULL DEFAULT 0,
              ignored INTEGER NOT NULL DEFAULT 0,
              note TEXT,
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(type, source_text)
            );
            CREATE TABLE tag_aliases (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              dictionary_id INTEGER NOT NULL,
              alias TEXT NOT NULL,
              lang TEXT NOT NULL DEFAULT 'zh',
              normalized TEXT NOT NULL,
              UNIQUE(dictionary_id, normalized)
            );
            CREATE TABLE work_tags (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              work_id INTEGER NOT NULL,
              remote_tag_id INTEGER,
              type TEXT NOT NULL,
              source_text TEXT NOT NULL,
              display_zh TEXT,
              confirmed INTEGER NOT NULL DEFAULT 0,
              confidence REAL NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(work_id, type, source_text)
            );
            INSERT INTO remote_tags (remote_id, type, name, slug, payload_json)
            VALUES (101, 'tag', 'snowmelt', 'snowmelt', '{}');
            INSERT INTO works (id, remote, remote_gallery_id, title, source, page_count)
            VALUES (7, 'nhentai', 88, 'Remote Work', 'remote', 12);
            INSERT INTO local_tag_dictionary (id, remote_tag_id, type, source_text, display_zh, confidence)
            VALUES (3, 101, 'tag', 'snowmelt', '雪融', 0.86);
            INSERT INTO tag_aliases (dictionary_id, alias, normalized)
            VALUES (3, '融雪', '融雪');
            INSERT INTO work_tags (work_id, remote_tag_id, type, source_text, display_zh)
            VALUES (7, 101, 'tag', 'snowmelt', '雪融');
            """
        )

    db = Database(path)
    db.init_schema()
    service = DictionaryService(db, FakeDictionaryClient())
    discover = DiscoverService(db, FakeDictionaryClient())

    assert service.candidates(limit=10)["result"][0]["display"] == "雪融"
    assert service.autocomplete("融", limit=10)["result"][0]["display"] == "雪融"
    assert discover.cached_tags(10)["result"][0]["display"] == "雪融"
    assert db.fetchone("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'local_tag_dictionary_legacy'") is not None
