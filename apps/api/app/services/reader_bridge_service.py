from __future__ import annotations

import hashlib
import json
import time
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO

from PIL import Image

from app.services.archive_cache_service import _version
from app.services.job_service import JobCancelled

MAX_PAGE_BYTES = 32 * 1024**2


class ReaderBridgeService:
    """Only byte-identical, version-bound pages may bridge a slow local source."""
    def __init__(self, db, archive, client, jobs):
        self.db, self.archive, self.client, self.jobs = db, archive, client, jobs

    def _snapshot(self, work_id):
        work = self.db.fetchone("SELECT remote_gallery_id,page_count FROM works WHERE id=?", (work_id,))
        if not work:
            raise ValueError("作品不存在")
        if not work["remote_gallery_id"]:
            raise ValueError("请先绑定远端作品")
        source = self.archive.cache.direct_source(work_id)
        revision = self.archive.cache.revision(source)
        version = hashlib.sha256(json.dumps([work["remote_gallery_id"], revision, _version(source)]).encode()).hexdigest()
        return {"gallery_id": work["remote_gallery_id"], "page_count": work["page_count"],
                "source": source, "version": version, "source_revision": revision}

    @staticmethod
    def _catalog(payload):
        pages = payload.get("pages") or []
        if not pages or len(pages) != int(payload.get("num_pages") or payload.get("page_count") or 0):
            raise ValueError("远端页面目录不完整，双来源阅读已停用")
        result = []
        for i, page in enumerate(pages, 1):
            path = page.get("path") if isinstance(page, dict) else page
            if not isinstance(path, str) or not path or len(path) > 2000:
                raise ValueError("远端页面路径无效")
            result.append({"page_index": i, "path": path})
        return result

    def status(self, work_id, fresh=False):
        try:
            snapshot = self._snapshot(work_id)
        except (ValueError, OSError) as exc:
            return {"status": "unavailable", "enabled": False, "eligible": False, "reason": str(exc), "pages": []}
        row = self.db.fetchone("SELECT * FROM reader_bridges WHERE work_id=?", (work_id,))
        status, reason = (row["status"], row["error"]) if row else ("unverified", "尚未逐页核验")
        enabled = bool(row["enabled"]) if row else True
        valid = bool(row and status == "verified" and row["version"] == snapshot["version"]
                     and row["remote_gallery_id"] == snapshot["gallery_id"])
        if row and status == "verified" and not valid:
            status, reason = "unverified", "本地来源或绑定已变化，请重新核验"
        pages = json.loads(row["catalog_json"]) if valid else []
        if fresh and valid and enabled:
            try:
                current = self._catalog(self.client.gallery(snapshot["gallery_id"], fresh=True))
                if [p["path"] for p in current] != [p["path"] for p in pages]:
                    raise ValueError("远端页数或顺序已变化，双来源阅读已停用")
            except Exception as exc:
                valid = False; status, reason = "failed", str(exc)[:500]
                self.db.execute("UPDATE reader_bridges SET status='failed',error=? WHERE work_id=? AND version=?", (reason, work_id, snapshot["version"]))
        return {"status": status, "enabled": enabled, "eligible": valid and enabled, "reason": reason,
                "source_revision": snapshot["source_revision"], "version": snapshot["version"],
                "source_stamp": _version(snapshot["source"]),
                "job": self.jobs.get(row["job_id"]) if row and row["job_id"] else None,
                "pages": [{"page_index": p["page_index"], "width": p.get("width"), "height": p.get("height"),
                           "url": f"/api/works/{work_id}/bridge/pages/{p['page_index']}?version={snapshot['version']}"} for p in pages] if valid and enabled else []}

    def enable(self, work_id, enabled):
        snapshot = self._snapshot(work_id)
        self.db.execute("""INSERT INTO reader_bridges(work_id,remote_gallery_id,enabled) VALUES (?,?,?)
            ON CONFLICT(work_id) DO UPDATE SET enabled=excluded.enabled, updated_at=CURRENT_TIMESTAMP""",
            (work_id, snapshot["gallery_id"], int(enabled)))
        return self.status(work_id)

    def _remote_page(self, path):
        with self.client.open_media(path, timeout=10) as response:
            body = response.read(MAX_PAGE_BYTES + 1)
            mime = response.headers.get_content_type()
        if len(body) > MAX_PAGE_BYTES:
            raise ValueError("远端图片超过32MB，改用本地阅读")
        with Image.open(BytesIO(body)) as image:
            width, height = image.size
            if width * height > 30000000:
                raise ValueError("图片像素超过3000万")
        return body, mime, width, height

    def page(self, work_id, page_index, version):
        snapshot = self._snapshot(work_id)
        row = self.db.fetchone("SELECT * FROM reader_bridges WHERE work_id=?", (work_id,))
        if not row or not row["enabled"] or row["status"] != "verified" or snapshot["version"] != version or row["version"] != version:
            raise ValueError("双来源核验已失效，请改用本地阅读")
        catalog = json.loads(row["catalog_json"])
        if page_index < 1 or page_index > len(catalog):
            raise ValueError("页码不在已核验目录内")
        proof = catalog[page_index - 1]
        body, mime, _, _ = self._remote_page(proof["path"])
        if hashlib.sha256(body).hexdigest() != proof["sha256"]:
            self.db.execute("UPDATE reader_bridges SET status='incompatible',error='远端图片内容已变化' WHERE work_id=? AND version=?", (work_id, version))
            raise ValueError("远端图片内容已变化，双来源阅读已停用")
        if self._snapshot(work_id)["version"] != version:
            raise ValueError("阅读来源在请求期间变化")
        return body, mime

    def run(self, job_id, checkpoint):
        target = self.jobs.get(job_id)["target"]
        work_id, lease = target["work_id"], None
        try:
            self.jobs.mark_running(job_id, "verifying_pages")
            snapshot = self._snapshot(work_id)
            if snapshot["version"] != target["version"]:
                raise ValueError("来源或绑定已变化，请重新核验")
            payload = self.client.gallery(snapshot["gallery_id"], fresh=True)
            catalog = self._catalog(payload)
            if len(catalog) != snapshot["page_count"]:
                raise ValueError(f"本地{snapshot['page_count']}页、远端{len(catalog)}页，双来源阅读已停用")
            prepared = self.archive.cache.prepare(work_id)
            while prepared["status"] not in {"direct", "ready", "failed", "cancelled"}:
                checkpoint()
                self.jobs.update_progress(job_id, "running", "caching_archive", prepared.get("job", {}).get("progress", {}).get("current", 0),
                                          prepared.get("job", {}).get("progress", {}).get("total", 0))
                time.sleep(.2)
                prepared = self.archive.cache.prepare(work_id)
            lease = prepared.get("lease")
            if prepared["status"] in {"failed", "cancelled"}:
                raise ValueError(prepared.get("error") or "本地读取准备失败")
            revision = prepared.get("source_revision")
            if len(prepared.get("pages") or []) != len(catalog):
                raise ValueError("本地页面目录与远端不同")
            def compare(page):
                checkpoint()
                remote, _, width, height = self._remote_page(page["path"])
                checkpoint()
                local, _ = self.archive.read_page(work_id, page["page_index"], lease, revision)
                digest = hashlib.sha256(remote).hexdigest()
                if hashlib.sha256(local).hexdigest() != digest:
                    raise ValueError(f"第{page['page_index']}页内容或顺序不同，双来源阅读已停用")
                return {**page, "sha256": digest, "width": width, "height": height}
            proofs = []
            # ponytail: one verification job and two page pairs bound remote IO; expand only after measurement.
            with ThreadPoolExecutor(max_workers=2) as pool:
                for start in range(0, len(catalog), 2):
                    proofs.extend(pool.map(compare, catalog[start:start + 2]))
                    checkpoint()
                    self.jobs.update_progress(job_id, "running", "verifying_pages", len(proofs), len(catalog))
            latest = self._catalog(self.client.gallery(snapshot["gallery_id"], fresh=True))
            if latest != catalog:
                raise ValueError("远端目录在核验期间变化，请重试")
            with self.db.connect() as conn:
                conn.execute("BEGIN IMMEDIATE")
                if self._snapshot(work_id)["version"] != snapshot["version"]:
                    raise ValueError("本地来源或绑定在核验期间变化")
                conn.execute("""UPDATE reader_bridges SET status='verified',error=NULL,catalog_json=?,source_revision=?,updated_at=CURRENT_TIMESTAMP
                    WHERE work_id=? AND version=? AND job_id=?""",
                    (json.dumps(proofs), snapshot["source_revision"], work_id, snapshot["version"], job_id))
            self.jobs.complete(job_id, {"verified_pages": len(proofs)})
        except JobCancelled:
            raise
        except Exception as exc:
            message = str(exc)[:1000]
            self.db.execute("UPDATE reader_bridges SET status='failed',error=? WHERE work_id=? AND job_id=?", (message, work_id, job_id))
            self.jobs.fail(job_id, message)
        finally:
            if lease:
                self.archive.cache.release(work_id, lease)
