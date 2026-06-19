from app.config import Settings
from app.database import Database
from app.services.discover_service import DiscoverService, build_search_query
from app.services.nhentai_client import NhentaiClient
from app.services.settings_service import SettingsService


def test_settings_service_does_not_return_api_key_and_updates_runtime_client(tmp_path):
    settings = Settings(data_dir=tmp_path / "data", database_path=tmp_path / "data" / "archive.db")
    db = Database(settings.database_path)
    db.init_schema()
    client = NhentaiClient(settings.nhentai_base_url, settings.user_agent, None, settings.request_timeout)
    service = SettingsService(db, settings, client)

    payload = service.patch({"nhentai_api_key": "secret-key"})

    assert payload["nhentai"]["api_key_configured"] is True
    assert payload["nhentai"]["api_key_source"] == "db"
    assert "secret-key" not in str(payload)
    assert client.api_key == "secret-key"


def test_settings_service_reports_missing_key_without_verifying_remote(tmp_path):
    settings = Settings(data_dir=tmp_path / "data", database_path=tmp_path / "data" / "archive.db")
    db = Database(settings.database_path)
    db.init_schema()
    client = NhentaiClient(settings.nhentai_base_url, settings.user_agent, None, settings.request_timeout)
    service = SettingsService(db, settings, client)

    result = service.verify_nhentai()

    assert result["configured"] is False
    assert result["ok"] is False
    assert result["message"] == "NH API Key 未配置"
    assert service.get()["nhentai"]["last_verify"]["message"] == "NH API Key 未配置"


def test_settings_service_persists_export_directory(tmp_path):
    settings = Settings(data_dir=tmp_path / "data", database_path=tmp_path / "data" / "archive.db")
    db = Database(settings.database_path)
    db.init_schema()
    client = NhentaiClient(settings.nhentai_base_url, settings.user_agent, None, settings.request_timeout)
    service = SettingsService(db, settings, client)
    export_dir = tmp_path / "custom-exports"

    payload = service.patch({"storage": {"export_dir": str(export_dir)}})

    assert payload["storage"]["export_dir"] == str(export_dir)
    assert export_dir.exists()


def test_settings_service_persists_export_presets(tmp_path):
    settings = Settings(data_dir=tmp_path / "data", database_path=tmp_path / "data" / "archive.db")
    db = Database(settings.database_path)
    db.init_schema()
    client = NhentaiClient(settings.nhentai_base_url, settings.user_agent, None, settings.request_timeout)
    service = SettingsService(db, settings, client)

    initial = service.get()
    assert initial["export"]["active_preset_id"] == "default-v2"
    assert initial["export"]["presets"][0]["name"] == "默认预设 v2"

    payload = service.patch(
        {
            "export": {
                "active_preset_id": "archive-light",
                "presets": [
                    {
                        "id": "archive-light",
                        "name": "轻量导出 v1",
                        "naming_rule": "{title}",
                        "comicinfo_rule": "完整写入",
                        "meta_rule": "保留原文件",
                        "compression": "ZIP - 最佳压缩",
                    }
                ],
            }
        }
    )

    assert payload["export"]["active_preset_id"] == "archive-light"
    assert payload["export"]["presets"][0]["name"] == "轻量导出 v1"
    assert service.get()["export"]["presets"][0]["naming_rule"] == "{title}"


def test_discover_search_query_adds_real_remote_filters():
    query = build_search_query("snow", language="japanese", kind="manga")

    assert query == 'snow language:japanese tag:"manga"'


class FakeDiscoverClient:
    def __init__(self):
        self.calls = []

    def latest(self, page, per_page):
        self.calls.append(("latest", page, per_page))
        return {"result": [], "num_pages": 20000, "per_page": per_page, "total": 480000}

    def search(self, query, page, per_page, sort):
        self.calls.append(("search", query, page, per_page, sort))
        return {"result": [], "num_pages": 10, "per_page": per_page, "total": 240}

    def tagged(self, tag_id, page, per_page, sort):
        self.calls.append(("tagged", tag_id, page, per_page, sort))
        return {"result": [], "num_pages": 3, "per_page": per_page, "total": 60}

    def media_url(self, path, thumbnail=False):
        return f"https://cdn.example/{path}" if path else None

    def tags_by_ids(self, ids):
        return []

    def gallery(self, gallery_id, include=None):
        self.calls.append(("gallery", gallery_id, include))
        return {
            "id": gallery_id,
            "media_id": "media",
            "title": {"english": "Remote title", "japanese": "リモート"},
            "thumbnail": {"path": "thumb.jpg"},
            "cover": {"path": "cover.jpg"},
            "tags": [{"id": 77, "type": "tag", "name": "schoolgirl", "slug": "schoolgirl"}],
            "pages": [{"path": "001.jpg", "width": 1000, "height": 1400}],
            "num_pages": 1,
            "num_favorites": 0,
            "related": [],
        }


