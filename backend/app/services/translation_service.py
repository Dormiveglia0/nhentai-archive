from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

GOOGLE_FREE = "google_free"
DEEPL = "deepl"
SUPPORTED_PROVIDERS = (GOOGLE_FREE, DEEPL)

_USER_AGENT = "NHArchive/1.0 (+local machine translation)"


class TranslationError(Exception):
    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _http_get_json(url: str, *, headers: dict[str, str] | None = None, timeout: int = 15) -> Any:
    request = urllib.request.Request(url, headers={"User-Agent": _USER_AGENT, **(headers or {})})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise TranslationError(f"翻译服务返回 {exc.code}", status_code=exc.code) from exc
    except urllib.error.URLError as exc:
        raise TranslationError(f"无法连接翻译服务：{exc.reason}") from exc
    except json.JSONDecodeError as exc:
        raise TranslationError("翻译服务返回了非 JSON 响应") from exc


def _http_post_form(url: str, fields: list[tuple[str, str]], *, headers: dict[str, str] | None = None, timeout: int = 15) -> Any:
    body = urllib.parse.urlencode(fields).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        headers={
            "User-Agent": _USER_AGENT,
            "Content-Type": "application/x-www-form-urlencoded",
            **(headers or {}),
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise TranslationError(f"翻译服务返回 {exc.code}", status_code=exc.code) from exc
    except urllib.error.URLError as exc:
        raise TranslationError(f"无法连接翻译服务：{exc.reason}") from exc
    except json.JSONDecodeError as exc:
        raise TranslationError("翻译服务返回了非 JSON 响应") from exc


class TranslationService:
    """Provider-adapter machine translation over the local settings table.

    Two providers: `google_free` (unofficial endpoint, no key) and `deepl`
    (REST API, auth key in settings). Reads/writes its config under the `mt.*`
    settings keys; never echoes the DeepL key back through public_config()."""

    def __init__(self, db: Any, *, env_deepl_key: str | None = None, timeout: int = 15):
        self.db = db
        self.env_deepl_key = env_deepl_key
        self.timeout = timeout

    # ---- config -----------------------------------------------------------

    def config(self) -> dict[str, Any]:
        provider = self._get("mt.provider") or GOOGLE_FREE
        if provider not in SUPPORTED_PROVIDERS:
            provider = GOOGLE_FREE
        try:
            batch_limit = int(self._get("mt.batch_limit") or 20)
        except (TypeError, ValueError):
            batch_limit = 20
        return {
            "provider": provider,
            "deepl_api_key": self.env_deepl_key or self._get("mt.deepl_api_key"),
            "deepl_key_source": "env" if self.env_deepl_key else ("db" if self._get("mt.deepl_api_key") else "none"),
            "deepl_plan": self._get("mt.deepl_plan") or "free",
            "target_lang": self._get("mt.target_lang") or "zh-CN",
            "batch_limit": max(1, min(batch_limit, 50)),
        }

    def public_config(self) -> dict[str, Any]:
        cfg = self.config()
        return {
            "provider": cfg["provider"],
            "deepl_api_key_configured": bool(cfg["deepl_api_key"]),
            "deepl_key_source": cfg["deepl_key_source"],
            "deepl_plan": cfg["deepl_plan"],
            "target_lang": cfg["target_lang"],
            "batch_limit": cfg["batch_limit"],
            "last_verify": self._get_json("mt.last_verify"),
        }

    # ---- translation ------------------------------------------------------

    def translate(self, texts: list[str], source: str = "en", target: str | None = None) -> list[str]:
        items = [text for text in texts]
        if not items:
            return []
        cfg = self.config()
        target = target or cfg["target_lang"]
        if cfg["provider"] == DEEPL:
            return self._deepl(items, source, target, cfg)
        return self._google_free(items, source, target)

    def translate_one(self, text: str, source: str = "en", target: str | None = None) -> str:
        result = self.translate([text], source, target)
        return result[0] if result else ""

    def verify(self) -> dict[str, Any]:
        provider = self.config()["provider"]
        try:
            sample = self.translate_one("good morning")
            ok = bool(sample.strip())
            result = {
                "ok": ok,
                "provider": provider,
                "sample": sample,
                "status_code": 200 if ok else None,
                "message": "翻译连接正常" if ok else "翻译返回为空",
            }
        except TranslationError as exc:
            result = {"ok": False, "provider": provider, "sample": None, "status_code": exc.status_code, "message": exc.message}
        self._set("mt.last_verify", json.dumps(result, ensure_ascii=False))
        return result

    # ---- providers --------------------------------------------------------

    def _google_free(self, texts: list[str], source: str, target: str) -> list[str]:
        tl = "zh-CN" if target.lower() in {"zh", "zh-cn", "zh_cn"} else target
        out: list[str] = []
        for text in texts:
            params = urllib.parse.urlencode({"client": "gtx", "sl": source, "tl": tl, "dt": "t", "q": text})
            url = f"https://translate.googleapis.com/translate_a/single?{params}"
            data = _http_get_json(url, timeout=self.timeout)
            out.append(_join_google_segments(data))
        return out

    def _deepl(self, texts: list[str], source: str, target: str, cfg: dict[str, Any]) -> list[str]:
        key = cfg["deepl_api_key"]
        if not key:
            raise TranslationError("DeepL API Key 未配置")
        base = "https://api.deepl.com" if cfg["deepl_plan"] == "pro" else "https://api-free.deepl.com"
        url = f"{base}/v2/translate"
        target_lang = "ZH" if target.lower().startswith("zh") else target.upper()
        # DeepL 自动检测源语言:留空 source_lang，不可传 "AUTO"。
        fields: list[tuple[str, str]] = [("target_lang", target_lang)]
        if source.lower() not in {"auto", ""}:
            fields.append(("source_lang", source.upper()))
        fields.extend(("text", text) for text in texts)
        data = _http_post_form(url, fields, headers={"Authorization": f"DeepL-Auth-Key {key}"}, timeout=self.timeout)
        translations = data.get("translations") if isinstance(data, dict) else None
        if not isinstance(translations, list):
            raise TranslationError("DeepL 返回结构异常")
        return [str(item.get("text", "")) for item in translations]

    # ---- settings table helpers ------------------------------------------

    def _get(self, key: str) -> str | None:
        row = self.db.fetchone("SELECT value FROM settings WHERE key = ?", (key,))
        return row["value"] if row else None

    def _get_json(self, key: str) -> dict[str, Any] | None:
        value = self._get(key)
        if not value:
            return None
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            return None

    def _set(self, key: str, value: str) -> None:
        self.db.execute(
            """
            INSERT INTO settings (key, value, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
            """,
            (key, value),
        )


def _join_google_segments(data: Any) -> str:
    """Google's free endpoint returns [[[chunk, src, ...], ...], ...]."""
    try:
        segments = data[0] or []
        return "".join(segment[0] for segment in segments if segment and segment[0])
    except (IndexError, TypeError):
        return ""
