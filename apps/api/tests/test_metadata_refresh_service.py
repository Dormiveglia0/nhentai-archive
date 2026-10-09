import zipfile
import json
import time

from app.config import Settings
from app.database import Database
from app.services.dictionary_service import DictionaryService
from app.services.discover_service import DiscoverService
from app.services.metadata_refresh_service import MetadataRefreshService
from app.services.library_service import LibraryService
from app.services.nhentai_client import NhentaiApiError


class FakeClient:
    def __init__(self, galleries, search_results=None):
        self.api_key = "test"
        self.galleries = galleries
        self.search_results = search_results or []
        self.calls = []

    def gallery(self, gallery_id, include=None, fresh=False):
        self.calls.append(("gallery", gallery_id, fresh))
        return self.galleries[gallery_id]

    def search(self, query, page, per_page, sort, fresh=False):
        self.calls.append(("search", query))
        return {"result": self.search_results}


def _service(tmp_path, galleries, search_results=None):
    settings = Settings(data_dir=tmp_path / "data", database_path=tmp_path / "data/archive.db")
    db = Database(settings.database_path)
    db.init_schema()
    client = FakeClient(galleries, search_results)
    discover = DiscoverService(db, client)
    dictionary = DictionaryService(db, client)
    return db, client, MetadataRefreshService(db, client, discover, dictionary)


def _work(db, title, page_count=10):
    cursor = db.execute(
        "INSERT INTO works (title, source, page_count) VALUES (?, 'local', ?)",
        (title, page_count),
    )
    return int(cursor.lastrowid)


def _gallery(gallery_id, title, page_count=10, tags=None):
    return {
        "id": gallery_id,
        "media_id": f"media-{gallery_id}",
        "title": {"english": title, "japanese": f"{title} JP", "pretty": f"{title} Pretty"},
        "num_pages": page_count,
        "tags": tags or [],
    }


def test_preview_uses_comicinfo_web_without_writing(tmp_path):
    gallery = _gallery(200, "Remote Work")
    db, _client, service = _service(tmp_path, {200: gallery})
    work_id = _work(db, "Local Work")
    cbz = tmp_path / "linked.cbz"
    with zipfile.ZipFile(cbz, "w") as archive:
        archive.writestr("001.jpg", b"image")
        archive.writestr("ComicInfo.xml", "<ComicInfo><Web>https://nhentai.net/g/200/</Web></ComicInfo>")
    db.execute(
        "INSERT INTO work_files (work_id, kind, path) VALUES (?, 'source_cbz', ?)",
        (work_id, str(cbz)),
    )

    result = service.preview([work_id])

    assert result["result"][0]["match"]["source"] == "web"
    assert result["result"][0]["match"]["eligible"] is True
    assert db.fetchone("SELECT remote_gallery_id FROM works WHERE id = ?", (work_id,))["remote_gallery_id"] is None


def test_fuzzy_preview_requires_unique_high_confidence_candidate(tmp_path):
    exact = _gallery(301, "Crystal Night", 24)
    other = _gallery(302, "Summer Afternoon", 24)
    db, _client, service = _service(tmp_path, {301: exact, 302: other}, [exact, other])
    work_id = _work(db, "Crystal Night", 24)

    safe = service.preview([work_id])["result"][0]["match"]
    assert safe["gallery_id"] == 301
    assert safe["confidence"] == 100
    assert safe["eligible"] is True

    ambiguous = _gallery(303, "Crystal Night", 24)
    service.client.search_results = [exact, ambiguous]
    blocked = service.preview([work_id])["result"][0]["match"]
    assert blocked["eligible"] is False
    assert "候选" in blocked["reason"]


def test_apply_refreshes_remote_titles_and_replaces_stale_tags(tmp_path):
    gallery = _gallery(400, "Fresh Title", 10, [{"id": 2, "type": "tag", "name": "new", "slug": "new"}])
    db, client, service = _service(tmp_path, {400: gallery})
    work_id = _work(db, "Old Title", 10)
    db.execute(
        "INSERT INTO remote_tags (remote_id, type, name, slug, payload_json) VALUES (1, 'tag', 'old', 'old', '{}')"
    )
    db.execute(
        "INSERT INTO work_tags (work_id, remote_tag_id, tag_type, remote_name) VALUES (?, 1, 'tag', 'old')",
        (work_id,),
    )
    db.execute(
        "INSERT INTO work_metadata (work_id, field, value, source) VALUES (?, 'title', '人工标题', 'manual')",
        (work_id,),
    )

    result = service.apply([{"work_id": work_id, "gallery_id": 400, "source": "manual_id"}])

    assert result["summary"] == {"works": 1, "updated": 1, "skipped": 0, "errors": 0}
    work = db.fetchone("SELECT * FROM works WHERE id = ?", (work_id,))
    assert (work["source"], work["remote_gallery_id"], work["title"]) == ("local", 400, "Fresh Title")
    assert db.fetchone("SELECT value FROM work_metadata WHERE work_id = ? AND field = 'title'", (work_id,))["value"] == "人工标题"
    assert [row["remote_tag_id"] for row in db.fetchall("SELECT remote_tag_id FROM work_tags WHERE work_id = ?", (work_id,))] == [2]
    assert ("gallery", 400, True) in client.calls


