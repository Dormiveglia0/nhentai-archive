from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    data_dir: Path = Path(os.environ.get("NH_ARCHIVE_DATA_DIR", ".local-data"))
    database_path: Path | None = None
    nhentai_base_url: str = os.environ.get("NHENTAI_BASE_URL", "https://nhentai.net")
    nhentai_api_key: str | None = os.environ.get("NHENTAI_API_KEY")
    user_agent: str = os.environ.get(
        "NH_ARCHIVE_USER_AGENT",
        "NHArchive/0.1 (+local-first personal archive)",
    )
    request_timeout: int = int(os.environ.get("NH_ARCHIVE_REQUEST_TIMEOUT", "30"))

    def __post_init__(self) -> None:
        database_path = self.database_path or self.data_dir / "archive.db"
        object.__setattr__(self, "data_dir", Path(self.data_dir))
        object.__setattr__(self, "database_path", Path(database_path))

    @property
    def library_dir(self) -> Path:
        return self.data_dir / "library"

    @property
    def covers_dir(self) -> Path:
        return self.data_dir / "covers"

    @property
    def page_cache_dir(self) -> Path:
        return self.data_dir / "pages"

    @property
    def thumbs_dir(self) -> Path:
        return self.data_dir / "thumbs"

    @property
    def tmp_dir(self) -> Path:
        return self.data_dir / "tmp"

    @property
    def export_dir(self) -> Path:
        return self.data_dir / "exports"

    @property
    def export_jobs_dir(self) -> Path:
        return self.tmp_dir / "exports"

    def ensure_directories(self) -> None:
        for path in (
            self.data_dir,
            self.library_dir,
            self.covers_dir,
            self.page_cache_dir,
            self.thumbs_dir,
            self.tmp_dir,
            self.export_dir,
            self.export_jobs_dir,
        ):
            path.mkdir(parents=True, exist_ok=True)


def load_settings() -> Settings:
    settings = Settings()
    if "NH_ARCHIVE_DATA_DIR" not in os.environ and not settings.data_dir.exists():
        for legacy in (Path("backend/.local-data"), Path("apps/api/.local-data")):
            if legacy.exists():
                legacy.replace(settings.data_dir)
                break
    settings.ensure_directories()
    return settings
