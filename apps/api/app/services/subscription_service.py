from __future__ import annotations

import json
import logging
import threading
import time
import uuid
from typing import Any

from app.database import Database
from app.services.discover_service import DiscoverService
from app.services.nhentai_client import NhentaiApiError, NhentaiClient, map_gallery_summary
from app.services.notification_service import NotificationService


class SubscriptionService:
    def __init__(self, db: Database, client: NhentaiClient, discover: DiscoverService, notifications: NotificationService):
        self.db, self.client, self.discover, self.notifications = db, client, discover, notifications
        self._lock = threading.Lock()
        self._closing = threading.Event()
        self._thread = None
        self._retry_at = 0

    def list(self):
        rows = self.db.fetchall("""WITH updates AS (
          SELECT subscription_id, SUM(read_at IS NULL) AS unread_count FROM subscription_updates GROUP BY subscription_id
        ) SELECT s.*, COALESCE(u.unread_count, 0) AS unread_count,
          (SELECT COUNT(*) FROM subscription_seen v WHERE v.subscription_id = s.id) AS seen_count
          FROM creator_subscriptions s LEFT JOIN updates u ON u.subscription_id = s.id
          WHERE removed_at IS NULL ORDER BY s.tag_type, s.name""")
        return {"result": [self._public(row) for row in rows]}

    def get(self, subscription_id):
        row = self.db.fetchone("SELECT * FROM creator_subscriptions WHERE id = ? AND removed_at IS NULL", (subscription_id,))
        if not row:
            raise ValueError("订阅不存在")
        return self._public(row)

    @staticmethod
    def _interval(value):
        if isinstance(value, bool) or not isinstance(value, int) or value not in {86400, 259200, 604800}:
            raise ValueError("检查间隔请选择1、3或7天")
        return value

    def subscribe(self, remote_tag_id: int, tag_type: str, interval_seconds=86400, email_enabled=True):
        if tag_type not in {"artist", "group"} or isinstance(remote_tag_id, bool) or not isinstance(remote_tag_id, int) or remote_tag_id <= 0:
            raise ValueError("订阅需要真实的作者或社团标签ID")
        self._interval(interval_seconds)
        if not isinstance(email_enabled, bool):
            raise ValueError("邮件通知须为开关")
        tags = self.client.tags_by_ids([remote_tag_id], fresh=True)
        if not isinstance(tags, list) or any(not isinstance(tag, dict) for tag in tags):
            raise ValueError("远端标签资料不完整")
        tag = next((tag for tag in tags if tag.get("id") == remote_tag_id and tag.get("type") == tag_type), None)
        if not tag:
            raise ValueError("远端标签不存在或作者/社团类型不匹配")
        name, slug = tag.get("name"), tag.get("slug") or tag.get("name")
        if not isinstance(name, str) or not name or not isinstance(slug, str):
            raise ValueError("远端标签资料不完整")
        self.discover.cache_tag(tag)
        with self.db.connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            existing = conn.execute("SELECT * FROM creator_subscriptions WHERE remote_tag_id = ? AND tag_type = ?", (remote_tag_id, tag_type)).fetchone()
            if existing and not existing["removed_at"]:
                subscription_id = existing["id"]
                if not existing["enabled"]:
                    conn.execute("UPDATE creator_subscriptions SET enabled = 1, revision = revision + 1, status = 'queued', next_check_at = 0, "
                                 "claim_token = NULL, check_lease_until = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (subscription_id,))
            else:
                row = conn.execute("""INSERT INTO creator_subscriptions(remote_tag_id, tag_type, name, slug, interval_seconds, email_enabled)
                  VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(tag_type, remote_tag_id) DO UPDATE SET name = excluded.name, slug = excluded.slug,
                  interval_seconds = excluded.interval_seconds, email_enabled = excluded.email_enabled, enabled = 1, removed_at = NULL,
                  baseline_complete = 0, scan_page = 1, scan_token = '', status = 'queued', next_check_at = 0, check_lease_until = 0,
                  claim_token = NULL, failures = 0, last_error = NULL, revision = creator_subscriptions.revision + 1,
                  updated_at = CURRENT_TIMESTAMP RETURNING id""", (remote_tag_id, tag_type, name, slug, interval_seconds, int(email_enabled))).fetchone()
                subscription_id = row["id"]
        return self.get(subscription_id)

    def update(self, subscription_id, payload):
        if not isinstance(payload, dict) or set(payload) - {"enabled", "email_enabled", "interval_seconds"}:
            raise ValueError("订阅配置包含未知选项")
        if "interval_seconds" in payload:
            self._interval(payload["interval_seconds"])
        for key in ("enabled", "email_enabled"):
            if key in payload and not isinstance(payload[key], bool):
                raise ValueError("订阅配置须为开关")
        with self.db.connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            row = conn.execute("SELECT * FROM creator_subscriptions WHERE id = ? AND removed_at IS NULL", (subscription_id,)).fetchone()
            if not row:
                raise ValueError("订阅不存在")
            values = {**dict(row), **payload}
            conn.execute("""UPDATE creator_subscriptions SET enabled = ?, email_enabled = ?, interval_seconds = ?,
                revision = revision + 1, status = 'queued', next_check_at = 0, claim_token = NULL, check_lease_until = 0,
                updated_at = CURRENT_TIMESTAMP WHERE id = ?""",
                         (int(values["enabled"]), int(values["email_enabled"]), values["interval_seconds"], subscription_id))
            if not values["enabled"] or not values["email_enabled"]:
                conn.execute("UPDATE mail_outbox SET status = 'cancelled' WHERE subscription_id = ? AND status IN ('pending', 'failed')", (subscription_id,))
        return self.get(subscription_id)

    def remove(self, subscription_id):
        with self.db.connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            row = conn.execute("SELECT id FROM creator_subscriptions WHERE id = ? AND removed_at IS NULL", (subscription_id,)).fetchone()
            if not row:
                raise ValueError("订阅不存在")
            conn.execute("UPDATE creator_subscriptions SET removed_at = CURRENT_TIMESTAMP, enabled = 0, revision = revision + 1, "
                         "claim_token = NULL, check_lease_until = 0 WHERE id = ?", (subscription_id,))
            conn.execute("UPDATE mail_outbox SET status = 'cancelled' WHERE subscription_id = ? AND status IN ('pending', 'failed')", (subscription_id,))
        return {"removed": subscription_id}

    def check_now(self, subscription_id):
        row = self.get(subscription_id)
        if not row["enabled"]:
            raise ValueError("请先启用订阅")
        self.db.execute("UPDATE creator_subscriptions SET next_check_at = 0 WHERE id = ?", (subscription_id,))
        return self.get(subscription_id)

    def _claim(self):
        now, token = time.time(), uuid.uuid4().hex
        with self.db.connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            row = conn.execute("""SELECT * FROM creator_subscriptions WHERE enabled = 1 AND removed_at IS NULL
                AND next_check_at <= ? AND (status <> 'checking' OR check_lease_until <= ?) ORDER BY next_check_at, id LIMIT 1""", (now, now)).fetchone()
            if not row:
                return None
            row = {**dict(row), "scan_token": row["scan_token"] or uuid.uuid4().hex, "claim_token": token}
            conn.execute("UPDATE creator_subscriptions SET status = 'checking', scan_token = ?, claim_token = ?, check_lease_until = ? WHERE id = ?",
                         (row["scan_token"], token, now + max(120, 4 * self.client.timeout), row["id"]))
        return row

    def _page(self, claimed, payload):
        items = payload.get("result") if isinstance(payload, dict) else None
        pages = payload.get("num_pages") if isinstance(payload, dict) else None
        if not isinstance(items, list) or len(items) > 100 or isinstance(pages, bool) or not isinstance(pages, int) or pages < 0 or (items and pages == 0):
            raise ValueError("远端分页资料不完整，保留当前检查进度")
        for item in items:
            if not isinstance(item, dict) or isinstance(item.get("id"), bool) or not isinstance(item.get("id"), int) or item["id"] <= 0:
                raise ValueError("远端作品ID无效，保留当前检查进度")
        with self.db.connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            row = conn.execute("SELECT * FROM creator_subscriptions WHERE id = ? AND enabled = 1 AND removed_at IS NULL "
                               "AND revision = ? AND claim_token = ?", (claimed["id"], claimed["revision"], claimed["claim_token"])).fetchone()
            if not row:
                return False
            known_anchor = False
            for item in items:
                seen = conn.execute("SELECT scan_token FROM subscription_seen WHERE subscription_id = ? AND gallery_id = ?",
                                    (row["id"], item["id"])).fetchone()
                if seen and seen["scan_token"] != row["scan_token"]:
                    known_anchor = True
                if row["baseline_complete"] and not seen:
                    conn.execute("""INSERT INTO subscription_updates(subscription_id, gallery_id, payload_json, scan_token)
                        VALUES (?, ?, ?, ?) ON CONFLICT(subscription_id, gallery_id) DO NOTHING""",
                                 (row["id"], item["id"], json.dumps(item, ensure_ascii=False), row["scan_token"]))
                conn.execute("INSERT INTO subscription_seen VALUES (?, ?, ?) ON CONFLICT(subscription_id, gallery_id) DO NOTHING",
                             (row["id"], item["id"], row["scan_token"]))
            complete = not items or row["scan_page"] >= pages or (row["baseline_complete"] and known_anchor)
            if complete:
                if row["baseline_complete"] and row["email_enabled"]:
                    count = conn.execute("SELECT COUNT(*) FROM subscription_updates WHERE subscription_id = ? AND scan_token = ?", (row["id"], row["scan_token"])).fetchone()[0]
                    # ponytail: mail digests show 100 titles; the complete update list stays in SQLite.
                    updates = conn.execute("SELECT payload_json FROM subscription_updates WHERE subscription_id = ? AND scan_token = ? ORDER BY id LIMIT 100",
                                           (row["id"], row["scan_token"])).fetchall()
                    if updates:
                        label = "作者" if row["tag_type"] == "artist" else "社团"
                        self.notifications.enqueue(row["id"], row["scan_token"], {
                            "subject": f"{label} {row['name']} 更新了{count}部作品",
                            "heading": (f"{label} {row['name']} 更新了{count}部作品。" +
                                        ("邮件显示前100部，其余可在网站订阅列表查看。" if count > 100 else "")),
                            "galleries": [json.loads(update["payload_json"]) for update in updates],
                        }, conn)
                conn.execute("""UPDATE creator_subscriptions SET baseline_complete = 1, scan_page = 1, scan_token = '',
                  status = 'idle', next_check_at = ?, check_lease_until = 0, claim_token = NULL, failures = 0,
                  last_error = NULL, last_checked_at = CURRENT_TIMESTAMP WHERE id = ?""", (time.time() + row["interval_seconds"], row["id"]))
                return False
            conn.execute("UPDATE creator_subscriptions SET scan_page = scan_page + 1, check_lease_until = ? WHERE id = ?",
                         (time.time() + max(120, 4 * self.client.timeout), row["id"]))
            claimed["scan_page"] += 1
            return True

    def tick(self):
        if not self.client.api_key or self._retry_at > time.time() or not self._lock.acquire(blocking=False):
            return
        claimed = None
        try:
            claimed = self._claim()
            if not claimed:
                return
            # ponytail: one polling worker, three pages per turn; persist cursors for large creator histories.
            for _ in range(3):
                if self._closing.is_set():
                    break
                payload = self.client.tagged(claimed["remote_tag_id"], page=claimed["scan_page"], per_page=100, sort="date", fresh=True)
                if not self._page(claimed, payload):
                    return
            self.db.execute("UPDATE creator_subscriptions SET status = 'queued', next_check_at = ?, claim_token = NULL, check_lease_until = 0 "
                            "WHERE id = ? AND revision = ? AND claim_token = ?",
                            (time.time() + 1, claimed["id"], claimed["revision"], claimed["claim_token"]))
        except Exception as exc:
            if claimed:
                failures = claimed["failures"] + 1
                delay = min(3600, 60 * 2**min(failures - 1, 6))
                if isinstance(exc, NhentaiApiError):
                    delay = max(delay, exc.retry_after or 0)
                    if exc.status_code == 429:
                        self._retry_at = time.time() + max(1, exc.retry_after or 60)
                    error = f"远端检查失败（HTTP {exc.status_code}），将自动重试"
                else:
                    error = str(exc) if isinstance(exc, ValueError) else "远端检查失败（" + type(exc).__name__ + "）"
                self.db.execute("UPDATE creator_subscriptions SET status = 'error', failures = ?, last_error = ?, next_check_at = ?, "
                                "claim_token = NULL, check_lease_until = 0 WHERE id = ? AND revision = ? AND claim_token = ?",
                                (failures, error[:500], time.time() + delay, claimed["id"], claimed["revision"], claimed["claim_token"]))
        finally:
            self._lock.release()

    def updates(self, page=1, unread_only=False):
        page = max(1, page)
        where = "WHERE u.read_at IS NULL" if unread_only else ""
        total = self.db.fetchone(f"SELECT COUNT(*) AS n FROM subscription_updates u {where}")["n"]
        rows = self.db.fetchall(f"""SELECT u.*, s.name, s.slug, s.tag_type, s.remote_tag_id, w.id AS work_id
          FROM subscription_updates u JOIN creator_subscriptions s ON s.id = u.subscription_id
          LEFT JOIN works w ON w.remote_gallery_id = u.gallery_id {where} ORDER BY u.id DESC LIMIT 20 OFFSET ?""", ((page - 1) * 20,))
        result = []
        for row in rows:
            summary = map_gallery_summary(json.loads(row["payload_json"]))
            summary["thumbnail"]["url"] = self.client.media_proxy_url(summary["thumbnail"]["path"], thumbnail=True)
            summary.update({"imported": row["work_id"] is not None, "work_id": row["work_id"], "tags": []})
            result.append({**{key: value for key, value in row.items() if key not in {"payload_json", "scan_token", "work_id"}}, "gallery": summary})
        unread = self.db.fetchone("SELECT COUNT(*) AS n FROM subscription_updates WHERE read_at IS NULL")["n"]
        return {"result": result, "total": total, "unread_count": unread, "page": page, "per_page": 20}

    def mark_read(self, update_id=None):
        where, params = (" AND id = ?", (update_id,)) if update_id is not None else ("", ())
        self.db.execute(f"UPDATE subscription_updates SET read_at = CURRENT_TIMESTAMP WHERE read_at IS NULL{where}", params)
        return {"ok": True}

    @staticmethod
    def _public(row):
        return {**{key: value for key, value in row.items() if key not in {"claim_token", "check_lease_until", "scan_token", "revision"}},
                "enabled": bool(row["enabled"]), "email_enabled": bool(row["email_enabled"]), "baseline_complete": bool(row["baseline_complete"])}

    def start(self):
        if self._thread and self._thread.is_alive():
            return
        self._closing.clear()
        def run():
            while not self._closing.is_set():
                try:
                    self.tick()
                    self.notifications.tick()
                except Exception as exc:
                    logging.getLogger(__name__).error("订阅或通知维护失败（%s）", type(exc).__name__)
                self._closing.wait(1)
        self._thread = threading.Thread(target=run, daemon=True)
        self._thread.start()

    def close(self):
        self._closing.set()
        if self._thread:
            self._thread.join(timeout=2)