def test_apply_blocks_unconfirmed_fuzzy_match(tmp_path):
    gallery = _gallery(500, "Different Work", 10)
    db, _client, service = _service(tmp_path, {500: gallery})
    work_id = _work(db, "Local Original", 10)

    result = service.apply([{"work_id": work_id, "gallery_id": 500, "source": "fuzzy", "margin": 2}])

    assert result["summary"]["skipped"] == 1
    assert db.fetchone("SELECT remote_gallery_id FROM works WHERE id = ?", (work_id,))["remote_gallery_id"] is None


def test_apply_recomputes_fuzzy_candidate_margin(tmp_path):
    gallery = _gallery(501, "Crystal Night", 24)
    duplicate = _gallery(502, "Crystal Night", 24)
    db, _client, service = _service(tmp_path, {501: gallery}, [gallery, duplicate])
    work_id = _work(db, "Crystal Night", 24)

    result = service.apply([
        {"work_id": work_id, "gallery_id": 501, "source": "fuzzy", "confidence": 100, "margin": 100}
    ])

    assert result["summary"]["skipped"] == 1
    assert db.fetchone("SELECT remote_gallery_id FROM works WHERE id = ?", (work_id,))["remote_gallery_id"] is None


def test_apply_accepts_unique_fuzzy_candidate_after_server_recheck(tmp_path):
    gallery = _gallery(503, "Crystal Night", 24)
    db, _client, service = _service(tmp_path, {503: gallery}, [gallery])
    work_id = _work(db, "Crystal Night", 24)

    result = service.apply([{"work_id": work_id, "gallery_id": 503, "source": "fuzzy"}])

    assert result["summary"]["updated"] == 1
    assert db.fetchone("SELECT remote_gallery_id FROM works WHERE id = ?", (work_id,))["remote_gallery_id"] == 503


def _indexed_service(tmp_path, **config):
    from test_library_index import create_archive, setup_index
    settings, db, libraries, index, root, library = setup_index(tmp_path, **config)
    create_archive(root / "book.cbz", title="Crystal Night", tags="winter")
    index.scan(library["id"])
    item = db.fetchone("SELECT * FROM library_items WHERE library_id = ?", (library["id"],))
    tags = [{"id": 11, "type": "language", "name": "chinese", "slug": "chinese"},
            {"id": 12, "type": "artist", "name": "Writer", "slug": "writer"},
            {"id": 13, "type": "group", "name": "Circle", "slug": "circle"}]
    gallery = _gallery(600, "Crystal Night", 2, tags)
    client = FakeClient({600: gallery}, [gallery])
    service = MetadataRefreshService(db, client, DiscoverService(db, client), DictionaryService(db, client), libraries)
    return db, libraries, index, root, library, item, gallery, service


def test_indexed_preview_uses_snapshots_and_metadata_only_preserves_manual_fields(tmp_path, monkeypatch):
    db, _, _, _, _, item, _, service = _indexed_service(tmp_path, auto_bind=False)
    work_id = item["work_id"]
    db.execute("INSERT INTO work_metadata(work_id, field, value, source) VALUES (?, 'pretty_title', '人工标题', 'manual')", (work_id,))
    db.execute("UPDATE works SET favorite = 1 WHERE id = ?", (work_id,))
    original = db.fetchone("SELECT page_count, cover_path, source FROM works WHERE id = ?", (work_id,))
    monkeypatch.setattr("app.services.comicinfo.gallery_id_from_cbz", lambda *_: (_ for _ in ()).throw(AssertionError("source IO")))
    preview = service.preview([work_id], queries={work_id: "Crystal Night"})["result"][0]
    assert preview["match"]["eligible"] and preview["candidates"][0]["diffs"]
    assert any(row["protected"] for row in preview["match"]["diffs"])
    result = service.apply([{**preview["match"], "work_id": work_id, "version": preview["version"]}])
    assert result["summary"]["updated"] == 1
    work = db.fetchone("SELECT * FROM works WHERE id = ?", (work_id,))
    assert work["remote_gallery_id"] is None and work["metadata_gallery_id"] == 600 and work["favorite"] == 1
    assert all(work[key] == original[key] for key in original)
    assert LibraryService(db).work(work_id)["display_title"] == "人工标题"
    assert [tag["id"] for tag in LibraryService(db).work(work_id)["tags"] if tag["type"] == "artist"] == [12]
    assert db.fetchone("SELECT COUNT(*) AS n FROM work_tags WHERE work_id = ? AND source = 'comicinfo'", (work_id,))["n"] == 3
    assert db.fetchone("SELECT scrape_status FROM library_items WHERE id = ?", (item["id"],))["scrape_status"] == "completed"
    assert service.apply([{**preview["match"], "work_id": work_id, "version": preview["version"]}])["summary"]["skipped"] == 1


