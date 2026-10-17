from __future__ import annotations

import hashlib
import json
import logging
import re
import threading
import time
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

from app.database import Database
from app.services import comicinfo
from app.services.dictionary_service import DictionaryService
from app.services.discover_service import DiscoverService
from app.services.media_library_service import LIBRARY_DEFAULTS, MediaLibraryService
from app.services.nhentai_client import NhentaiApiError, NhentaiClient

MAX_BATCH = 50
MIN_FUZZY_CONFIDENCE = 92
MIN_FUZZY_MARGIN = 7
MATCH_SOURCES = {"remote_id", "web", "manual_id", "fuzzy"}


class MetadataRefreshService:
    def __init__(self, db: Database, client: NhentaiClient, discover: DiscoverService,
                 dictionary: DictionaryService, libraries: MediaLibraryService | None = None):
        self.db, self.client, self.discover, self.dictionary, self.libraries = db, client, discover, dictionary, libraries
        self._closing = threading.Event()
        self._thread = None
        self._retry_at = 0

    def _snapshot(self, work_id: int, item_id: int | None = None, conn=None):
        fetch = (lambda sql, args: self.db._resolve_managed_fields(dict(row)) if (row := conn.execute(sql, args).fetchone()) else None) if conn else self.db.fetchone
        fetchall = (lambda sql, args: [dict(row) for row in conn.execute(sql, args)]) if conn else self.db.fetchall
        work = fetch("SELECT * FROM works WHERE id = ?", (work_id,))
        if not work:
            raise ValueError("本地作品不存在")
        file = fetch("""SELECT f.id, f.library_item_id, f.path, i.fingerprint, i.metadata_json,
            i.status AS source_status, i.size_bytes, i.mtime_ns, l.id AS library_id,
            l.enabled, l.removed_at, l.config_json FROM work_files f
            LEFT JOIN library_items i ON i.id = f.library_item_id LEFT JOIN media_libraries l ON l.id = i.library_id
            WHERE f.work_id = ? AND f.kind = 'source_cbz' AND (l.removed_at IS NULL OR l.id IS NULL)"""
            + (" AND i.id = ?" if item_id is not None else "")
            + """ ORDER BY (f.library_item_id IS NULL OR i.status = 'ready') DESC,
                f.library_item_id IS NULL DESC, l.kind = 'managed' DESC, l.kind = 'local' DESC, f.id DESC LIMIT 1""",
            (work_id, item_id) if item_id is not None else (work_id,))
        decisions = fetchall("SELECT field, value, source FROM work_metadata WHERE work_id = ? ORDER BY field", (work_id,))
        tags = fetchall("SELECT tag_type, remote_tag_id, remote_name, remote_slug, source FROM work_tags WHERE work_id = ? ORDER BY id", (work_id,))
        config = {**LIBRARY_DEFAULTS, **json.loads(file["config_json"] or "{}")} if file else LIBRARY_DEFAULTS.copy()
        metadata = json.loads(file["metadata_json"] or "{}") if file and file["library_item_id"] else {}
        identity = {key: work.get(key) for key in ("id", "remote_gallery_id", "metadata_gallery_id", "title", "title_japanese", "pretty_title", "language", "page_count")}
        version = hashlib.sha256(json.dumps([identity, file, decisions, tags], ensure_ascii=False, sort_keys=True).encode()).hexdigest()
        return {"work": work, "file": file, "decisions": decisions, "tags": tags, "config": config, "metadata": metadata, "version": version}

    def preview(self, work_ids: list[int], gallery_ids: dict[int, int] | None = None,
                queries: dict[int, str] | None = None, bind: bool | None = None) -> dict[str, Any]:
        ids = list(dict.fromkeys(int(value) for value in work_ids if int(value) > 0))
        if not ids or len(ids) > MAX_BATCH:
            raise ValueError(f"请选取1至{MAX_BATCH}部作品")
        result = []
        for work_id in ids:
            snapshot = self._snapshot(work_id)
            if bind is not None:
                snapshot["config"] = {**snapshot["config"], "auto_bind": bind}
            query = str((queries or {}).get(work_id) or "").strip()
            if len(query) > 240:
                raise ValueError("搜索名称最多240字")
            gallery_id = (gallery_ids or {}).get(work_id)
            if query.isdecimal():
                gallery_id, query = int(query), ""
            try:
                candidates, reason = self._candidates(snapshot, query, gallery_id)
                match = candidates[0] if candidates else None
                reason = match["reason"] if match else reason
            except NhentaiApiError as exc:
                candidates, match, reason = [], None, exc.message
            work = snapshot["work"]
            result.append({"work": {key: work.get(key) for key in ("id", "title", "source", "remote_gallery_id", "page_count")},
                           "version": snapshot["version"], "config": snapshot["config"], "query": query,
                           "match": match, "candidates": candidates, "reason": reason})
        ready = [row for row in result if row["match"] and row["match"]["eligible"]]
        return {"result": result, "summary": {
            "works": len(result), "ready": len(ready),
            "exact": sum(row["match"]["source"] != "fuzzy" for row in ready),
            "fuzzy": sum(row["match"]["source"] == "fuzzy" for row in ready),
            "review": sum(bool(row["match"]) and not row["match"]["eligible"] for row in result),
            "unmatched": sum(not row["match"] for row in result),
        }}

    def _reference(self, snapshot):
        work, file = snapshot["work"], snapshot["file"]
        if work.get("remote_gallery_id"):
            return int(work["remote_gallery_id"]), "remote_id"
        if snapshot["metadata"].get("gallery_id"):
            return int(snapshot["metadata"]["gallery_id"]), "web"
        # Legacy imports lack snapshots; only their managed local path may be inspected.
        if file and not file["library_item_id"]:
            path = Path(file["path"])
            if not self.libraries or self.libraries.settings.library_dir.resolve() in path.resolve().parents:
                gallery_id = comicinfo.gallery_id_from_cbz(path)
                if gallery_id:
                    return gallery_id, "web"
        return None, ""

    def _candidates(self, snapshot, query="", gallery_id=None, fresh=False, bind=None):
        if gallery_id is not None:
            if isinstance(gallery_id, bool) or not isinstance(gallery_id, int) or gallery_id <= 0:
                raise ValueError("作品ID必须为正整数")
            source = "manual_id"
        elif not query:
            gallery_id, source = self._reference(snapshot)
        else:
            source = ""
        if gallery_id:
            payload = self.client.gallery(gallery_id, fresh=fresh)
            if int(payload.get("id") or 0) != gallery_id:
                raise ValueError("远端返回的作品ID不一致")
            return [self._candidate(snapshot, payload, source, 100, 100, bind)], None
        query = query or self._search_title(snapshot)
        if len(_normalize_title(query).replace(" ", "")) < 3:
            return [], "标题关键词过短，请输入作品ID"
        config = snapshot["config"]
        remote_query = f"{query} language:{config['language']}" if config["language_mode"] == "strict" else query
        payload = self.client.search(remote_query, page=1, per_page=25, sort="date", fresh=fresh)
        candidates = {int(row["id"]): dict(row) for row in payload.get("result", [])
                      if isinstance(row, dict) and isinstance(row.get("id"), int) and row["id"] > 0}
        if config["language_mode"] == "prefer":
            preferred = self.client.search(f"{query} language:{config['language']}", page=1, per_page=25, sort="date", fresh=fresh)
            candidates.update({int(row["id"]): dict(row) for row in preferred.get("result", [])
                               if isinstance(row, dict) and isinstance(row.get("id"), int) and row["id"] > 0})
        ranked = sorted(((self._title_score(snapshot, row), row) for row in candidates.values()), key=lambda pair: pair[0], reverse=True)[:20]
        self._hydrate_tags([row for _, row in ranked])
        prefer = config["language_mode"] == "prefer"
        ranked.sort(key=lambda pair: (pair[0] >= MIN_FUZZY_CONFIDENCE,
                    prefer and _remote_language(pair[1]) == config["language"], pair[0]), reverse=True)
        result = []
        for score, row in ranked[:10]:
            pool = [other for other, candidate in ranked if candidate["id"] != row["id"]
                    and (not prefer or (_remote_language(candidate) == config["language"]) == (_remote_language(row) == config["language"]))]
            margin = score - max(pool) if pool else 100
            result.append(self._candidate(snapshot, row, "fuzzy", score, margin, bind))
        return result, None if result else "未找到远端候选"

    def _hydrate_tags(self, candidates):
        ids = list(dict.fromkeys(int(value) for row in candidates if not row.get("tags") for value in row.get("tag_ids", [])))
        tags = {}
        for start in range(0, len(ids), 100):
            batch = self.client.tags_by_ids(ids[start:start + 100])
            tags.update({int(tag["id"]): tag for tag in batch if isinstance(tag, dict) and tag.get("id")})
        for row in candidates:
            if not row.get("tags"):
                row["tags"] = [tags[value] for value in row.get("tag_ids", []) if value in tags]

    def _candidate(self, snapshot, payload, source, confidence, margin, bind=None):
        work, config = snapshot["work"], snapshot["config"]
        titles = _titles(payload)
        language = _remote_language(payload)
        local_language = _language(work.get("language") or snapshot["metadata"].get("LanguageISO"))
        page_match = bool(_page_count(payload)) and _page_count(payload) == int(work["page_count"])
        conflicts = []
        if config["language_mode"] == "strict" and language != config["language"]:
            conflicts.append(f"语言须为{config['language']}")
        linked = self._linked_work(work["id"], int(payload["id"])) if (config["auto_bind"] if bind is None else bind) else None
        if linked:
            conflicts.append(f"远端作品已关联本地作品 #{linked}")
        automatic = list(conflicts)
        if not page_match:
            automatic.append("页数不一致")
        if local_language and language != local_language:
            automatic.append("本地与远端语言不一致")
        diffs = []
        decisions = {row["field"]: row for row in snapshot["decisions"]}
        fields = [("title", "标题", work.get("title"), titles["english"] or titles["pretty"] or titles["japanese"]),
                  ("title_japanese", "副标题", work.get("title_japanese"), titles["japanese"]),
                  ("pretty_title", "整理标题", work.get("pretty_title"), titles["pretty"]),
                  ("language", "语言", local_language, language), ("pages", "页数", work["page_count"], _page_count(payload))]
        for kind, label in (("artist", "作者"), ("group", "社团")):
            local = list(dict.fromkeys(tag.get("remote_name") or tag.get("remote_slug") for tag in snapshot["tags"] if tag["tag_type"] == kind))
            remote = list(dict.fromkeys(tag.get("name") or tag.get("slug") for tag in payload.get("tags", []) if tag.get("type") == kind))
            if local and remote and not {_normalize_title(v) for v in local} & {_normalize_title(v) for v in remote}:
                automatic.append(f"{label}不一致")
            fields.append((kind, label, ", ".join(filter(None, local)) or None, ", ".join(filter(None, remote)) or None))
        for field, label, local, remote in fields:
            decision = decisions.get(field)
            protected = bool(decision and decision["source"] in {"manual", "current"})
            local = decision["value"] if protected else local
            diffs.append({"field": field, "label": label, "local": local, "remote": remote,
                          "changed": _text(local) != _text(remote), "protected": protected})
        if source == "fuzzy":
            if confidence < MIN_FUZZY_CONFIDENCE:
                automatic.append(f"标题置信度{confidence}%不足")
            if margin < MIN_FUZZY_MARGIN:
                automatic.append(f"候选仅相差{margin}%")
        reasons = conflicts if source == "manual_id" else automatic
        thumbnail = payload.get("thumbnail")
        thumbnail_path = thumbnail.get("path") if isinstance(thumbnail, dict) else thumbnail if isinstance(thumbnail, str) else None
        return {"gallery_id": int(payload["id"]), "title": titles["english"] or titles["pretty"] or titles["japanese"] or str(payload["id"]),
                "title_japanese": titles["japanese"], "pretty_title": titles["pretty"], "page_count": _page_count(payload),
                "language": language, "source": source, "confidence": confidence, "margin": margin,
                "eligible": not reasons, "automatic_eligible": not automatic, "reason": "；".join(reasons) or None,
                "selectable": not conflicts,
                "evidence": {"title_score": self._title_score(snapshot, payload), "page_match": page_match,
                             "language_match": bool(local_language and language == local_language)},
                "diffs": diffs, "thumbnail_url": self.client.media_proxy_url(thumbnail_path, thumbnail=True) if thumbnail_path else None}

    def apply(self, matches: list[dict[str, Any]]) -> dict[str, Any]:
        if not matches or len(matches) > MAX_BATCH:
            raise ValueError(f"请选取1至{MAX_BATCH}个匹配")
        result, seen = [], set()
        for match in matches:
            work_id, gallery_id = int(match.get("work_id") or 0), int(match.get("gallery_id") or 0)
            row = {"work_id": work_id, "gallery_id": gallery_id}
            if work_id <= 0 or gallery_id <= 0 or match.get("source") not in MATCH_SOURCES or work_id in seen:
                result.append({**row, "status": "skipped", "reason": "无效或重复的匹配"})
                continue
            seen.add(work_id)
            try:
                synced = self._apply_one(match)
                result.append({**row, "status": "updated", **synced})
            except ValueError as exc:
                result.append({**row, "status": "skipped", "reason": str(exc)})
            except Exception as exc:
                result.append({**row, "status": "error", "reason": str(exc)})
        return {"result": result, "summary": {"works": len(result),
                **{key: sum(row["status"] == status for row in result) for key, status in
                   (("updated", "updated"), ("skipped", "skipped"), ("errors", "error"))}}}

    def _apply_one(self, match, item_id=None, automatic=False):
        snapshot = self._snapshot(int(match["work_id"]), item_id)
        if match.get("version") and match["version"] != snapshot["version"]:
            raise ValueError("作品或设置已变化，请重新预览")
        gallery_id, source = int(match["gallery_id"]), match["source"]
        payload = self.client.gallery(gallery_id, fresh=True)
        if int(payload.get("id") or 0) != gallery_id:
            raise ValueError("远端返回的作品ID不一致")
        candidate = self._candidate(snapshot, payload, source, 100, 100, match.get("bind"))
        if source == "fuzzy":
            ranked, _ = self._candidates(snapshot, match.get("query") or self._search_title(snapshot), fresh=True, bind=match.get("bind"))
            if not ranked or ranked[0]["gallery_id"] != gallery_id or not ranked[0]["eligible"]:
                raise ValueError("模糊匹配置信度不足或候选不唯一")
        elif source in {"remote_id", "web"} and self._reference(snapshot) != (gallery_id, source):
            raise ValueError("来源ID已变化，请重新预览")
        if not candidate["eligible"] or (automatic and not candidate["automatic_eligible"]):
            raise ValueError(candidate["reason"] or "匹配需要人工确认")
        return self._persist(snapshot, payload, match.get("bind"), automatic)

    def _persist(self, snapshot, payload, bind=None, automatic=False):
        work, gallery_id = snapshot["work"], int(payload["id"])
        titles = _titles(payload)
        tags = [tag for tag in payload.get("tags", []) if isinstance(tag, dict) and isinstance(tag.get("id"), int) and tag["id"] > 0]
        self.discover.cache_gallery(payload)
        self.discover.cache_tags(tags)
        bind = snapshot["config"]["auto_bind"] if bind is None else bool(bind)
        with self.db.connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            item_id = snapshot["file"]["library_item_id"] if snapshot["file"] else None
            current = self._snapshot(work["id"], item_id, conn)
            if current["version"] != snapshot["version"]:
                raise ValueError("作品或设置在查询期间变化，请重新预览")
            if automatic and (self._closing.is_set() or not current["file"]["enabled"]
                              or not current["config"]["auto_scrape"] or current["file"]["source_status"] != "ready"):
                raise ValueError("自动刮削已暂停")
            if bind and conn.execute("SELECT 1 FROM works WHERE remote_gallery_id = ? AND id <> ?", (gallery_id, work["id"])).fetchone():
                raise ValueError("远端作品已关联其他本地作品")
            linked = gallery_id if bind else work.get("remote_gallery_id")
            tag_result = self.dictionary.sync_work_tags(work["id"], tags, conn)
            conn.execute("""UPDATE works SET remote = ?, remote_gallery_id = ?, metadata_gallery_id = ?, media_id = ?,
                title = ?, title_japanese = ?, pretty_title = ?, language = COALESCE(language, ?),
                updated_at = CURRENT_TIMESTAMP WHERE id = ?""",
                ("nhentai" if linked else work.get("remote"), linked, gallery_id,
                 payload.get("media_id") if bind else work.get("media_id"), titles["english"] or work["title"],
                 titles["japanese"] or work.get("title_japanese"), titles["pretty"] or work.get("pretty_title"),
                 _remote_language(payload), work["id"]))
            if linked and bind:
                page_match = int(work["page_count"]) == _page_count(payload)
                conn.execute("""INSERT INTO reader_bridges(work_id,remote_gallery_id,status,error) VALUES (?,?,?,?)
                    ON CONFLICT(work_id) DO UPDATE SET remote_gallery_id=excluded.remote_gallery_id,
                    status=CASE WHEN reader_bridges.remote_gallery_id=excluded.remote_gallery_id AND ? THEN reader_bridges.status ELSE excluded.status END,
                    error=CASE WHEN reader_bridges.remote_gallery_id=excluded.remote_gallery_id AND ? THEN reader_bridges.error ELSE excluded.error END""",
                    (work["id"], linked, "unverified" if page_match else "incompatible", None if page_match else "本地与远端页数不同，仅使用本地阅读", page_match, page_match))
            values = {"title": titles["english"], "title_japanese": titles["japanese"], "pretty_title": titles["pretty"],
                      "language": _remote_language(payload)}
            for kind in ("artist", "group", "tag"):
                values["tags" if kind == "tag" else kind] = ", ".join(tag.get("name") or tag.get("slug") or "" for tag in tags if tag.get("type") == kind) or None
            for field, value in values.items():
                if value:
                    conn.execute("""INSERT INTO work_metadata(work_id, field, value, source) VALUES (?, ?, ?, 'remote')
                        ON CONFLICT(work_id, field) DO UPDATE SET
                        value = CASE WHEN work_metadata.source IN ('manual', 'current') THEN work_metadata.value ELSE excluded.value END,
                        source = CASE WHEN work_metadata.source IN ('manual', 'current') THEN work_metadata.source ELSE 'remote' END,
                        updated_at = CURRENT_TIMESTAMP""", (work["id"], field, value))
            if item_id:
                conn.execute("UPDATE library_items SET scrape_status = 'completed', scrape_retry_at = 0, scrape_attempts = 0, scrape_result_json = ? WHERE id = ?",
                             (json.dumps({"gallery_id": gallery_id, "bound": bind}, ensure_ascii=False), item_id))
        return {"tags": tag_result["linked"], "removed_tags": tag_result["removed"], "bound": bind}

    def _linked_work(self, work_id, gallery_id):
        row = self.db.fetchone("SELECT id FROM works WHERE remote_gallery_id = ? AND id <> ?", (gallery_id, work_id))
        return int(row["id"]) if row else None

    @staticmethod
    def _title_score(snapshot, payload):
        work = snapshot["work"]
        local = _title_variants(work.get("title"), work.get("title_japanese"), work.get("pretty_title"),
                                snapshot["metadata"].get("Title"), snapshot["metadata"].get("AlternateSeries"))
        remote = _title_variants(*_titles(payload).values())
        return round(max((SequenceMatcher(None, left, right).ratio() for left in local for right in remote), default=0) * 100)

    @staticmethod
    def _search_title(snapshot):
        work = snapshot["work"]
        title = str(snapshot["metadata"].get("Title") or work.get("title") or work.get("title_japanese") or "").strip()
        return re.sub(r"\s*\[\d+\]\s*$", "", title).strip()

    def tick(self):
        if self._retry_at > time.time() or not self.client.api_key:
            return
        row = self.db.fetchone("""SELECT i.id, i.work_id FROM library_items i JOIN media_libraries l ON l.id = i.library_id
            WHERE i.status = 'ready' AND i.scrape_status IN ('pending', 'error') AND i.scrape_retry_at <= ?
            AND l.enabled = 1 AND l.removed_at IS NULL AND json_extract(l.config_json, '$.auto_scrape') = 1
            ORDER BY i.scrape_retry_at, i.id LIMIT 1""", (time.time(),))
        if not row:
            return
        snapshot = self._snapshot(row["work_id"], row["id"])
        with self.db.connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            if self._closing.is_set() or self._snapshot(row["work_id"], row["id"], conn)["version"] != snapshot["version"]:
                return
            if not conn.execute("UPDATE library_items SET scrape_status = 'running' WHERE id = ? AND status = 'ready' AND scrape_status IN ('pending', 'error')",
                                (row["id"],)).rowcount:
                return
        try:
            candidates, reason = self._candidates(snapshot)
            match = candidates[0] if candidates else None
            if match and match["automatic_eligible"]:
                self._apply_one({**match, "work_id": row["work_id"], "version": snapshot["version"]}, row["id"], True)
            else:
                self._finish_attempt(snapshot, "review", {"candidates": candidates, "reason": match["reason"] if match else reason})
        except Exception as exc:
            delay = max(30, exc.retry_after or 60) if isinstance(exc, NhentaiApiError) else 60
            if isinstance(exc, NhentaiApiError) and exc.status_code == 429:
                self._retry_at = time.time() + delay
            self._finish_attempt(snapshot, "error", {"reason": str(exc)[:500]}, delay)

    def _finish_attempt(self, snapshot, status, result, delay=0):
        item_id, work_id = snapshot["file"]["library_item_id"], snapshot["work"]["id"]
        with self.db.connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            try:
                current = self._snapshot(work_id, item_id, conn)
            except ValueError:
                return
            if current["version"] != snapshot["version"]:
                conn.execute("UPDATE library_items SET scrape_status = 'pending' WHERE id = ? AND scrape_status = 'running'", (item_id,))
                return
            if self._closing.is_set():
                status, delay = "pending", 0
            conn.execute("""UPDATE library_items SET scrape_status = ?, scrape_attempts = scrape_attempts + ?,
                scrape_retry_at = CASE WHEN ? > 0 THEN ? + MIN(3600, ? * (1 << MIN(scrape_attempts, 6))) ELSE 0 END,
                scrape_result_json = ? WHERE id = ? AND scrape_status = 'running'""",
                (status, int(status == "error"), delay, time.time(), delay, json.dumps(result, ensure_ascii=False), item_id))

    def start(self):
        if self._thread and self._thread.is_alive():
            return
        self._closing.clear()
        self.db.execute("UPDATE library_items SET scrape_status = 'pending' WHERE scrape_status = 'running'")
        def run():
            while not self._closing.is_set():
                try:
                    self.tick()
                except Exception:
                    logging.getLogger(__name__).exception("自动刮削检查失败")
                self._closing.wait(1)
        self._thread = threading.Thread(target=run, daemon=True)
        self._thread.start()

    def close(self):
        self._closing.set()
        if self._thread:
            self._thread.join(2)


