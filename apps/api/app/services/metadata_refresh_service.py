from __future__ import annotations

import hashlib
import json
import logging
import re
import threading
import time
import unicodedata
from difflib import SequenceMatcher
from io import BytesIO
from pathlib import Path
from typing import Any

from app.database import Database
from app.services import comicinfo
from app.services.cover_similarity_service import CoverSimilarityService, compare_fingerprints, fingerprint
from app.services.image_search_service import ImageSearchError, ImageSearchService
from app.services.dictionary_service import DictionaryService
from app.services.discover_service import DiscoverService
from app.services.media_library_service import LIBRARY_DEFAULTS, MediaLibraryService
from app.services.nhentai_client import NhentaiApiError, NhentaiClient
from app.services.job_service import JobCancelled, JobService

MAX_BATCH = 50
MIN_FUZZY_CONFIDENCE = 92
MIN_FUZZY_MARGIN = 7
MATCH_SOURCES = {"remote_id", "web", "manual_id", "fuzzy"}


class MetadataRefreshService:
    def __init__(self, db: Database, client: NhentaiClient, discover: DiscoverService,
                 dictionary: DictionaryService, libraries: MediaLibraryService | None = None, archive=None):
        self.db, self.client, self.discover, self.dictionary, self.libraries = db, client, discover, dictionary, libraries
        self.covers = CoverSimilarityService(client, libraries.settings.covers_dir) if libraries else None
        self.images = ImageSearchService(archive, libraries.settings.covers_dir) if libraries else None
        self.jobs = JobService(db)
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
        if item_id is not None and not file:
            raise ValueError("扫描记录与作品不匹配或媒体库已移除")
        decisions = fetchall("SELECT field, value, source FROM work_metadata WHERE work_id = ? ORDER BY field", (work_id,))
        tags = fetchall("SELECT tag_type, remote_tag_id, remote_name, remote_slug, source FROM work_tags WHERE work_id = ? ORDER BY id", (work_id,))
        config = {**LIBRARY_DEFAULTS, **json.loads(file["config_json"] or "{}")} if file else LIBRARY_DEFAULTS.copy()
        metadata = json.loads(file["metadata_json"] or "{}") if file and file["library_item_id"] else {}
        identity = {key: work.get(key) for key in ("id", "remote_gallery_id", "metadata_gallery_id", "title", "title_japanese", "pretty_title", "language", "page_count", "cover_path")}
        try:
            cover = Path(work['cover_path']).stat() if work.get('cover_path') else None
            identity['cover_version'] = [cover.st_size, cover.st_mtime_ns] if cover else None
        except OSError:
            identity['cover_version'] = None
        version = hashlib.sha256(json.dumps([identity, file, decisions, tags], ensure_ascii=False, sort_keys=True).encode()).hexdigest()
        return {"work": work, "file": file, "decisions": decisions, "tags": tags, "config": config, "metadata": metadata, "version": version}

    def preview(self, work_ids: list[int], gallery_ids: dict[int, int] | None = None,
                queries: dict[int, str] | None = None, bind: bool | None = None,
                item_ids: dict[int, int] | None = None, image_search: str | None = None) -> dict[str, Any]:
        ids = list(dict.fromkeys(int(value) for value in work_ids if int(value) > 0))
        if not ids or len(ids) > MAX_BATCH:
            raise ValueError(f"请选取1至{MAX_BATCH}部作品")
        if image_search and (len(ids) != 1 or image_search not in {'cover', 'page'}):
            raise ValueError('每次搜图仅支持一部作品，请选择封面或随机内页')
        result = []
        for work_id in ids:
            snapshot = self._snapshot(work_id, (item_ids or {}).get(work_id))
            if bind is not None:
                snapshot["config"] = {**snapshot["config"], "auto_bind": bind}
            query = str((queries or {}).get(work_id) or "").strip()
            if len(query) > 240:
                raise ValueError("搜索名称最多240字")
            gallery_id = (gallery_ids or {}).get(work_id)
            if query.isdecimal():
                gallery_id, query = int(query), ""
            try:
                candidates, reason = (self._image_candidates(snapshot, image_search) if image_search
                                      else self._candidates(snapshot, query, gallery_id))
                match = candidates[0] if candidates else None
                reason = match["reason"] if match else reason
            except (NhentaiApiError, ImageSearchError) as exc:
                candidates, match, reason = [], None, str(exc)
            work = snapshot["work"]
            result.append({"work": {key: work.get(key) for key in ("id", "title", "source", "remote_gallery_id", "page_count")},
                           "version": snapshot["version"], "config": snapshot["config"], "query": query,
                           "match": match, "candidates": candidates, "reason": reason})
        ready = [row for row in result if row["match"] and row["match"]["eligible"]]
        return {"result": result, "summary": {
            "works": len(result), "ready": len(ready),
            "exact": sum(row["match"]["source"] in {'remote_id', 'web', 'manual_id'} for row in ready),
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
            if isinstance(gallery_id, bool) or not isinstance(gallery_id, int) or not 0 < gallery_id <= 9223372036854775807:
                raise ValueError("作品ID必须为有效的正整数")
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
        if config["language_mode"] == "prefer" and (payload.get('num_pages', 1) > 1 or len(candidates) >= 25):
            preferred = self.client.search(f"{query} language:{config['language']}", page=1, per_page=25, sort="date", fresh=fresh)
            candidates.update({int(row["id"]): dict(row) for row in preferred.get("result", [])
                               if isinstance(row, dict) and isinstance(row.get("id"), int) and row["id"] > 0})
        return self._rank_candidates(snapshot, list(candidates.values()), bind), None if candidates else "未找到远端候选"

    def _image_candidates(self, snapshot, mode, bind=None, cancelled=lambda: False):
        if not self.images:
            raise ImageSearchError('当前来源不支持搜图')
        hits, body, page = self.images.lookup(snapshot, mode, cancelled)
        candidates = []
        for hit in hits:
            if cancelled():
                raise InterruptedError('搜图已暂停')
            try:
                payload = self.client.gallery(hit['gallery_id'])
            except NhentaiApiError as exc:
                if exc.status_code == 404:
                    continue
                raise
            if int(payload.get('id') or 0) != hit['gallery_id']:
                continue
            self._hydrate_tags([payload])
            proof = self._page_proof(snapshot, payload, (body, page) if page and hit['page'] == page else None, cancelled)
            candidate = self._candidate(snapshot, payload, 'image', self._title_score(snapshot, payload), 0, bind, page_proof=proof)
            candidate['image_search'] = {'provider': 'soutubot.moe', 'score': hit['score'], 'sample_page': page,
                                         'matched_page': hit['page'], 'verified': proof['verified'], 'pages': proof['pages']}
            candidates.append(candidate)
        candidates.sort(key=lambda row: (row['automatic_eligible'], row['image_search']['verified'], row['cover'].get('score') or 0), reverse=True)
        if sum(row['automatic_eligible'] for row in candidates) > 1:
            for candidate in candidates:
                candidate.update(eligible=False, automatic_eligible=False, reason='多个版本通过图片核对，请确认语言及版本')
        return candidates, None if candidates else '搜图未找到可用的 nhentai 作品，可更换内页或手动搜索'

    def _page_proof(self, snapshot, payload, initial=None, cancelled=lambda: False):
        proof = {'verified': False, 'pages': []}
        if not self.images or not self.images.archive or not self.covers or not snapshot['file']:
            return proof
        catalog = payload.get('pages') or []
        if len(catalog) != _page_count(payload) or _page_count(payload) != snapshot['work']['page_count']:
            return proof
        try:
            excluded = []
            seen = set()
            for index in range(2):
                if cancelled():
                    raise InterruptedError('内页核对已暂停')
                body, page = initial if index == 0 and initial else self.images.sample(snapshot, 'page', excluded)
                excluded.extend((page - 1, page, page + 1))
                remote = catalog[page - 1]
                path = remote.get('path') if isinstance(remote, dict) else remote
                if not isinstance(path, str):
                    return proof
                local = fingerprint(BytesIO(body))
                identity = (local['phash'], local['dhash'])
                if identity in seen:
                    return proof
                seen.add(identity)
                compared = compare_fingerprints(local, self.covers.remote_fingerprint(path, False))
                proof['pages'].append({'page': page, 'score': compared['score'], 'ratio_match': compared['ratio_match']})
                if compared['score'] < 98 or not compared['ratio_match']:
                    return proof
            proof['verified'] = True
        except NhentaiApiError as exc:
            if exc.status_code == 429:
                raise
        except InterruptedError:
            raise
        except (OSError, ValueError):
            pass
        return proof

    def _rank_candidates(self, snapshot, candidates, bind=None):
        config = snapshot['config']
        ranked = sorted(((self._title_score(snapshot, row), row) for row in candidates), key=lambda pair: pair[0], reverse=True)[:20]
        self._hydrate_tags([row for _, row in ranked])
        prefer = config["language_mode"] == "prefer"
        covers = {row['id']: self._cover(snapshot, row) for score, row in ranked[:10] if score >= 70}
        ranked.sort(key=lambda pair: (pair[0] >= MIN_FUZZY_CONFIDENCE,
                    covers.get(pair[1]['id'], {}).get('similar', False),
                    prefer and _remote_language(pair[1]) == config["language"],
                    covers.get(pair[1]['id'], {}).get('score') or 0, pair[0]), reverse=True)
        result = []
        for score, row in ranked[:10]:
            pool = [other for other, candidate in ranked if candidate["id"] != row["id"]
                    and (not prefer or (_remote_language(candidate) == config["language"]) == (_remote_language(row) == config["language"]))]
            margin = score - max(pool) if pool else 100
            others = [candidate for other, candidate in ranked if candidate['id'] != row['id'] and other >= score - MIN_FUZZY_MARGIN]
            cover = covers.get(row['id'], {'status': 'not_checked', 'score': None, 'reason': '标题匹配不足，未比对封面'})
            compared = [covers.get(candidate['id'], {}) for candidate in others]
            cover_margin = ((cover.get('score') or 0) - max((value.get('score') or 0 for value in compared), default=0)
                            if all(value.get('status') == 'compared' for value in compared) else None)
            candidate = self._candidate(snapshot, row, "fuzzy", score, margin, bind, cover, cover_margin)
            if not candidate['evidence']['local_language'] and any(value.get('similar') and _remote_language(other) != candidate['language']
                    for other, value in zip(others, compared)):
                candidate.update(eligible=False, automatic_eligible=False,
                                 reason='；'.join(filter(None, [candidate['reason'], '多种语言版本封面相似，请确认本地语言'])))
            result.append(candidate)
        return result

    def _hydrate_tags(self, candidates):
        ids = list(dict.fromkeys(int(value) for row in candidates if not row.get("tags") for value in row.get("tag_ids", [])))
        tags = {}
        for start in range(0, len(ids), 100):
            selected = ids[start:start + 100]
            known = self.db.fetchall(f"SELECT remote_id,payload_json FROM remote_tags WHERE remote_id IN ({','.join('?' for _ in selected)})", selected)
            for row in known:
                tag = json.loads(row['payload_json'])
                if isinstance(tag, dict) and tag.get('id') == row['remote_id'] and tag.get('type') and tag.get('name'):
                    tags[row['remote_id']] = tag
            missing = [value for value in selected if value not in tags]
            batch = self.client.tags_by_ids(missing) if missing else []
            tags.update({int(tag["id"]): tag for tag in batch if isinstance(tag, dict) and tag.get("id")})
            if batch:
                self.discover.cache_tags(batch)
        for row in candidates:
            if not row.get("tags"):
                row["tags"] = [tags[value] for value in row.get("tag_ids", []) if value in tags]

    def _cover(self, snapshot, payload):
        return self.covers.compare(snapshot['work'].get('cover_path'), payload) if self.covers else {'status': 'unavailable', 'score': None, 'reason': '本地封面不可用'}

    def _candidate(self, snapshot, payload, source, confidence, margin, bind=None, cover=None, cover_margin=None, page_proof=None):
        work, config = snapshot["work"], snapshot["config"]
        titles = _titles(payload)
        language = _remote_language(payload)
        local_language = _local_language(snapshot)
        page_match = bool(_page_count(payload)) and _page_count(payload) == int(work["page_count"])
        title_score = self._title_score(snapshot, payload)
        cover = self._cover(snapshot, payload) if cover is None else cover
        verified_pages = bool(page_proof and page_proof['verified'])
        visual_identity = bool(cover.get('similar') and page_match and (verified_pages or cover['score'] >= 97 and title_score >= 98)
                               and not any(row['field'] in {'artist', 'group'} and row['source'] in {'manual', 'current'} for row in snapshot['decisions']))
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
        if cover['status'] == 'compared' and not cover.get('similar'):
            automatic.append('封面相似度不足或比例不一致')
        elif (payload.get('thumbnail') or payload.get('cover')) and cover['status'] != 'compared':
            automatic.append('封面尚未完成比对')
        if source in {'fuzzy', 'image'} and cover['status'] == 'compared' and not local_language and not verified_pages:
            automatic.append('本地语言未知，请核对内页')
        if source == 'image' and not verified_pages:
            automatic.append('搜图结果尚未通过两张独立内页核对')
        diffs = []
        decisions = {row["field"]: row for row in snapshot["decisions"]}
        fields = [("title", "标题", work.get("title"), titles["english"] or titles["pretty"] or titles["japanese"]),
                  ("title_japanese", "副标题", work.get("title_japanese"), titles["japanese"]),
                  ("pretty_title", "整理标题", work.get("pretty_title"), titles["pretty"]),
                  ("language", "语言", local_language, language), ("pages", "页数", work["page_count"], _page_count(payload))]
        for kind, label in (("artist", "作者"), ("group", "社团")):
            local = list(dict.fromkeys(tag.get("remote_name") or tag.get("remote_slug") for tag in snapshot["tags"] if tag["tag_type"] == kind))
            decision = decisions.get(kind)
            if decision and decision['source'] in {'manual', 'current'}:
                local = [value.strip() for value in re.split(r'[,，;；\n]+', decision['value'] or '') if value.strip()]
            remote = list(dict.fromkeys(tag.get("name") or tag.get("slug") for tag in payload.get("tags", []) if tag.get("type") == kind))
            if local and remote and not {_normalize_title(v) for v in local} & {_normalize_title(v) for v in remote} and not visual_identity:
                automatic.append(f"{label}不一致")
            fields.append((kind, label, ", ".join(filter(None, local)) or None, ", ".join(filter(None, remote)) or None))
        for field, label, local, remote in fields:
            decision = decisions.get(field)
            protected = bool(decision and decision["source"] in {"manual", "current"})
            local = decision["value"] if protected else local
            diffs.append({"field": field, "label": label, "local": local, "remote": remote,
                          "changed": _text(local) != _text(remote), "protected": protected})
        if source in {'fuzzy', 'image'}:
            if confidence < MIN_FUZZY_CONFIDENCE and not verified_pages:
                automatic.append(f"标题置信度{confidence}%不足")
            if margin < MIN_FUZZY_MARGIN and not (source == 'image' and verified_pages) and not (cover.get('similar') and cover_margin is not None and cover_margin >= 8):
                automatic.append(f"候选仅相差{margin}%")
        reasons = conflicts if source == "manual_id" else automatic
        thumbnail = payload.get("thumbnail")
        thumbnail_path = thumbnail.get("path") if isinstance(thumbnail, dict) else thumbnail if isinstance(thumbnail, str) else None
        return {"gallery_id": int(payload["id"]), "title": titles["english"] or titles["pretty"] or titles["japanese"] or str(payload["id"]),
                "title_japanese": titles["japanese"], "pretty_title": titles["pretty"], "page_count": _page_count(payload),
                "language": language, "source": source, "confidence": confidence, "margin": margin,
                "eligible": not reasons, "automatic_eligible": not automatic, "reason": "；".join(reasons) or None,
                "selectable": not conflicts,
                "cover": cover,
                "evidence": {"title_score": title_score, "page_match": page_match, 'cover_margin': cover_margin,
                             'local_language': local_language, "language_match": bool(local_language and language == local_language),
                             'page_proof': page_proof},
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
                synced = self._apply_one(match, match.get("item_id"))
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

    def _persist(self, snapshot, payload, bind=None, automatic=False, evidence=None):
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
                             (json.dumps({"gallery_id": gallery_id, "bound": bind, **({'evidence': evidence} if evidence else {})}, ensure_ascii=False), item_id))
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

    def queue(self, library_id=None, status="review", q="", page=1, per_page=20):
        states = {"review", "pending", "running", "error", "completed", "ignored", "all"}
        if status not in states:
            raise ValueError("无效的刮削状态")
        page, per_page = max(1, page), max(1, min(50, per_page))
        where = "i.work_id IS NOT NULL AND i.status='ready' AND l.removed_at IS NULL"
        params = []
        if library_id is not None:
            where += " AND i.library_id=?"
            params.append(library_id)
        if q.strip():
            where += " AND (instr(lower(w.title), lower(?)) OR instr(lower(i.relative_path), lower(?)))"
            params.extend([q.strip(), q.strip()])
        source = "FROM library_items i JOIN works w ON w.id=i.work_id JOIN media_libraries l ON l.id=i.library_id"
        counts = {row["status"]: row["n"] for row in self.db.fetchall(
            f"SELECT i.scrape_status AS status, COUNT(*) AS n {source} WHERE {where} GROUP BY i.scrape_status", params)}
        if status != "all":
            where += " AND i.scrape_status=?"
            params.append(status)
        total = self.db.fetchone(f"SELECT COUNT(*) AS n {source} WHERE {where}", params)["n"]
        rows = self.db.fetchall(f"""SELECT i.id, i.work_id, i.library_id, i.relative_path, i.scrape_status,
            i.scrape_retry_at, i.scrape_attempts, i.scrape_result_json, w.title, w.title_japanese, w.pretty_title,
            w.page_count, w.source, w.remote_gallery_id, l.name AS library_name, l.enabled, l.config_json {source} WHERE {where}
            ORDER BY i.id DESC LIMIT ? OFFSET ?""", [*params, per_page, (page - 1) * per_page])
        result = []
        for row in rows:
            snapshot = self._snapshot(row["work_id"], row["id"])
            result.append({**{key: value for key, value in row.items() if key not in {"scrape_result_json", "config_json"}},
                           "result": json.loads(row["scrape_result_json"] or "{}"), "version": snapshot["version"],
                           "config": {key: snapshot["config"][key] for key in ("auto_bind", "language_mode", "language")},
                           "auto_scrape": bool(snapshot["config"]["auto_scrape"]), "auto_bind": bool(snapshot["config"]["auto_bind"])})
        return {"result": result, "total": total, "page": page, "per_page": per_page, "counts": counts,
                "remote": self.client.runtime_stats()}

    def queue_context(self, item_id):
        item = self.db.fetchone("SELECT work_id FROM library_items WHERE id=?", (item_id,))
        if not item or not item["work_id"]:
            raise ValueError("扫描记录不存在")
        snapshot = self._snapshot(item["work_id"], item_id)
        return {"version": snapshot["version"]}

    def decide(self, item_id, action, version):
        if action not in {"retry", "dismiss", "complete"}:
            raise ValueError("无效的审批操作")
        with self.db.connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            item = conn.execute("SELECT work_id, scrape_status, status FROM library_items WHERE id=?", (item_id,)).fetchone()
            if not item or not item["work_id"] or item["status"] != "ready":
                raise ValueError("扫描记录不可用")
            snapshot = self._snapshot(item["work_id"], item_id, conn)
            if snapshot["version"] != version:
                raise ValueError("作品或设置已变化，请刷新后再操作")
            if item["scrape_status"] == "running":
                raise ValueError("当前作品正在刮削，请等待本次完成")
            if action == "retry" and (not snapshot["file"]["enabled"] or not snapshot["config"]["auto_scrape"]):
                raise ValueError("请先在媒体库设置中启用自动刮削，或直接手动搜索")
            status = {"retry": "pending", "dismiss": "ignored", "complete": "completed"}[action]
            conn.execute("UPDATE library_items SET scrape_status=?, scrape_retry_at=0, scrape_attempts=0, scrape_result_json=? WHERE id=?",
                         (status, json.dumps({"reason": {"retry": "等待重新刮削", "dismiss": "已跳过自动匹配", "complete": "已手动确认元数据"}[action]}, ensure_ascii=False), item_id))
        return {"status": status}

    def tick(self):
        batch = self.db.fetchone("SELECT id,status FROM jobs WHERE type='metadata_scrape' AND status IN ('queued','running','paused','cancelling') ORDER BY id LIMIT 1")
        if batch and batch['status'] == 'cancelling':
            self.jobs.mark_cancelled(batch['id'])
            return
        if self._retry_at > time.time() or not self.client.api_key:
            return
        if batch:
            if batch['status'] != 'paused':
                self.run_batch(batch['id'])
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
            with self.client.background_requests(self._closing.is_set):
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

    def enqueue_batch(self, work_ids, reverse_images=False):
        ids = list(dict.fromkeys(int(value) for value in work_ids))
        if not ids or len(ids) > 5000 or any(not 0 < value <= 9223372036854775807 for value in ids):
            raise ValueError('请选取1至5000部作品')
        if not self.client.api_key:
            raise ValueError('请先配置远端API')
        target = {'work_ids': ids, 'cursor': 0, 'updated': 0, 'review': 0, 'skipped_count': 0,
                  'reverse_images': bool(reverse_images), 'title': '批量刮削与远端绑定'}
        with self.db.connect() as conn:
            conn.execute('BEGIN IMMEDIATE')
            active = conn.execute("SELECT id FROM jobs WHERE type='metadata_scrape' AND status IN ('queued','running','paused','cancelling') LIMIT 1").fetchone()
            if active:
                raise ValueError('已有批量刮削任务，请先完成或取消')
            job_id = conn.execute("INSERT INTO jobs(type,status,stage,target_json) VALUES ('metadata_scrape','queued','queued',?) RETURNING id",
                                  (json.dumps(target, ensure_ascii=False),)).fetchone()['id']
            self.jobs._log_with_conn(conn, job_id, 'info', f'准备核对{len(ids)}部作品；仅绑定证据充分的匹配')
        return self.jobs.get(job_id)

    def resume_job(self, job_id):
        return self.jobs.resume(job_id)

    def retry_job(self, job_id):
        if self.jobs.get(job_id)['status'] != 'failed':
            raise ValueError('仅失败的任务可以重试')
        return self.jobs.retry(job_id)

    def cancel_job(self, job_id):
        return self.jobs.cancel(job_id)

    def _batch_checkpoint(self, job_id):
        while True:
            status = self.db.fetchone('SELECT status FROM jobs WHERE id=?', (job_id,))
            if self._closing.is_set() or not status or status['status'] in {'cancelled', 'cancelling'}:
                raise JobCancelled()
            if status['status'] != 'paused':
                return
            self._closing.wait(.2)

    def _batch_interrupted(self, job_id):
        status = self.db.fetchone('SELECT status FROM jobs WHERE id=?', (job_id,))
        return self._closing.is_set() or not status or status['status'] in {'paused', 'cancelled', 'cancelling'}

    def run_batch(self, job_id):
        target = self.jobs.get(job_id)['target']
        ids = target['work_ids']
        snapshot = None
        try:
            for index in range(target.get('cursor', 0), len(ids)):
                while True:
                    self._batch_checkpoint(job_id)
                    retry_at = self.jobs.get(job_id)['target'].get('retry_at', 0)
                    if retry_at > time.time():
                        self.jobs.mark_running(job_id, 'remote_cooldown', index, len(ids))
                        while time.time() < retry_at:
                            self._batch_checkpoint(job_id)
                            self._closing.wait(min(.5, max(0, retry_at - time.time())))
                    self.jobs.mark_running(job_id, 'matching_metadata', index, len(ids))
                    snapshot = None
                    candidates = []
                    try:
                        snapshot = self._snapshot(ids[index])
                        if snapshot['work'].get('remote_gallery_id'):
                            outcome, reason = 'skipped_count', '已有远端绑定，保留当前作品'
                        elif not snapshot['file'] or not snapshot['file']['library_item_id'] or snapshot['file']['source_status'] != 'ready' or not snapshot['file']['enabled']:
                            outcome, reason = 'skipped_count', '源文件索引未就绪或媒体库已停用'
                        else:
                            item_id = snapshot['file']['library_item_id']
                            claimed = self.db.execute("UPDATE library_items SET scrape_status='running' WHERE id=? AND scrape_status NOT IN ('ignored','running')", (item_id,)).rowcount
                            if not claimed:
                                outcome, reason = 'skipped_count', '保留已跳过或正在处理的记录'
                            else:
                                with self.client.background_requests(lambda: self._batch_interrupted(job_id)):
                                    candidates, reason = self._candidates(snapshot, bind=True)
                                    match = candidates[0] if candidates else None
                                    if match and match['cover'].get('similar') and match['evidence']['page_match'] and not match['evidence']['local_language']:
                                        payload = self.client.gallery(match['gallery_id'])
                                        if int(payload.get('id') or 0) != match['gallery_id']:
                                            raise ValueError('远端返回的作品ID不一致')
                                        proof = self._page_proof(snapshot, payload, cancelled=lambda: self._batch_interrupted(job_id))
                                        match = self._candidate(snapshot, payload, match['source'], self._title_score(snapshot, payload), match['margin'], True,
                                                                cover_margin=match['evidence'].get('cover_margin'), page_proof=proof)
                                        candidates[0] = match
                                    if target.get('reverse_images') and (not match or not match['automatic_eligible']):
                                        self.jobs.mark_running(job_id, 'matching_images', index, len(ids))
                                        for mode in ('cover', 'page'):
                                            try:
                                                images, image_reason = self._image_candidates(snapshot, mode, True, lambda: self._batch_interrupted(job_id))
                                            except ImageSearchError as exc:
                                                if exc.retry_after:
                                                    raise
                                                reason = str(exc)
                                                break
                                            except (OSError, ValueError) as exc:
                                                if isinstance(exc, InterruptedError):
                                                    raise
                                                reason = str(exc)
                                                continue
                                            if images:
                                                candidates = images + [row for row in candidates if row['gallery_id'] not in {value['gallery_id'] for value in images}]
                                                match = candidates[0]
                                            reason = image_reason or (match['reason'] if match else reason)
                                            if match and match['automatic_eligible']:
                                                break
                                    if match and match['automatic_eligible'] and match.get('cover', {}).get('similar'):
                                        payload = self.client.gallery(match['gallery_id'], fresh=True)
                                        if int(payload.get('id') or 0) != match['gallery_id']:
                                            raise ValueError('远端返回的作品ID不一致')
                                        proof = self._page_proof(snapshot, payload, cancelled=lambda: self._batch_interrupted(job_id)) if (match['evidence'].get('page_proof') or {}).get('verified') else None
                                        checked = self._candidate(snapshot, payload, match['source'], min(match['confidence'], self._title_score(snapshot, payload)), match['margin'], True,
                                                                  cover_margin=match['evidence'].get('cover_margin'), page_proof=proof)
                                        if not checked['automatic_eligible'] or not checked['cover'].get('similar'):
                                            raise ValueError(checked['reason'] or '封面复核未通过')
                                        self._batch_checkpoint(job_id)
                                        self._persist(snapshot, payload, bind=True, evidence={'source': match['source'], 'cover': checked['cover'],
                                                      'title_score': checked['evidence']['title_score'], 'page_proof': proof,
                                                      'image_search': match.get('image_search')})
                                        outcome, reason = 'updated', f'已刮削并绑定远端 #{match["gallery_id"]}'
                                    else:
                                        reason = '；'.join(dict.fromkeys(filter(None, [reason, match.get('reason') if match else None])))
                                        self._finish_attempt(snapshot, 'review', {'candidates': candidates, 'reason': reason or '匹配证据不足，保留人工确认'}, on_changed='review')
                                        outcome = 'review'
                        break
                    except InterruptedError:
                        if snapshot and snapshot['file']:
                            self.db.execute("UPDATE library_items SET scrape_status='pending' WHERE id=? AND scrape_status='running'", (snapshot['file']['library_item_id'],))
                        self._batch_checkpoint(job_id)
                    except (NhentaiApiError, ImageSearchError) as exc:
                        if (isinstance(exc, NhentaiApiError) and exc.status_code == 429) or (isinstance(exc, ImageSearchError) and exc.retry_after):
                            delay = max(30, exc.retry_after or 60)
                            with self.db.connect() as conn:
                                current = json.loads(conn.execute('SELECT target_json FROM jobs WHERE id=?', (job_id,)).fetchone()[0])
                                current['retry_at'] = time.time() + delay
                                conn.execute('UPDATE jobs SET target_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', (json.dumps(current, ensure_ascii=False), job_id))
                                self.jobs._log_with_conn(conn, job_id, 'info', f'{str(exc)[:300]}；等待{delay}秒后重试当前作品')
                            if snapshot and snapshot['file']:
                                self.db.execute("UPDATE library_items SET scrape_status='pending' WHERE id=? AND scrape_status='running'", (snapshot['file']['library_item_id'],))
                            continue
                        raise
                    except ValueError as exc:
                        outcome, reason = 'review', str(exc)
                        if snapshot and snapshot['file'] and snapshot['file']['library_item_id']:
                            self._finish_attempt(snapshot, 'review', {'reason': reason, 'candidates': candidates}, on_changed='review')
                        break
                self._batch_checkpoint(job_id)
                with self.db.connect() as conn:
                    current = json.loads(conn.execute('SELECT target_json FROM jobs WHERE id=?', (job_id,)).fetchone()[0])
                    current.pop('retry_at', None)
                    current.update(cursor=index + 1)
                    current[outcome] = current.get(outcome, 0) + 1
                    conn.execute('UPDATE jobs SET target_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', (json.dumps(current, ensure_ascii=False), job_id))
                    self.jobs._log_with_conn(conn, job_id, 'info', f'作品 #{ids[index]}：{reason or "保留人工确认"}')
                self.jobs.update_progress(job_id, 'running', 'matching_metadata', index + 1, len(ids))
            self.jobs.complete(job_id)
        except JobCancelled:
            if not self._closing.is_set():
                self.jobs.mark_cancelled(job_id)
        except Exception as exc:
            self.jobs.fail(job_id, str(exc)[:1000])
        finally:
            if snapshot and snapshot['file']:
                self.db.execute("UPDATE library_items SET scrape_status='pending' WHERE id=? AND scrape_status='running'", (snapshot['file']['library_item_id'],))

    def _finish_attempt(self, snapshot, status, result, delay=0, on_changed='pending'):
        item_id, work_id = snapshot["file"]["library_item_id"], snapshot["work"]["id"]
        with self.db.connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            try:
                current = self._snapshot(work_id, item_id, conn)
            except ValueError:
                return
            if current["version"] != snapshot["version"]:
                conn.execute("UPDATE library_items SET scrape_status=?,scrape_result_json=? WHERE id=? AND scrape_status='running'",
                             (on_changed, json.dumps({'reason': '作品或设置在查询期间变化，请重新核对'}, ensure_ascii=False), item_id))
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


def _local_language(snapshot):
    language = _language(snapshot['work'].get('language') or snapshot['metadata'].get('LanguageISO'))
    if language:
        return language
    titles = ' '.join(str(value or '') for value in (snapshot['work'].get('title'), snapshot['metadata'].get('Title')))
    detected = {language for pattern, language in ((r'\[(?:Chinese|中文|汉化|漢化)\]', 'chinese'),
                (r'\[English\]', 'english'), (r'\[(?:Japanese|日本語)\]', 'japanese')) if re.search(pattern, titles, re.I)}
    return next(iter(detected)) if len(detected) == 1 else None


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