def test_strict_language_blocks_explicit_id_and_preferred_language_breaks_translation_tie(tmp_path):
    db, libraries, _, _, library, item, gallery, service = _indexed_service(tmp_path, language_mode="strict")
    japanese = {**gallery, "id": 601, "tags": [{"id": 14, "type": "language", "name": "japanese", "slug": "japanese"}]}
    service.client.galleries[601] = japanese
    preview = service.preview([item["work_id"]], gallery_ids={item["work_id"]: 601})["result"][0]
    assert not preview["match"]["eligible"] and "语言" in preview["reason"]
    assert service.apply([{"work_id": item["work_id"], "gallery_id": 601, "source": "manual_id"}])["summary"]["skipped"] == 1
    libraries.update(library["id"], {"config": {"language_mode": "prefer"}})
    service.client.search_results = [japanese, gallery]
    ranked = service.preview([item["work_id"]])["result"][0]["candidates"]
    assert ranked[0]["gallery_id"] == 600 and ranked[0]["eligible"]
    assert ranked[1]["gallery_id"] == 601 and not ranked[1]["automatic_eligible"]
    assert db.fetchone("SELECT remote_gallery_id FROM works WHERE id = ?", (item["work_id"],))["remote_gallery_id"] is None


def test_automatic_scrape_persists_review_requeues_setting_changes_and_applies_once(tmp_path):
    db, libraries, _, _, library, item, gallery, service = _indexed_service(tmp_path, auto_scrape=True, auto_bind=False)
    service.client.search_results = [gallery, {**gallery, "id": 602}]
    service.tick()
    assert db.fetchone("SELECT scrape_status FROM library_items WHERE id = ?", (item["id"],))["scrape_status"] == "review"
    calls = len(service.client.calls)
    service.tick()
    assert len(service.client.calls) == calls
    libraries.update(library["id"], {"config": {"auto_bind": True}})
    service.client.search_results = [gallery]
    service.tick()
    assert db.fetchone("SELECT remote_gallery_id FROM works WHERE id = ?", (item["work_id"],))["remote_gallery_id"] == 600
    assert db.fetchone("SELECT scrape_status FROM library_items WHERE id = ?", (item["id"],))["scrape_status"] == "completed"
    service.tick()
    assert db.fetchone("SELECT COUNT(*) AS n FROM jobs")["n"] == 0


def test_automatic_remote_failure_backoff_survives_service_restart(tmp_path, monkeypatch):
    db, _, _, _, _, item, _, service = _indexed_service(tmp_path, auto_scrape=True)
    def failed(*args, **kwargs):
        raise NhentaiApiError(429, "rate_limited", "wait", retry_after=120)
    monkeypatch.setattr(service.client, "search", failed)
    service.tick()
    row = db.fetchone("SELECT * FROM library_items WHERE id = ?", (item["id"],))
    assert row["scrape_status"] == "error" and row["scrape_retry_at"] >= time.time() + 119
    restarted = MetadataRefreshService(db, service.client, service.discover, service.dictionary, service.libraries)
    restarted.tick()
    assert db.fetchone("SELECT scrape_attempts FROM library_items WHERE id = ?", (item["id"],))["scrape_attempts"] == 1
    monkeypatch.undo()
    db.execute("UPDATE library_items SET scrape_retry_at = 0 WHERE id = ?", (item["id"],))
    restarted.tick()
    assert db.fetchone("SELECT scrape_status FROM library_items WHERE id = ?", (item["id"],))["scrape_status"] == "completed"


def test_metadata_apply_rejects_concurrent_manual_change_and_keeps_tags_atomic(tmp_path, monkeypatch):
    db, _, _, _, _, item, _, service = _indexed_service(tmp_path)
    original = service.client.gallery
    def changed(*args, **kwargs):
        result = original(*args, **kwargs)
        db.execute("INSERT OR REPLACE INTO work_metadata(work_id, field, value, source) VALUES (?, 'title', 'changed', 'manual')", (item["work_id"],))
        return result
    monkeypatch.setattr(service.client, "gallery", changed)
    result = service.apply([{"work_id": item["work_id"], "gallery_id": 600, "source": "manual_id"}])
    assert result["summary"]["skipped"] == 1
    assert db.fetchone("SELECT metadata_gallery_id FROM works WHERE id = ?", (item["work_id"],))["metadata_gallery_id"] is None
    assert not db.fetchone("SELECT 1 FROM work_tags WHERE source = 'remote'")


def test_source_change_during_auto_review_keeps_new_attempt_pending(tmp_path, monkeypatch):
    from test_library_index import create_archive
    db, _, index, root, library, item, _, service = _indexed_service(tmp_path, auto_scrape=True)
    def search(*args, **kwargs):
        create_archive(root / "book.cbz", title="Changed Title")
        index.scan(library["id"])
        return {"result": []}
    monkeypatch.setattr(service.client, "search", search)
    service.tick()
    row = db.fetchone("SELECT * FROM library_items WHERE id = ?", (item["id"],))
    assert row["scrape_status"] == "pending" and row["scrape_result_json"] is None
    assert json.loads(row["metadata_json"])["Title"] == "Changed Title"
