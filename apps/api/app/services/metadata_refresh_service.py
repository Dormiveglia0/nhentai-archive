from __future__ import annotations

import re
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

from app.database import Database
from app.services import comicinfo
from app.services.dictionary_service import DictionaryService
from app.services.discover_service import DiscoverService
from app.services.nhentai_client import NhentaiApiError, NhentaiClient


MAX_BATCH = 50
MIN_FUZZY_CONFIDENCE = 92
MIN_FUZZY_MARGIN = 7
MATCH_SOURCES = {"remote_id", "web", "manual_id", "fuzzy"}


class MetadataRefreshService:
    def __init__(
        self,
        db: Database,
        client: NhentaiClient,
        discover: DiscoverService,
        dictionary: DictionaryService,
    ):
        self.db = db
        self.client = client
        self.discover = discover
        self.dictionary = dictionary

    def preview(self, work_ids: list[int], gallery_ids: dict[int, int] | None = None) -> dict[str, Any]:
        works = self._works(work_ids)
        overrides = {int(key): int(value) for key, value in (gallery_ids or {}).items() if int(value) > 0}
        source_paths = self._source_paths([int(work["id"]) for work in works])
        result = []
        for work in works:
            try:
                match, reason = self._match(work, source_paths.get(int(work["id"])), overrides.get(int(work["id"])))
                result.append({"work": self._work_summary(work), "match": match, "reason": reason})
            except NhentaiApiError as exc:
                result.append({"work": self._work_summary(work), "match": None, "reason": exc.message})

        ready = [row for row in result if row["match"] and row["match"]["eligible"]]
        return {
            "result": result,
            "summary": {
                "works": len(result),
                "ready": len(ready),
                "exact": sum(1 for row in ready if row["match"]["source"] != "fuzzy"),
                "fuzzy": sum(1 for row in ready if row["match"]["source"] == "fuzzy"),
                "review": sum(1 for row in result if row["match"] and not row["match"]["eligible"]),
                "unmatched": sum(1 for row in result if not row["match"]),
            },
        }

    def apply(self, matches: list[dict[str, Any]]) -> dict[str, Any]:
        if not matches:
            raise ValueError("没有可刷新的远端匹配。")
        if len(matches) > MAX_BATCH:
            raise ValueError(f"单次最多刷新 {MAX_BATCH} 部作品。")

        seen: set[int] = set()
        result = []
        for match in matches:
            work_id = int(match.get("work_id") or 0)
            gallery_id = int(match.get("gallery_id") or 0)
            source = str(match.get("source") or "")
            if work_id <= 0 or gallery_id <= 0 or source not in MATCH_SOURCES or work_id in seen:
                result.append({"work_id": work_id, "gallery_id": gallery_id, "status": "skipped", "reason": "无效或重复的匹配"})
                continue
            seen.add(work_id)
            work = self.db.fetchone("SELECT * FROM works WHERE id = ?", (work_id,))
            if not work:
                result.append({"work_id": work_id, "gallery_id": gallery_id, "status": "skipped", "reason": "本地作品不存在"})
                continue
            conflict = self._linked_work(work_id, gallery_id)
            if conflict:
                result.append({"work_id": work_id, "gallery_id": gallery_id, "status": "skipped", "reason": f"远端作品已关联本地作品 #{conflict}"})
                continue
            try:
                payload = self.client.gallery(gallery_id, include="related", fresh=True)
                if int(payload.get("id") or 0) != gallery_id:
                    raise ValueError("远端返回的作品 ID 不一致")
                if source == "fuzzy" and not self._safe_fuzzy_apply(work, payload):
                    result.append({"work_id": work_id, "gallery_id": gallery_id, "status": "skipped", "reason": "模糊匹配置信度不足或候选不唯一"})
                    continue
                synced = self._persist(work, payload)
                result.append({"work_id": work_id, "gallery_id": gallery_id, "status": "updated", **synced})
            except Exception as exc:  # 单部失败不能中断整批刷新。
                result.append({"work_id": work_id, "gallery_id": gallery_id, "status": "error", "reason": str(exc)})

        return {
            "result": result,
            "summary": {
                "works": len(result),
                "updated": sum(1 for row in result if row["status"] == "updated"),
                "skipped": sum(1 for row in result if row["status"] == "skipped"),
                "errors": sum(1 for row in result if row["status"] == "error"),
            },
        }

    def _match(
        self,
        work: dict[str, Any],
        source_path: str | None,
        override_gallery_id: int | None,
    ) -> tuple[dict[str, Any] | None, str | None]:
        gallery_id = override_gallery_id
        source = "manual_id" if gallery_id else ""
        if not gallery_id and work.get("remote_gallery_id"):
            gallery_id = int(work["remote_gallery_id"])
            source = "remote_id"
        if not gallery_id and source_path:
            gallery_id = comicinfo.gallery_id_from_cbz(Path(source_path))
            source = "web" if gallery_id else ""

        if gallery_id:
            conflict = self._linked_work(int(work["id"]), gallery_id)
            if conflict:
                return None, f"远端作品 #{gallery_id} 已关联本地作品 #{conflict}"
            payload = self.client.gallery(gallery_id, include="related")
            return self._match_result(payload, source, 100, 100, True, None), None

        query = self._search_title(work)
        if len(_normalize_title(query).replace(" ", "")) < 3:
            return None, "标题关键词过短，请输入远端作品 ID"
        payload = self.client.search(query, page=1, per_page=10, sort="date")
        candidates = payload.get("result", []) if isinstance(payload, dict) else []
        ranked = sorted(
            ((self._title_score(work, candidate), candidate) for candidate in candidates if isinstance(candidate, dict)),
            key=lambda item: item[0],
            reverse=True,
        )
        if not ranked:
            return None, "未找到远端候选"
        confidence, candidate = ranked[0]
        margin = confidence - ranked[1][0] if len(ranked) > 1 else 100
        page_match = _page_count(candidate) > 0 and _page_count(candidate) == int(work.get("page_count") or 0)
        eligible = confidence >= MIN_FUZZY_CONFIDENCE and margin >= MIN_FUZZY_MARGIN and (page_match or confidence >= 97)
        reason = None
        if confidence < MIN_FUZZY_CONFIDENCE:
            reason = f"标题置信度 {confidence}% 低于 {MIN_FUZZY_CONFIDENCE}%"
        elif margin < MIN_FUZZY_MARGIN:
            reason = f"前两名候选仅相差 {margin}%，需要人工指定作品 ID"
        elif not page_match and confidence < 97:
            reason = "标题未达到强一致且页数不同，需要人工指定作品 ID"
        return self._match_result(candidate, "fuzzy", confidence, margin, eligible, reason), reason

    def _safe_fuzzy_apply(self, work: dict[str, Any], payload: dict[str, Any]) -> bool:
        search = self.client.search(self._search_title(work), page=1, per_page=10, sort="date")
        candidates = search.get("result", []) if isinstance(search, dict) else []
        ranked = sorted(
            ((self._title_score(work, candidate), candidate) for candidate in candidates if isinstance(candidate, dict)),
            key=lambda item: item[0],
            reverse=True,
        )
        if not ranked or int(ranked[0][1].get("id") or 0) != int(payload.get("id") or 0):
            return False
        confidence = ranked[0][0]
        margin = confidence - ranked[1][0] if len(ranked) > 1 else 100
        page_match = _page_count(payload) > 0 and _page_count(payload) == int(work.get("page_count") or 0)
        return (
            confidence >= MIN_FUZZY_CONFIDENCE
            and margin >= MIN_FUZZY_MARGIN
            and (page_match or confidence >= 97)
        )

    def _persist(self, work: dict[str, Any], payload: dict[str, Any]) -> dict[str, int]:
        gallery_id = int(payload["id"])
        titles = _titles(payload)
        tags = [tag for tag in payload.get("tags", []) if isinstance(tag, dict) and tag.get("id") is not None]
        self.discover.cache_gallery(payload)
        self.discover.cache_tags(tags)
        tag_result = self.dictionary.sync_work_tags(int(work["id"]), tags)
        self.db.execute(
            """
            UPDATE works
            SET remote = 'nhentai', remote_gallery_id = ?, media_id = ?,
                title = ?, title_japanese = ?, pretty_title = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (
                gallery_id,
                payload.get("media_id"),
                titles["english"] or work.get("title") or str(gallery_id),
                titles["japanese"] or work.get("title_japanese"),
                titles["pretty"] or work.get("pretty_title"),
                int(work["id"]),
            ),
        )
        return {"tags": int(tag_result["linked"]), "removed_tags": int(tag_result["removed"])}

    def _works(self, work_ids: list[int]) -> list[dict[str, Any]]:
        ids = list(dict.fromkeys(int(value) for value in work_ids if int(value) > 0))
        if not ids:
            raise ValueError("请至少选择一部作品。")
        if len(ids) > MAX_BATCH:
            raise ValueError(f"单次最多预览 {MAX_BATCH} 部作品。")
        placeholders = ",".join("?" for _ in ids)
        rows = self.db.fetchall(f"SELECT * FROM works WHERE id IN ({placeholders})", ids)
        by_id = {int(row["id"]): row for row in rows}
        return [by_id[work_id] for work_id in ids if work_id in by_id]

    def _source_paths(self, work_ids: list[int]) -> dict[int, str]:
        if not work_ids:
            return {}
        placeholders = ",".join("?" for _ in work_ids)
        rows = self.db.fetchall(
            f"SELECT work_id, path FROM work_files WHERE kind = 'source_cbz' AND work_id IN ({placeholders}) "
            "ORDER BY work_id, created_at DESC, id DESC",
            work_ids,
        )
        paths: dict[int, str] = {}
        for row in rows:
            paths.setdefault(int(row["work_id"]), str(row["path"]))
        return paths

    def _linked_work(self, work_id: int, gallery_id: int) -> int | None:
        row = self.db.fetchone(
            "SELECT id FROM works WHERE remote_gallery_id = ? AND id <> ?",
            (gallery_id, work_id),
        )
        return int(row["id"]) if row else None

    def _title_score(self, work: dict[str, Any], payload: dict[str, Any]) -> int:
        local = _title_variants(work.get("title"), work.get("title_japanese"), work.get("pretty_title"))
        remote = _title_variants(*_titles(payload).values())
        if not local or not remote:
            return 0
        return round(max(SequenceMatcher(None, left, right).ratio() for left in local for right in remote) * 100)

    @staticmethod
    def _search_title(work: dict[str, Any]) -> str:
        title = str(work.get("title") or work.get("title_japanese") or work.get("pretty_title") or "").strip()
        return re.sub(r"\s*\[\d+\]\s*$", "", title).strip()

    @staticmethod
    def _work_summary(work: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": int(work["id"]),
            "title": work.get("title"),
            "source": work.get("source"),
            "remote_gallery_id": work.get("remote_gallery_id"),
            "page_count": int(work.get("page_count") or 0),
        }

    @staticmethod
    def _match_result(
        payload: dict[str, Any],
        source: str,
        confidence: int,
        margin: int,
        eligible: bool,
        reason: str | None,
    ) -> dict[str, Any]:
        titles = _titles(payload)
        return {
            "gallery_id": int(payload["id"]),
            "title": titles["english"] or titles["pretty"] or titles["japanese"] or str(payload["id"]),
            "title_japanese": titles["japanese"],
            "pretty_title": titles["pretty"],
            "page_count": _page_count(payload),
            "source": source,
            "confidence": confidence,
            "margin": margin,
            "eligible": eligible,
            "reason": reason,
        }


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
