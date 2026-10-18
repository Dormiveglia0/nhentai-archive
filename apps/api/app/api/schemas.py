from pydantic import BaseModel, Field
from typing import Literal


class ReaderStatePatch(BaseModel):
    page_index: int
    completed: bool = False
    cache_lease: str | None = Field(default=None, pattern=r"^[a-f0-9]{32}$")
    source_revision: str | None = Field(default=None, pattern=r"^[a-f0-9]{64}$")


class ReadingSessionStart(BaseModel):
    session_key: str = Field(min_length=8, max_length=128)
    page_index: int = 1
    cache_lease: str | None = Field(default=None, pattern=r"^[a-f0-9]{32}$")
    source_revision: str | None = Field(default=None, pattern=r"^[a-f0-9]{64}$")


class ReadingSessionPatch(BaseModel):
    duration_seconds: int = Field(ge=0)
    page_index: int = 1
    finished: bool = False
    cache_lease: str | None = Field(default=None, pattern=r"^[a-f0-9]{32}$")


class FavoritePatch(BaseModel):
    favorite: bool


class WorkGroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    work_ids: list[int] = Field(min_length=2, max_length=5000)


class WorkGroupPatch(BaseModel):
    version: int = Field(gt=0)
    name: str | None = Field(default=None, min_length=1, max_length=120)
    add_ids: list[int] = Field(default_factory=list, max_length=5000)
    remove_ids: list[int] = Field(default_factory=list, max_length=5000)


class SettingsPatch(BaseModel):
    nhentai_api_key: str | None = None
    clear_nhentai_api_key: bool = False
    storage: dict | None = None
    export: dict | None = None
    privacy: dict | None = None
    reader: dict | None = None
    downloads: dict | None = None
    machine_translation: dict | None = None


class SubscriptionCreate(BaseModel):
    remote_tag_id: int = Field(gt=0, strict=True)
    tag_type: Literal["artist", "group"]
    interval_seconds: Literal[86400, 259200, 604800] = 86400
    email_enabled: bool = True


class SubscriptionUpdateRead(BaseModel):
    update_id: int | None = Field(default=None, gt=0, strict=True)


class DictionaryApplyRequest(BaseModel):
    original_text: str
    zh_name: str
    tag_type: str = "tag"
    remote_tag_id: int | None = None
    aliases: list[str] = Field(default_factory=list)
    scope: list[str] = Field(default_factory=list)
    note: str | None = None
    status: str = "configured"
    confidence: int = 80
    locked: bool = False
    ignored: bool = False


class DictionaryBulkImportRequest(BaseModel):
    rows: list[dict]


class DictionaryTranslateRequest(BaseModel):
    text: str


class DictionarySuggestBatchRequest(BaseModel):
    limit: int = 20
    remote_tag_ids: list[int] | None = None


class GovernanceMetadataPatch(BaseModel):
    field: str
    value: str | None = None
    source: str = "manual"


class GovernanceApplyRequest(BaseModel):
    metadata: list[GovernanceMetadataPatch] = Field(default_factory=list)
    dictionary_apply: list[DictionaryApplyRequest] = Field(default_factory=list)
    write_back: bool = False
    review_item_id: int | None = Field(default=None, gt=0)
    review_version: str | None = Field(default=None, pattern=r"^[a-f0-9]{64}$")


class GovernanceBulkActions(BaseModel):
    fill_missing_metadata: bool = False
    write_back: bool = False
    confirm_dictionary_terms: bool = False


class GovernanceBulkRequest(BaseModel):
    work_ids: list[int] = Field(default_factory=list)
    actions: GovernanceBulkActions = Field(default_factory=GovernanceBulkActions)


class MetadataRefreshPreviewRequest(BaseModel):
    bind: bool | None = None
    work_ids: list[int] = Field(default_factory=list, max_length=50)
    gallery_ids: dict[int, int] = Field(default_factory=dict, max_length=50)
    queries: dict[int, str] = Field(default_factory=dict, max_length=50)
    item_ids: dict[int, int] = Field(default_factory=dict, max_length=50)


class MetadataRefreshMatchRequest(BaseModel):
    work_id: int = Field(gt=0)
    item_id: int | None = Field(default=None, gt=0)
    gallery_id: int = Field(gt=0)
    source: str
    version: str | None = Field(default=None, pattern=r"^[a-f0-9]{64}$")
    query: str | None = Field(default=None, max_length=240)
    bind: bool | None = None


class MetadataRefreshApplyRequest(BaseModel):
    matches: list[MetadataRefreshMatchRequest] = Field(default_factory=list, max_length=50)


class ScrapeDecisionRequest(BaseModel):
    action: Literal["retry", "dismiss", "complete"]
    version: str = Field(pattern=r"^[a-f0-9]{64}$")


class GovernanceTranslateRequest(BaseModel):
    fields: list[str] | None = None


class GovernanceReviewRequest(BaseModel):
    action: str
    note: str | None = None


class SourceRenameRequest(BaseModel):
    file_id: int = Field(gt=0)
    filename: str = Field(min_length=1, max_length=255)
    expected_path: str = Field(min_length=1, max_length=4096)


class ExportItemRequest(BaseModel):
    work_id: int | None = None
    output_name: str | None = None
    write_comicinfo: bool | None = None
    keep_json: bool | None = None
    compress: bool | None = None


class ExportBatchRequest(BaseModel):
    items: list[ExportItemRequest] = Field(default_factory=list)
    write_comicinfo: bool = True
    keep_json: bool = True
    compress: bool = True


class ExportBulkJobRequest(BaseModel):
    work_ids: list[int] = Field(default_factory=list)
    items: list[ExportItemRequest] = Field(default_factory=list)
    options: dict = Field(default_factory=dict)


class FileTargetRequest(BaseModel):
    kind: str
    work_id: int | None = None
    path: str | None = None


class FileDeleteRequest(BaseModel):
    targets: list[FileTargetRequest] = Field(default_factory=list)


class LibraryScanRequest(BaseModel):
    paths: list[str] | None = Field(default=None, max_length=5000)
    library_id: int | None = Field(default=None, gt=0)


class LibraryMigrationRequest(BaseModel):
    work_ids: list[int] = Field(min_length=1, max_length=500)
    library_id: int = Field(gt=0)
    move: bool = False
    conflict: Literal["rename", "skip"] = "rename"


class MediaLibraryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    root_path: str = Field(min_length=1, max_length=4096)
    kind: str = "local"
    enabled: bool = True
    read_only: bool = True
    config: dict = Field(default_factory=dict)


class MediaLibraryPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    root_path: str | None = Field(default=None, min_length=1, max_length=4096)
    kind: str | None = None
    enabled: bool | None = None
    read_only: bool | None = None
    config: dict | None = None
