import json
import smtplib
import threading

import pytest

from app.database import Database
from app.services.discover_service import DiscoverService
from app.services.nhentai_client import NhentaiApiError
from app.services.notification_service import NotificationService
from app.services.subscription_service import SubscriptionService


class Client:
    api_key = "unit-test"
    timeout = 10

    def __init__(self):
        self.pages = {1: []}
        self.calls = []

    def tags_by_ids(self, ids, fresh=False):
        assert fresh
        return [{"id": tag_id, "type": "artist" if tag_id == 10 else "group", "name": "Creator", "slug": "creator"} for tag_id in ids]

    def tagged(self, tag_id, page, per_page, sort, fresh):
        self.calls.append((tag_id, page, per_page, sort, fresh))
        value = self.pages[page]
        if isinstance(value, Exception):
            raise value
        return {"result": [{"id": item, "english_title": "Work " + str(item), "tag_ids": [tag_id]} for item in value], "num_pages": len(self.pages)}

    def media_proxy_url(self, path, thumbnail=False):
        return None


def _services(tmp_path):
    db = Database(tmp_path / "archive.db")
    db.init_schema()
    client = Client()
    notifications = NotificationService(db)
    discover = DiscoverService(db, client)
    service = SubscriptionService(db, client, discover, notifications)
    return db, client, notifications, service


def smtp_config():
    return {"enabled": True, "host": "127.0.0.1", "port": 8025, "security": "none", "sender": "qa@localhost", "recipient": "receiver@localhost"}


def test_baseline_resumes_and_new_page_overlap_does_not_hide_updates(tmp_path):
    db, client, notifications, service = _services(tmp_path)
    notifications.configure(smtp_config())
    with pytest.raises(ValueError, match="类型不匹配"):
        service.subscribe(20, "artist")
    artist = service.subscribe(10, "artist")
    group = service.subscribe(20, "group")
    assert artist["tag_type"] != group["tag_type"]
    service.update(group["id"], {"enabled": False})
    client.pages = {1: [10], 2: [9], 3: [8], 4: [7]}
    service.tick()
    assert service.get(artist["id"])["scan_page"] == 4
    assert not service.get(artist["id"])["baseline_complete"]
    assert not service.updates()["result"] and not notifications.outbox()["result"]
    restarted = SubscriptionService(db, client, service.discover, notifications)
    db.execute("UPDATE creator_subscriptions SET next_check_at = 0 WHERE id = ?", (artist["id"],))
    restarted.tick()
    assert restarted.get(artist["id"])["baseline_complete"]
    assert client.calls[-1][1] == 4
    assert all(call[2:] == (100, "date", True) for call in client.calls)
    assert service.list()["result"][0]["seen_count"] == 4

    client.pages = {1: [50, 51], 2: [50, 52], 3: [53, 10], 4: [9]}
    restarted.check_now(artist["id"])
    restarted.tick()
    updates = restarted.updates()
    assert {row["gallery_id"] for row in updates["result"]} == {50, 51, 52, 53}
    assert updates["unread_count"] == 4
    assert len(notifications.outbox()["result"]) == 1
    assert client.calls[-1][1] == 3
    restarted.check_now(artist["id"])
    restarted.tick()
    assert restarted.updates()["total"] == 4 and len(notifications.outbox()["result"]) == 1
    restarted.mark_read(updates["result"][0]["id"])
    assert restarted.updates(unread_only=True)["total"] == 3
    restarted.mark_read()
    assert restarted.updates()["unread_count"] == 0


def test_rate_limit_and_crash_claim_keep_the_cursor_without_historical_notifications(tmp_path):
    db, client, notifications, service = _services(tmp_path)
    subscription = service.subscribe(10, "artist")
    client.pages = {1: [4], 2: NhentaiApiError(429, "rate_limited", "quota", retry_after=90), 3: [2]}
    service.tick()
    row = service.get(subscription["id"])
    assert row["scan_page"] == 2 and row["status"] == "error"
    assert row["next_check_at"] > 0 and not row["baseline_complete"]
    assert not service.updates()["result"]
    resumed = SubscriptionService(db, client, service.discover, notifications)
    client.pages[2] = [3]
    db.execute("UPDATE creator_subscriptions SET next_check_at = 0 WHERE id = ?", (subscription["id"],))
    claim = resumed._claim()
    assert claim["scan_page"] == 2
    assert service._claim() is None
    db.execute("UPDATE creator_subscriptions SET check_lease_until = 0 WHERE id = ?", (subscription["id"],))
    resumed.tick()
    assert resumed.get(subscription["id"])["baseline_complete"]
    assert not resumed.updates()["result"]
    # A delayed response from the old claim cannot write after lease recovery.
    assert not service._page(claim, {"result": [{"id": 99}], "num_pages": 3})
    assert db.fetchone("SELECT COUNT(*) AS n FROM subscription_seen")["n"] == 3


