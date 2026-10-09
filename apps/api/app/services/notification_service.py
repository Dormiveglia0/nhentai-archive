from __future__ import annotations

import json
import smtplib
import ssl
import threading
import time
import uuid
from email.headerregistry import Address
from email.message import EmailMessage
from email.utils import formatdate, make_msgid
from typing import Any
from urllib.parse import urlsplit

from app.database import Database


SMTP_DEFAULTS = {"enabled": False, "host": "", "port": 587, "security": "starttls", "username": "",
                 "password": "", "sender": "", "recipient": "", "site_url": "", "timeout_seconds": 10}


class NotificationService:
    def __init__(self, db: Database):
        self.db = db
        self._lock = threading.Lock()

    def config(self, conn=None) -> dict[str, Any]:
        row = (conn.execute("SELECT value FROM settings WHERE key = 'notifications.smtp'").fetchone() if conn else
               self.db.fetchone("SELECT value FROM settings WHERE key = 'notifications.smtp'"))
        return {**SMTP_DEFAULTS, **(json.loads(row["value"]) if row else {})}

    def public_config(self) -> dict[str, Any]:
        config = self.config()
        last_test = self.db.fetchone("SELECT value FROM settings WHERE key = 'notifications.smtp_last_test'")
        return {**{key: value for key, value in config.items() if key != "password"},
                "password_configured": bool(config["password"]),
                "last_test": json.loads(last_test["value"]) if last_test else None}

    def configure(self, payload: dict[str, Any]) -> dict[str, Any]:
        if not isinstance(payload, dict) or set(payload) - (set(SMTP_DEFAULTS) | {"clear_password"}):
            raise ValueError("SMTP配置包含未知选项")
        with self.db.connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            config = self.config(conn)
            for key, value in payload.items():
                if key == "clear_password":
                    if not isinstance(value, bool):
                        raise ValueError("清除密码必须是开关")
                    if value:
                        config["password"] = ""
                elif key == "password" and value == "":
                    continue
                else:
                    config[key] = value
            self._validate(config)
            conn.execute("INSERT INTO settings(key, value) VALUES ('notifications.smtp', ?) "
                         "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP",
                         (json.dumps(config, ensure_ascii=False),))
        return self.public_config()

    @staticmethod
    def _validate(config):
        if not isinstance(config["enabled"], bool) or not isinstance(config["security"], str) or config["security"] not in {"starttls", "ssl", "none"}:
            raise ValueError("SMTP开关或连接方式无效")
        for key, limit in (("host", 253), ("username", 320), ("sender", 320), ("recipient", 320), ("site_url", 2048), ("password", 4096)):
            if not isinstance(config[key], str) or len(config[key]) > limit or any(char in config[key] for char in "\r\n\x00"):
                raise ValueError("SMTP字段格式无效")
            if key != "password":
                config[key] = config[key].strip()
        if any(char.isspace() or char in "/@" for char in config["host"]):
            raise ValueError("请输入SMTP主机名，不含协议或路径")
        for key, lower, upper in (("port", 1, 65535), ("timeout_seconds", 3, 60)):
            if isinstance(config[key], bool) or not isinstance(config[key], int) or not lower <= config[key] <= upper:
                raise ValueError(f"{key}必须在{lower}至{upper}之间")
        for address in (config["sender"], config["recipient"]):
            if not isinstance(address, str) or len(address) > 320 or any(char in address for char in "\r\n\x00"):
                raise ValueError("邮箱地址无效")
            if address:
                try:
                    parsed = Address(addr_spec=address)
                    if not parsed.username or not parsed.domain:
                        raise ValueError()
                except (ValueError, IndexError) as exc:
                    raise ValueError("邮箱地址无效") from exc
        if config["site_url"]:
            try:
                url = urlsplit(config["site_url"])
                if url.scheme not in {"https", "http"} or not url.hostname or any(char.isspace() for char in url.hostname) or url.username or url.password or url.query or url.fragment:
                    raise ValueError()
                _ = url.port
            except ValueError as exc:
                raise ValueError("网站地址须为完整的HTTP或HTTPS地址") from exc
        if config["enabled"] and (not config["host"] or not config["sender"] or not config["recipient"]):
            raise ValueError("启用通知前请填写SMTP服务器、发件邮箱与收件邮箱")
        if config["enabled"] and config["username"] and not config["password"]:
            raise ValueError("请输入SMTP密码，或清空用户名使用免认证服务器")

    def enqueue(self, subscription_id: int, token: str, payload: dict, conn) -> None:
        if not self.config(conn)["enabled"]:
            return
        conn.execute("""INSERT INTO mail_outbox(subscription_id, dedup_key, message_id, payload_json)
                       VALUES (?, ?, ?, ?) ON CONFLICT(dedup_key) DO NOTHING""",
                     (subscription_id, f"subscription:{subscription_id}:{token}", make_msgid(domain="nh-archive.local"),
                      json.dumps(payload, ensure_ascii=False)))

    def _send(self, payload: dict, message_id: str, config: dict) -> None:
        if not config["host"] or not config["sender"] or not config["recipient"]:
            raise ValueError("请先配置SMTP服务器和收发件邮箱")
        message = EmailMessage()
        message["From"] = Address("NH Archive", addr_spec=config["sender"])
        message["To"] = config["recipient"]
        message["Subject"] = payload["subject"].replace("\r", " ").replace("\n", " ")[:240]
        message["Message-ID"] = message_id
        message["Date"] = formatdate(usegmt=True)
        lines = [payload.get("heading", payload["subject"]), ""]
        for gallery in payload.get("galleries", []):
            title = gallery.get("english_title") or gallery.get("title", {})
            if isinstance(title, dict):
                title = title.get("japanese") or title.get("pretty") or title.get("english")
            gallery_id = int(gallery["id"])
            link = (config["site_url"].rstrip("/") + f"/#gallery/{gallery_id}" if config["site_url"] else
                    f"https://nhentai.net/g/{gallery_id}/")
            lines.extend([str(title or f"作品 {gallery_id}"), link, ""])
        message.set_content("\n".join(lines))
        cls = smtplib.SMTP_SSL if config["security"] == "ssl" else smtplib.SMTP
        options = {"timeout": config["timeout_seconds"]}
        if config["security"] == "ssl":
            options["context"] = ssl.create_default_context()
        with cls(config["host"], config["port"], **options) as smtp:
            if config["security"] == "starttls":
                smtp.starttls(context=ssl.create_default_context())
            if config["username"]:
                smtp.login(config["username"], config["password"])
            refused = smtp.send_message(message)
            if refused:
                raise smtplib.SMTPRecipientsRefused(refused)

    @staticmethod
    def _error(exc):
        if isinstance(exc, smtplib.SMTPAuthenticationError):
            return "SMTP认证失败，请检查用户名和密码"
        if isinstance(exc, ssl.SSLError):
            return "SMTP TLS连接失败，请检查连接方式与证书"
        if isinstance(exc, smtplib.SMTPRecipientsRefused):
            return "SMTP服务器拒绝收件邮箱"
        if isinstance(exc, smtplib.SMTPSenderRefused):
            return "SMTP服务器拒绝发件邮箱"
        if isinstance(exc, ValueError):
            return "请检查SMTP配置与邮件内容"
        return "SMTP发送失败（" + type(exc).__name__ + "）"

    def test(self):
        try:
            self._send({"subject": "NH Archive 邮件通知测试", "heading": "邮件通知配置已连接成功。"},
                       make_msgid(domain="nh-archive.local"), self.config())
            result = {"ok": True, "message": "测试邮件已发送"}
        except Exception as exc:
            result = {"ok": False, "message": self._error(exc)}
        self.db.execute("INSERT INTO settings(key, value) VALUES ('notifications.smtp_last_test', ?) "
                        "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP", (json.dumps(result),))
        return result

    def tick(self):
        if not self._lock.acquire(blocking=False):
            return
        try:
            config = self.config()
            if not config["enabled"]:
                return
            now, token = time.time(), uuid.uuid4().hex
            with self.db.connect() as conn:
                conn.execute("BEGIN IMMEDIATE")
                row = conn.execute("""SELECT * FROM mail_outbox WHERE (status = 'pending' AND next_attempt_at <= ?)
                    OR (status = 'sending' AND lease_until <= ?) ORDER BY id LIMIT 1""", (now, now)).fetchone()
                if not row:
                    return
                row = dict(row)
                subscription = conn.execute("SELECT enabled, email_enabled, removed_at FROM creator_subscriptions WHERE id = ?",
                                            (row["subscription_id"],)).fetchone()
                if not subscription or not subscription["enabled"] or not subscription["email_enabled"] or subscription["removed_at"]:
                    conn.execute("UPDATE mail_outbox SET status = 'cancelled' WHERE id = ?", (row["id"],))
                    return
                conn.execute("UPDATE mail_outbox SET status = 'sending', attempts = attempts + 1, claim_token = ?, lease_until = ? WHERE id = ?",
                             (token, now + max(120, 3 * config["timeout_seconds"]), row["id"]))
            try:
                self._send(json.loads(row["payload_json"]), row["message_id"], config)
                self.db.execute("UPDATE mail_outbox SET status = 'sent', sent_at = CURRENT_TIMESTAMP, last_error = NULL, lease_until = 0 "
                                "WHERE id = ? AND claim_token = ?", (row["id"], token))
            except Exception as exc:
                attempts = row["attempts"] + 1
                permanent = isinstance(exc, (smtplib.SMTPAuthenticationError, smtplib.SMTPRecipientsRefused, smtplib.SMTPSenderRefused))
                self.db.execute("UPDATE mail_outbox SET status = ?, next_attempt_at = ?, last_error = ?, lease_until = 0 "
                                "WHERE id = ? AND claim_token = ?",
                                ("failed" if permanent or attempts >= 8 else "pending", now + min(3600, 60 * 2**(attempts - 1)),
                                 self._error(exc), row["id"], token))
        finally:
            self._lock.release()

    def outbox(self, limit=50):
        rows = self.db.fetchall("""SELECT m.id, m.subscription_id, m.status, m.attempts, m.last_error, m.created_at, m.sent_at,
            s.name, s.tag_type FROM mail_outbox m LEFT JOIN creator_subscriptions s ON s.id = m.subscription_id ORDER BY m.id DESC LIMIT ?""",
                               (max(1, min(limit, 100)),))
        counts = self.db.fetchall("SELECT status, COUNT(*) AS count FROM mail_outbox GROUP BY status")
        return {"result": rows, "counts": {row["status"]: row["count"] for row in counts}}

    def retry(self, mail_id):
        with self.db.connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            row = conn.execute("SELECT status FROM mail_outbox WHERE id = ?", (mail_id,)).fetchone()
            if not row or row["status"] not in {"pending", "failed"}:
                raise ValueError("只有尚未发送或发送失败的邮件可以重试")
            conn.execute("UPDATE mail_outbox SET status = 'pending', attempts = 0, next_attempt_at = 0, last_error = NULL WHERE id = ?", (mail_id,))
        return {"queued": mail_id}
