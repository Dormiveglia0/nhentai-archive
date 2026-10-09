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