def test_discover_feed_defaults_to_current_latest_page_only(tmp_path):
    settings = Settings(data_dir=tmp_path / "data", database_path=tmp_path / "data" / "archive.db")
    db = Database(settings.database_path)
    db.init_schema()
    client = FakeDiscoverClient()
    service = DiscoverService(db, client)

    payload = service.feed(page=7, per_page=24)

    assert client.calls == [("latest", 7, 24)]
    assert payload["num_pages"] == 20000
    assert payload["result"] == []


def test_discover_feed_uses_search_for_sort_without_loading_all_pages(tmp_path):
    settings = Settings(data_dir=tmp_path / "data", database_path=tmp_path / "data" / "archive.db")
    db = Database(settings.database_path)
    db.init_schema()
    client = FakeDiscoverClient()
    service = DiscoverService(db, client)

    service.feed(page=2, per_page=24, sort="popular")

    assert client.calls == [("search", "pages:>0", 2, 24, "popular")]


def test_discover_feed_uses_search_for_multiple_tags(tmp_path):
    settings = Settings(data_dir=tmp_path / "data", database_path=tmp_path / "data" / "archive.db")
    db = Database(settings.database_path)
    db.init_schema()
    client = FakeDiscoverClient()
    service = DiscoverService(db, client)

    service.feed(page=1, per_page=24, tag_id=10, tag_names="artist name,series name")

    assert client.calls == [("search", 'tag:"artist name" tag:"series name"', 1, 24, "date")]


def test_discover_tagged_passes_real_tag_parameters(tmp_path):
    settings = Settings(data_dir=tmp_path / "data", database_path=tmp_path / "data" / "archive.db")
    db = Database(settings.database_path)
    db.init_schema()
    client = FakeDiscoverClient()
    service = DiscoverService(db, client)

    payload = service.tagged(tag_id=123, page=4, per_page=20, sort="popular-week")

    assert client.calls == [("tagged", 123, 4, 20, "popular-week")]
    assert payload["source"] == "tagged"


def test_discover_gallery_maps_remote_page_urls(tmp_path):
    settings = Settings(data_dir=tmp_path / "data", database_path=tmp_path / "data" / "archive.db")
    db = Database(settings.database_path)
    db.init_schema()
    client = FakeDiscoverClient()
    service = DiscoverService(db, client)

    payload = service.gallery(321)

    assert client.calls == [("gallery", 321, "related")]
    assert payload["pages"][0]["url"] == "https://cdn.example/001.jpg"
    assert payload["pages"][0]["path"] == "001.jpg"


def test_discover_gallery_tags_use_dictionary_display_without_losing_remote_query_fields(tmp_path):
    settings = Settings(data_dir=tmp_path / "data", database_path=tmp_path / "data" / "archive.db")
    db = Database(settings.database_path)
    db.init_schema()
    db.execute(
        """
        INSERT INTO remote_tags (remote_id, type, name, slug, payload_json)
        VALUES (77, 'tag', 'schoolgirl', 'schoolgirl', '{}')
        """
    )
    db.execute(
        """
        INSERT INTO local_tag_dictionary (original_text, normalized_key, zh_name, tag_type, remote_tag_id)
        VALUES ('schoolgirl', 'schoolgirl', '女学生', 'tag', 77)
        """
    )
    client = FakeDiscoverClient()
    service = DiscoverService(db, client)

    payload = service.gallery(321)

    assert payload["tags"][0]["display"] == "女学生"
    assert payload["tags"][0]["name"] == "schoolgirl"
    assert payload["tags"][0]["slug"] == "schoolgirl"