def test_unsubscribe_during_remote_request_rejects_late_updates_and_mail(tmp_path):
    db, client, notifications, service = _services(tmp_path)
    notifications.configure(smtp_config())
    subscription = service.subscribe(10, "artist")
    client.pages = {1: [1]}
    service.tick()
    requested, release = threading.Event(), threading.Event()
    original = client.tagged

    def delayed(*args, **kwargs):
        result = original(*args, **kwargs)
        requested.set()
        assert release.wait(3)
        return result

    client.pages = {1: [2, 1]}
    client.tagged = delayed
    service.check_now(subscription["id"])
    thread = threading.Thread(target=service.tick)
    thread.start()
    try:
        assert requested.wait(3)
        service.remove(subscription["id"])
    finally:
        release.set()
        thread.join(3)
    assert not thread.is_alive()
    assert not service.updates()["result"] and not notifications.outbox()["result"]
    client.tagged = original
    subscribed_again = service.subscribe(10, "artist")
    assert subscribed_again["id"] == subscription["id"] and not subscribed_again["baseline_complete"]
    service.tick()
    assert not service.updates()["result"]


def test_smtp_config_masks_secrets_and_stdlib_transport_uses_selected_security(tmp_path, monkeypatch):
    _db, _client, notifications, _service = _services(tmp_path)
    _db.execute("INSERT INTO works(title, source, page_count) VALUES ('Test archive', 'local', 1)")
    calls = []

    class SMTP:
        def __init__(self, host, port, **options):
            calls.append((host, port, options))
        def __enter__(self):
            return self
        def __exit__(self, *args):
            pass
        def starttls(self, **kwargs):
            calls.append(("starttls", kwargs))
        def login(self, username, password):
            assert username == "user" and password == "private-test-secret"
        def send_message(self, message):
            assert message["To"] == "receiver@localhost"
            assert message["Message-ID"]
            assert "private-test-secret" not in message.as_string()
            assert message.get_body(preferencelist=("html",)) is not None
            calls.append(("sent", message["Subject"]))
            return {}

    monkeypatch.setattr(smtplib, "SMTP", SMTP)
    monkeypatch.setattr(smtplib, "SMTP_SSL", SMTP)
    public = notifications.configure({**smtp_config(), "username": "user", "password": "private-test-secret"})
    assert public["password_configured"] and "password" not in public
    assert "private-test-secret" not in json.dumps(public)
    notifications.configure({"password": ""})
    assert notifications.public_config()["password_configured"]
    for security in ("none", "starttls", "ssl"):
        notifications.configure({"security": security})
        assert notifications.test()["ok"]
    assert sum(call[0] == "starttls" for call in calls) == 1
    assert any("context" in call[2] for call in calls if call[0] == "127.0.0.1")
    for bad in ({"security": []}, {"recipient": "receiver@localhost\nBcc:x@y"}, {"sender": "invalid"}, {"port": True}, {"site_url": "https://user:pass@localhost"}):
        with pytest.raises(ValueError):
            notifications.configure(bad)
    notifications.configure({"enabled": False, "clear_password": True})
    assert not notifications.public_config()["password_configured"]


def test_notification_embeds_cover_escapes_metadata_and_uses_day_intervals(tmp_path):
    from PIL import Image
    db, client, notifications, service = _services(tmp_path)
    subscription = service.subscribe(10, "artist")
    assert subscription["interval_seconds"] == 86400
    for days in (1, 3, 7):
        assert service.update(subscription["id"], {"interval_seconds": days * 86400})["interval_seconds"] == days * 86400
    with pytest.raises(ValueError):
        service.update(subscription["id"], {"interval_seconds": 3600})
    (tmp_path / "covers").mkdir()
    Image.new("RGB", (20, 30), "white").save(tmp_path / "covers" / "unit.jpg")
    message = notifications._message({"subject": "作品更新", "galleries": [{"work_id": 1, "title": '<script>alert("x")</script>', "num_pages": 3,
        "cover_path": "covers/unit.jpg", "tags": [{"type": "artist", "name": "A&B"}]}]}, "<unit@localhost>", {**smtp_config(), "site_url": "http://localhost"})
    html = message.get_body(preferencelist=("html",)).get_content()
    assert "<script>" not in html and "&lt;script&gt;" in html and "A&amp;B" in html
    assert "cid:work-cover-0@nh-archive.local" in html and "/#reader/1" in html and "3 页" in html
    assert [part.get_content_type() for part in message.walk()].count("image/jpeg") == 1
    assert "A&B" in message.get_body(preferencelist=("plain",)).get_content()


