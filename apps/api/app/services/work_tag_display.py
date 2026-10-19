from typing import Any

from app.services.dictionary_service import normalize_key

STATUS_RANK = {None: 0, "suggested": 1, "configured": 1, "ignored": 1, "review": 2, "conflict": 3}


def visible_work_tags(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Merge repeated labels for display while retaining the stored source rows."""
    translations = {}
    for row in rows:
        if row.get("zh_name"):
            for name in (row.get("remote_name"), row.get("remote_slug")):
                if name:
                    translations.setdefault((row.get("work_id"), row.get("tag_type") or "tag", normalize_key(name)), set()).add(row["zh_name"].strip())
    result = {}
    for row in sorted(rows, key=lambda row: (row.get("remote_tag_id") is None, not row.get("dictionary_id"))):
        kind = row.get("tag_type") or "tag"
        name = row.get("remote_name") or row.get("remote_slug") or str(row.get("remote_tag_id") or "")
        candidates = translations.get((row.get("work_id"), kind, normalize_key(name)), set())
        display = (row.get("zh_name") or (next(iter(candidates)) if len(candidates) == 1 else name)).strip()
        identity = (row.get("work_id"), kind, normalize_key(display))
        if identity not in result:
            result[identity] = {**row, "display": display}
        else:
            current = result[identity]
            # 合并展示仍保留最需要处理的词典状态。
            if row.get("dictionary_id") and (not current.get("dictionary_id") or STATUS_RANK.get(row.get("dictionary_status"), 1) > STATUS_RANK.get(current.get("dictionary_status"), 1)):
                for key in ("dictionary_id", "zh_name", "dictionary_status", "ignored"):
                    current[key] = row.get(key)
    return list(result.values())
