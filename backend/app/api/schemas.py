from pydantic import BaseModel, Field


class ReaderStatePatch(BaseModel):
    page_index: int
    completed: bool = False


class SettingsPatch(BaseModel):
    nhentai_api_key: str | None = None
    clear_nhentai_api_key: bool = False
    storage: dict | None = None
    export: dict | None = None
    privacy: dict | None = None
    reader: dict | None = None
    machine_translation: dict | None = None


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


class GovernanceBulkActions(BaseModel):
    fill_missing_metadata: bool = False
    write_back: bool = False
    confirm_dictionary_terms: bool = False


class GovernanceBulkRequest(BaseModel):
    work_ids: list[int] = Field(default_factory=list)
    actions: GovernanceBulkActions = Field(default_factory=GovernanceBulkActions)


class GovernanceTranslateRequest(BaseModel):
    fields: list[str] | None = None


class GovernanceReviewRequest(BaseModel):
    action: str
    note: str | None = None


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
    paths: list[str] | None = None