def test_mail_outbox_retries_same_message_and_never_resends_sent_updates(tmp_path, monkeypatch):
    db, client, notifications, service = _services(tmp_path)
    notifications.configure(smtp_config())
    subscription = service.subscribe(10, "artist")
    client.pages = {1: [1]}
    service.tick()
    client.pages = {1: [2, 1]}
    service.check_now(subscription["id"])
    service.tick()
    message_ids = []

    def send(payload, message_id, config):
        assert len(payload["galleries"]) == 1
        message_ids.append(message_id)
        if len(message_ids) == 1:
            raise TimeoutError("private-test-secret")

    monkeypatch.setattr(notifications, "_send", send)
    notifications.tick()
    failed = notifications.outbox()["result"][0]
    assert failed["status"] == "pending" and failed["attempts"] == 1
    assert "private-test-secret" not in failed["last_error"]
    restarted = NotificationService(db)
    monkeypatch.setattr(restarted, "_send", send)
    db.execute("UPDATE mail_outbox SET next_attempt_at = 0")
    restarted.tick()
    assert restarted.outbox()["result"][0]["status"] == "sent"
    assert message_ids[0] == message_ids[1]
    restarted.tick()
    assert len(message_ids) == 2
    with pytest.raises(ValueError):
        restarted.retry(failed["id"])
    assert not db.fetchall("PRAGMA foreign_key_check")


def test_recent_previews_fold_only_matching_original_titles_and_shared_updates_read_together(tmp_path):
    db, client, notifications, service = _services(tmp_path)
    artist = service.subscribe(10, "artist")
    group = service.subscribe(20, "group")
    service.tick(); service.tick()
    assert service.updates()["total"] == 0
    items = [
        {"id": 4, "japanese_title": "作品 第二巻", "english_title": "Volume 2"},
        {"id": 2, "japanese_title": "作品 第一巻", "english_title": "Volume 1"},
        {"id": 3, "japanese_title": "作品　第一巻", "english_title": "Volume 1 English"},
        {"id": 5, "english_title": "Unknown original A"},
        {"id": 6, "english_title": "Unknown original B"},
    ]
    client.tagged = lambda *args, **kwargs: {"result": items, "num_pages": 1}
    work_id = db.execute("INSERT INTO works(title, source, remote_gallery_id) VALUES ('Volume 1', 'remote', 2)").lastrowid
    for subscription in (artist, group):
        service.check_now(subscription["id"]); service.tick()
        preview = service.get(subscription["id"])
        assert [item["gallery_id"] for item in preview["recent_galleries"]] == [4, 2, 5, 6]
        assert preview["recent_galleries"][1]["work_id"] == work_id
        assert "recent_json" not in preview and "claim_token" not in preview
    updates = service.updates()
    assert updates["total"] == updates["unread_count"] == 5
    update = next(item for item in updates["result"] if item["gallery_id"] == 2)
    service.mark_read(update["id"])
    assert service.updates(unread_only=True)["total"] == 4
    assert not db.fetchone("SELECT COUNT(*) AS n FROM subscription_updates WHERE gallery_id = 2 AND read_at IS NULL")["n"]
    db.execute("UPDATE creator_subscriptions SET recent_json = 'broken'")
    assert all(not item["recent_galleries"] for item in service.list()["result"])
    assert not db.fetchall("PRAGMA foreign_key_check")


def test_subscription_preview_upgrade_is_idempotent_and_preserves_existing_state(tmp_path):
    db, client, _notifications, service = _services(tmp_path)
    artist = service.subscribe(10, "artist")
    paused = service.subscribe(20, "group")
    client.pages = {1: [1]}
    service.tick(); service.tick()
    service.update(paused["id"], {"enabled": False})
    work_id = db.execute("INSERT INTO works(title, source, favorite) VALUES ('Archive', 'local', 1)").lastrowid
    db.execute("INSERT INTO reader_progress(work_id, page_index, page_count, progress_percent) VALUES (?, 2, 4, 50)", (work_id,))
    before_seen = db.fetchall("SELECT * FROM subscription_seen")
    before_paused = db.fetchone("SELECT * FROM creator_subscriptions WHERE id = ?", (paused["id"],))
    db.execute("ALTER TABLE creator_subscriptions DROP COLUMN recent_json")
    db.init_schema()
    upgraded = db.fetchone("SELECT * FROM creator_subscriptions WHERE id = ?", (artist["id"],))
    assert upgraded["recent_json"] == "[]" and upgraded["baseline_complete"]
    assert upgraded["scan_page"] == 1 and upgraded["next_check_at"] == 0 and upgraded["claim_token"] is None
    db.init_schema()
    assert db.fetchone("SELECT * FROM creator_subscriptions WHERE id = ?", (artist["id"],)) == upgraded
    after_paused = db.fetchone("SELECT * FROM creator_subscriptions WHERE id = ?", (paused["id"],))
    assert {key: value for key, value in after_paused.items() if key != "recent_json"} == {key: value for key, value in before_paused.items() if key != "recent_json"}
    assert db.fetchall("SELECT * FROM subscription_seen") == before_seen
    assert db.fetchone("SELECT favorite FROM works WHERE id = ?", (work_id,))["favorite"] == 1
    assert db.fetchone("SELECT page_index FROM reader_progress WHERE work_id = ?", (work_id,))["page_index"] == 2
    service.tick()
    assert not service.updates()["result"]
    assert not db.fetchall("PRAGMA foreign_key_check")
