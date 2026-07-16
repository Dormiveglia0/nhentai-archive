import zipfile

from app.config import Settings
from app.database import Database
from app.services.dictionary_service import DictionaryService
from app.services.discover_service import DiscoverService
from app.services.metadata_refresh_service import MetadataRefreshService


class FakeClient:
    def __init__(self, galleries, search_results=None):
        self.galleries = galleries
        self.search_results = search_results or []
        self.calls = []

    def gallery(self, gallery_id, include=None, fresh=False):
        self.calls.append(("gallery", gallery_id, fresh))
        return self.galleries[gallery_id]

    def search(self, query, page, per_page, sort):
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
