from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _bool_env(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    app_name: str = "NHentai Archive Platform"
    data_dir: Path = Path(os.getenv("DATA_DIR", "data"))
    database_path: Path = Path(os.getenv("DATABASE_PATH", "data/app.db"))
    library_dir: Path = Path(os.getenv("LIBRARY_DIR", "data/library"))
    admin_username: str = os.getenv("ADMIN_USERNAME", "admin")
    admin_password: str = os.getenv("ADMIN_PASSWORD", "admin")
    secret_key: str = os.getenv("SECRET_KEY", "change-me-before-public-deploy")
    cors_origins: tuple[str, ...] = tuple(
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
        if origin.strip()
    )
    request_timeout: float = float(os.getenv("REQUEST_TIMEOUT", "30"))
    request_retries: int = int(os.getenv("REQUEST_RETRIES", "3"))
    request_interval_seconds: float = float(os.getenv("REQUEST_INTERVAL_SECONDS", "0.8"))
    download_concurrency: int = int(os.getenv("DOWNLOAD_CONCURRENCY", "2"))
    target_language: str = os.getenv("TARGET_LANGUAGE", "ZH")
    translation_provider: str = os.getenv("TRANSLATION_PROVIDER", "none")
    deepl_api_key: str | None = os.getenv("DEEPL_API_KEY")
    deepl_api_url: str = os.getenv("DEEPL_API_URL", "https://api-free.deepl.com/v2/translate")
    google_translate_api_key: str | None = os.getenv("GOOGLE_TRANSLATE_API_KEY")
    require_authorized_use_ack: bool = _bool_env("REQUIRE_AUTHORIZED_USE_ACK", True)

    def ensure_dirs(self) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.library_dir.mkdir(parents=True, exist_ok=True)


settings = Settings()