def _language(value):
    value = str(value or "").strip().lower()
    return {"zh": "chinese", "zh-cn": "chinese", "zh-tw": "chinese", "ja": "japanese", "en": "english"}.get(value, value or None)


def _remote_language(payload):
    return next((_language(tag.get("slug") or tag.get("name")) for tag in payload.get("tags", [])
                 if tag.get("type") == "language" and _language(tag.get("slug") or tag.get("name")) in {"chinese", "japanese", "english"}), None)

def _titles(payload: dict[str, Any]) -> dict[str, str | None]:
    nested = payload.get("title") if isinstance(payload.get("title"), dict) else {}
    return {
        "english": _text(payload.get("english_title") or nested.get("english") or (payload.get("title") if isinstance(payload.get("title"), str) else None)),
        "japanese": _text(payload.get("japanese_title") or nested.get("japanese")),
        "pretty": _text(nested.get("pretty") or payload.get("pretty_title")),
    }


def _page_count(payload: dict[str, Any]) -> int:
    return int(payload.get("num_pages") or payload.get("page_count") or 0)


def _text(value: Any) -> str | None:
    text = str(value).strip() if value is not None else ""
    return text or None


def _normalize_title(value: Any) -> str:
    text = unicodedata.normalize("NFKC", str(value or "")).casefold()
    text = re.sub(r"[^\w]+", " ", text, flags=re.UNICODE)
    return " ".join(text.split())


def _title_variants(*values: Any) -> list[str]:
    variants: list[str] = []
    for value in values:
        normalized = _normalize_title(value)
        without_brackets = _normalize_title(re.sub(r"[\[【（(].*?[\]】）)]", " ", str(value or "")))
        for candidate in (normalized, without_brackets):
            if candidate and candidate not in variants:
                variants.append(candidate)
    return variants
