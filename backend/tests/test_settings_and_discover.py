from app.config import Settings
from app.database import Database
from app.services.discover_service import build_search_query
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


def test_discover_search_query_adds_real_remote_filters():
    query = build_search_query("snow", language="japanese", kind="artist-cg")

    assert query == 'snow language:japanese tag:"artist cg"'
