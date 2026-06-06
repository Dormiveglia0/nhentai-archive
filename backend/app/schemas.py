from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    token: str
    username: str


class ImportRequest(BaseModel):
    ids: list[int] = Field(default_factory=list)
    authorized_use_ack: bool = False


class SearchResponse(BaseModel):
    result: list[dict[str, Any]]


class TaskResponse(BaseModel):
    id: int
    gallery_id: int
    status: str
    title: str | None = None
    error: str | None = None
    progress_current: int
    progress_total: int
    cbz_path: str | None = None
    created_at: str
    updated_at: str


class DictionaryEntry(BaseModel):
    id: int
    source_type: str
    source_text: str
    translated_text: str
    enabled: bool


class DictionaryUpsert(BaseModel):
    source_type: str = "tag"
    source_text: str
    translated_text: str
    enabled: bool = True


class SuggestionRequest(BaseModel):
    items: list[dict[str, str]]
    provider: Literal["deepl", "google"] | None = None


class SuggestionResponse(BaseModel):
    id: int
    source_type: str
    source_text: str
    suggested_text: str
    provider: str
    status: str


class SettingsUpdate(BaseModel):
    translate_tags: bool | None = None
    translate_titles: bool | None = None
    translation_provider: Literal["none", "deepl", "google"] | None = None
