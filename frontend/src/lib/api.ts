export type GallerySummary = {
  remote: "nhentai";
  gallery_id: number;
  media_id?: string;
  title: string;
  title_japanese?: string;
  pretty_title?: string;
  thumbnail: { path?: string; url?: string; width?: number; height?: number };
  page_count: number;
  favorites: number;
  tag_ids: number[];
  tags?: Array<{ id: number; type?: string; name?: string; slug?: string; display?: string }>;
  blacklisted: boolean;
  imported?: boolean;
  work_id?: number | null;
};

export type GalleryDetail = {
  gallery_id: number;
  media_id?: string;
  title: { english?: string; japanese?: string; pretty?: string };
  cover?: { path?: string; url?: string };
  thumbnail?: { path?: string; url?: string };
  tags: Array<{ id: number; type: string; name: string; slug: string; display?: string }>;
  page_count: number;
  pages?: Array<{ index?: number; path?: string; url?: string; width?: number; height?: number }>;
  favorites: number;
  upload_date?: number | string | null;
  related: GallerySummary[];
  imported: boolean;
  work_id?: number | null;
};

export type RemoteTag = {
  id: number;
  type?: string;
  name?: string;
  slug?: string;
  count?: number;
  display?: string;
  source?: string;
  dictionary_id?: number | null;
};

export type DictionaryTerm = {
  id: number;
  original_text: string;
  zh_name: string;
  tag_type: string;
  remote_tag_id?: number | null;
  aliases?: string[];
  scope: string[];
  note?: string | null;
  status: string;
  confidence: number;
  locked: boolean;
  ignored: boolean;
  source: string;
};

export type DictionaryCandidate = Omit<RemoteTag, "id"> & {
  id?: number | null;
  dictionary_id?: number | null;
  status?: string | null;
  configured?: boolean;
  ignored?: boolean;
  impact_work_count?: number;
};

export type DictionaryApplyPayload = {
  original_text: string;
  zh_name: string;
  tag_type: string;
  remote_tag_id?: number | null;
  aliases?: string[];
  scope?: string[];
  note?: string | null;
  status?: string;
  confidence?: number;
  locked?: boolean;
  ignored?: boolean;
};

export type DictionaryPreview = {
  writes: boolean;
  dictionary: DictionaryApplyPayload & { normalized_key?: string };
  impact: { work_count: number; work_ids: number[]; tag_count: number };
  will_update_tags: number;
  will_update_works: number;
  ignored: number;
  samples: Work[];
  conflicts: Array<{ type: string; message: string; id?: number; dictionary_id?: number }>;
};

export type DictionaryApplyResult = {
  dictionary: DictionaryTerm;
  impact: DictionaryPreview["impact"];
  conflicts: DictionaryPreview["conflicts"];
};

export type DictionaryStatusResult = {
  dictionary: DictionaryTerm;
};

export type DictionaryDeleteResult = {
  deleted: boolean;
  dictionary_id: number;
};

export type BulkImportRow = {
  original_text: string;
  zh_name: string;
  tag_type?: string;
  aliases?: string[] | string;
  remote_tag_id?: number | null;
  note?: string | null;
};

export type BulkImportPreview = {
  writes?: boolean;
  summary: { valid?: number; duplicate?: number; conflict?: number; invalid?: number; imported?: number };
  rows: Array<{ index: number; status: "valid" | "duplicate" | "conflict" | "invalid"; message: string; payload: DictionaryApplyPayload }>;
};

export type DictionarySummary = {
  unconfigured: number;
  configured: number;
  ignored: number;
  review: number;
  suggestions: number;
};

export type DictionaryEvidence = {
  remote_tag: null | { id: number; type?: string; name?: string; slug?: string };
  dictionary: DictionaryTerm | null;
  related_works: Work[];
  co_tags: Array<{ id: number; display: string; type?: string; count: number }>;
  history: Array<{ status: string; source: string; updated_at: string; message: string }>;
};

export type Work = {
  id: number;
  remote?: string;
  remote_gallery_id?: number;
  title: string;
  title_japanese?: string;
  pretty_title?: string;
  source: string;
  page_count: number;
  cover_path?: string;
  progress_percent?: number;
  reader_page_index?: number;
  completed?: number;
};

export type LibraryTag = {
  id: number;
  type?: string;
  name?: string;
  slug?: string;
  display: string;
};

export type LibraryWork = Work & {
  language?: string | null;
  media_id?: string | null;
  created_at?: string;
  updated_at?: string;
  last_read_at?: string | null;
  size_bytes?: number;
  tag_count?: number;
  tags?: LibraryTag[];
};

export type LibrarySummary = {
  total: number;
  reading: number;
  completed: number;
  unread: number;
  untagged: number;
  total_pages: number;
  total_size_bytes: number;
  sources: { remote: number; local: number };
  languages: Array<{ value: string; label: string; count: number }>;
};

export type LibraryTagFilter = {
  id: number;
  type?: string;
  name?: string;
  slug?: string;
  display: string;
  dictionary_id?: number | null;
  count: number;
};

export type LibrarySearchParams = {
  q?: string;
  page?: number;
  per_page?: number;
  sort?: string;
  read_status?: string;
  source?: string;
  language?: string;
  tag_ids?: number[];
};

export type LibrarySearchResult = {
  result: LibraryWork[];
  total: number;
  page: number;
  per_page: number;
  num_pages: number;
};

export type GovernanceReason = {
  code: string;
  label: string;
  severity: "warning" | "danger" | string;
};

export type GovernanceQueueItem = {
  work: LibraryWork;
  reasons: GovernanceReason[];
  completeness_percent: number;
  updated_at?: string | null;
};

export type GovernanceQueue = {
  result: GovernanceQueueItem[];
  summary: {
    total: number;
    missing_metadata: number;
    untagged: number;
    dictionary_review: number;
    dictionary_conflict: number;
    missing_comicinfo: number;
    missing_cover: number;
  };
};

export type MetadataFieldDiff = {
  field: string;
  label: string;
  current_value?: string | null;
  source_value?: string | null;
  source: "comicinfo" | "json" | "remote" | "unknown" | string;
  working_value?: string | null;
  working_source: "manual" | "remote" | "comicinfo" | "current" | string;
  dirty: boolean;
  differs_from_source: boolean;
  updated_at?: string | null;
};

export type GovernanceFile = {
  id: number;
  kind: string;
  path: string;
  size_bytes: number;
  sha256?: string | null;
  created_at?: string | null;
  exists: boolean;
};

export type GovernanceTag = {
  id: number;
  remote_tag_id?: number | null;
  dictionary_id?: number | null;
  type: string;
  name?: string | null;
  slug?: string | null;
  display: string;
  dictionary_status?: string | null;
  state: "confirmed" | "pending" | "conflict" | string;
};

export type GovernanceTagGroup = {
  key: string;
  label: string;
  tags: GovernanceTag[];
};

export type GovernanceAggregate = {
  work: LibraryWork;
  files: GovernanceFile[];
  metadata: { fields: MetadataFieldDiff[] };
  tags: { groups: GovernanceTagGroup[]; summary: { confirmed: number; pending: number; conflicts: number } };
  dictionary: { matched: number; pending: number; conflicts: number };
  exports: unknown[];
  recommended_actions: Array<{ code: string; label: string }>;
  completeness_percent: number;
};

export type GovernanceApplyPayload = {
  metadata: Array<{ field: string; value: string | null; source: "manual" | "remote" | "comicinfo" | "current" }>;
  dictionary_apply?: DictionaryApplyPayload[];
  write_back?: boolean;
};

export type GovernanceApplyResult = {
  saved: number;
  dictionary: DictionaryApplyResult[];
  governance: GovernanceAggregate;
  write_back?: {
    written?: boolean;
    fields?: Record<string, string>;
    new_size_bytes?: number;
    error?: string;
  };
};

export type ExportBlocker = {
  code: string;
  message: string;
};

export type ExportWarning = {
  code: string;
  message: string;
};

export type ExportSourceFile = {
  path?: string | null;
  size_bytes: number;
  sha256?: string | null;
  exists: boolean;
};

export type ExportOptions = {
  write_comicinfo: boolean;
  keep_json: boolean;
  compress: boolean;
};

export type ExportPreview = {
  work: LibraryWork;
  source_file: ExportSourceFile;
  output_name: string;
  comic_info: Record<string, string>;
  options: ExportOptions;
  will_write: string[];
  will_keep: string[];
  will_not_modify: string[];
  blockers: ExportBlocker[];
  warnings: ExportWarning[];
};

export type ExportQueueItem = {
  work: LibraryWork;
  output_name: string;
  blockers: ExportBlocker[];
  warnings: ExportWarning[];
  source_file: ExportSourceFile;
};

export type ExportQueue = {
  result: ExportQueueItem[];
  summary: {
    total: number;
    ready: number;
    blocked: number;
    warnings: number;
  };
};

export type ExportSummaryStats = ExportQueue["summary"];

export type FileEntry = {
  kind: "work" | "orphan" | "stale";
  id: string;
  status: "ok" | "missing_source" | "missing_cover" | "orphan" | "stale";
  flags: string[];
  size_bytes: number;
  // work entries
  work_id?: number;
  title?: string;
  source_path?: string | null;
  cover_path?: string | null;
  page_count?: number;
  source?: string | null;
  remote_gallery_id?: number | null;
  updated_at?: string | null;
  tags?: string[];
  // loose entries
  path?: string;
  name?: string;
  dir?: string;
};

export type FileDuplicates = {
  hash: { groups: number; files: number };
  gallery_id: { groups: number; works: number };
  title_similar: number | null;
};

export type FileOverview = {
  work_count: number;
  source_bytes: number;
  cover_ok: number;
  missing_source: number;
  missing_cover: number;
  orphan_count: number;
  orphan_bytes: number;
  stale_count: number;
  stale_bytes: number;
  reclaimable_bytes: number;
};

export type FileInventory = { result: FileEntry[]; total: number; page: number; per_page: number };

export type FileDeleteTarget = { kind: "work" | "orphan" | "stale"; work_id?: number; path?: string };

export type FileDeletePreviewItem = {
  kind: string;
  work_id?: number;
  title?: string;
  path?: string;
  exists: boolean;
  files?: string[];
  work_tags?: number;
  has_progress?: boolean;
  has_governance?: boolean;
  reclaim_bytes: number;
  warnings: string[];
  status: string;
};

export type FileDeletePreview = {
  items: FileDeletePreviewItem[];
  files_to_delete: number;
  works_to_remove: number;
  reclaim_bytes: number;
};

export type FileDeleteResult = {
  deleted_files: number;
  removed_works: number;
  reclaimed_bytes: number;
  errors: { target: FileDeleteTarget; code: string; message: string }[];
};

export type FileInventoryParams = {
  category?: string;
  q?: string;
  status?: string;
  page?: number;
  per_page?: number;
};

export type ExportRequestOptions = {
  output_name?: string;
  write_comicinfo?: boolean;
  keep_json?: boolean;
  compress?: boolean;
};

export type ExportBatchItem = {
  work_id: number;
  output_name?: string;
};

export type PageInfo = {
  id: number;
  work_id: number;
  page_index: number;
  archive_member: string;
  media_type: string;
  size_bytes: number;
};

export type ReaderState = {
  work_id: number;
  page_index: number;
  page_count: number;
  progress_percent: number;
  completed: boolean;
  last_read_at: string | null;
};

export type JobMeta = {
  title?: string | null;
  page_count?: number | null;
  cover_url?: string | null;
};

export type Job = {
  id: number;
  type: string;
  status: "queued" | "running" | "paused" | "cancelling" | "completed" | "failed" | "cancelled";
  stage: string;
  progress: { current: number; total: number; percent: number };
  target: Record<string, unknown>;
  meta?: JobMeta | null;
  error?: string | null;
  retry_after?: number | null;
  created_at: string;
  updated_at: string;
};

export type JobLog = {
  id: number;
  job_id: number;
  level: "info" | "error" | string;
  message: string;
  created_at: string;
};

export type WorkbenchFailedJob = {
  id: number;
  type: string;
  target: Record<string, unknown>;
  error?: string | null;
  updated_at: string;
};

export type WorkbenchOverview = {
  library: {
    total: number;
    reading: number;
    completed: number;
    unread: number;
    untagged: number;
    total_pages: number;
    total_size_bytes: number;
  };
  governance: {
    total: number;
    missing_metadata: number;
    untagged: number;
    dictionary_review: number;
    dictionary_conflict: number;
    missing_comicinfo: number;
    missing_cover: number;
  };
  files: {
    work_count: number;
    source_bytes: number;
    cover_ok: number;
    missing_source: number;
    missing_cover: number;
    orphan_count: number;
    stale_count: number;
    reclaimable_bytes: number;
  };
  exports: { total: number; ready: number; blocked: number; warnings: number };
  jobs: {
    running: number;
    queued: number;
    paused: number;
    cancelling: number;
    failed: number;
    completed: number;
    cancelled: number;
    failed_recent: WorkbenchFailedJob[];
  };
  continue_reading: LibraryWork[];
  recent_added: LibraryWork[];
};

export type TranslationVerifyResult = {
  ok: boolean;
  provider: string;
  sample: string | null;
  status_code: number | null;
  message: string;
};

export type MachineTranslationSettings = {
  provider: "google_free" | "deepl";
  deepl_api_key_configured: boolean;
  deepl_key_source: "env" | "db" | "none";
  deepl_plan: "free" | "pro";
  target_lang: string;
  batch_limit: number;
  last_verify: TranslationVerifyResult | null;
};

export type NhentaiRuntimeStats = {
  cache_entries: number;
  cache_active_entries: number;
  cooldown_active: boolean;
  cooldown_remaining_seconds: number;
  cdn_configured: boolean;
};

export type SettingsSummary = {
  nhentai: {
    base_url: string;
    user_agent: string;
    request_timeout: number;
    api_key_configured: boolean;
    api_key_source: "env" | "db" | "none";
    last_verify: null | {
      configured: boolean;
      ok: boolean;
      source: string;
      status_code: number | null;
      message: string;
    };
  };
  storage: Record<string, string>;
  privacy: {
    privacy_mode_default: boolean;
    blur_covers_default: boolean;
  };
  reader: {
    default_mode: "single" | "scroll";
  };
  machine_translation: MachineTranslationSettings | null;
  export: {
    active_preset_id: string;
    presets: ExportPreset[];
    default_options: { write_comicinfo: boolean; keep_json: boolean; compress: boolean };
  };
};

export type ExportPreset = {
  id: string;
  name: string;
  naming_rule: string;
  comicinfo_rule: string;
  meta_rule: string;
  compression: string;
};

export type DiscoverSearchParams = {
  q?: string;
  page?: number;
  per_page?: number;
  sort?: string;
  language?: string;
  type?: string;
  tag_id?: number | null;
  tag_names?: string[];
  unimported_only?: boolean;
};

const JSON_HEADERS = { "Content-Type": "application/json" };
const DISCOVER_CACHE = new Map<string, { expiresAt: number; value: unknown; promise?: Promise<unknown> }>();

export async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const payload = await response.json();
      message = payload.detail?.message || payload.detail || message;
    } catch {
      // Keep the HTTP status text.
    }
    throw new Error(String(message));
  }
  return response.json() as Promise<T>;
}

function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1]);
    } catch {
      // fall through to the plain filename
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1] : fallback;
}

async function downloadFile(url: string, options: RequestInit, fallbackName: string): Promise<string> {
  const response = await fetch(url, options);
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const payload = await response.json();
      message = payload.detail?.message || payload.detail || message;
    } catch {
      // Keep the HTTP status text.
    }
    throw new Error(String(message));
  }
  const blob = await response.blob();
  const filename = filenameFromDisposition(response.headers.get("Content-Disposition"), fallbackName);
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
  return filename;
}

async function cachedDiscoverRequest<T>(url: string, ttlMs = 60_000): Promise<T> {
  const now = Date.now();
  const cached = DISCOVER_CACHE.get(url);
  if (cached?.promise) return cached.promise as Promise<T>;
  if (cached && cached.expiresAt > now) return cached.value as T;
  const promise = request<T>(url)
    .then((value) => {
      DISCOVER_CACHE.set(url, { expiresAt: Date.now() + ttlMs, value });
      return value;
    })
    .catch((error) => {
      DISCOVER_CACHE.delete(url);
      throw error;
    });
  DISCOVER_CACHE.set(url, { expiresAt: now + ttlMs, value: cached?.value, promise });
  return promise;
}

export const api = {
  latest: (page = 1, perPage = 24) =>
    cachedDiscoverRequest<{ result: GallerySummary[]; total: number; num_pages?: number; per_page?: number }>(
      `/api/discover/latest?page=${page}&per_page=${perPage}`
    ),
  feed: (params: DiscoverSearchParams) => {
    const query = new URLSearchParams();
    query.set("q", params.q ?? "");
    query.set("page", String(params.page ?? 1));
    query.set("per_page", String(params.per_page ?? 24));
    query.set("sort", params.sort ?? "date");
    query.set("language", params.language ?? "all");
    query.set("type", params.type ?? "all");
    if (params.tag_id) query.set("tag_id", String(params.tag_id));
    if (params.tag_names?.length) query.set("tag_names", params.tag_names.join(","));
    query.set("unimported_only", String(Boolean(params.unimported_only)));
    return cachedDiscoverRequest<{
      result: GallerySummary[];
      total: number;
      num_pages: number;
      per_page: number;
      reason?: string;
      query?: string;
      source?: string;
    }>(`/api/discover/feed?${query.toString()}`);
  },
  popular: () => cachedDiscoverRequest<{ result: GallerySummary[]; total: number }>("/api/discover/popular", 5 * 60_000),
  random: () => request<GalleryDetail>("/api/discover/random"),
  tagged: (tagId: number, page = 1, perPage = 24, sort = "date") =>
    cachedDiscoverRequest<{ result: GallerySummary[]; total: number; num_pages: number; per_page: number; source?: string }>(
      `/api/discover/tagged?tag_id=${tagId}&page=${page}&per_page=${perPage}&sort=${encodeURIComponent(sort)}`
    ),
  search: (params: DiscoverSearchParams) => {
    const query = new URLSearchParams();
    query.set("q", params.q ?? "");
    query.set("page", String(params.page ?? 1));
    query.set("per_page", String(params.per_page ?? 24));
    query.set("sort", params.sort ?? "date");
    query.set("language", params.language ?? "all");
    query.set("type", params.type ?? "all");
    query.set("unimported_only", String(Boolean(params.unimported_only)));
    return cachedDiscoverRequest<{ result: GallerySummary[]; total: number; num_pages: number; per_page: number; reason?: string; query?: string }>(
      `/api/discover/search?${query.toString()}`
    );
  },
  gallery: (id: number) => cachedDiscoverRequest<GalleryDetail>(`/api/discover/galleries/${id}`, 10 * 60_000),
  tagAutocomplete: (q: string, limit = 12) =>
    cachedDiscoverRequest<{ result: RemoteTag[] }>(`/api/discover/tags/autocomplete?q=${encodeURIComponent(q)}&limit=${limit}`, 5 * 60_000),
  cachedTags: (limit = 60) => cachedDiscoverRequest<{ result: RemoteTag[] }>(`/api/discover/tags/cached?limit=${limit}`, 5 * 60_000),
  dictionarySummary: () => request<DictionarySummary>("/api/dictionary/summary"),
  dictionaryCandidates: (params: { q?: string; type?: string; status?: string; limit?: number; offset?: number } = {}) => {
    const query = new URLSearchParams();
    query.set("q", params.q ?? "");
    query.set("type", params.type ?? "all");
    query.set("status", params.status ?? "all");
    query.set("limit", String(params.limit ?? 50));
    query.set("offset", String(params.offset ?? 0));
    return request<{ result: DictionaryCandidate[] }>(`/api/dictionary/candidates?${query.toString()}`);
  },
  dictionaryEvidence: (params: { remote_tag_id?: number | null; dictionary_id?: number | null }) => {
    const query = new URLSearchParams();
    if (params.remote_tag_id) query.set("remote_tag_id", String(params.remote_tag_id));
    if (params.dictionary_id) query.set("dictionary_id", String(params.dictionary_id));
    return request<DictionaryEvidence>(`/api/dictionary/evidence?${query.toString()}`);
  },
  dictionaryAutocomplete: (q: string, limit = 20) =>
    cachedDiscoverRequest<{ result: RemoteTag[] }>(`/api/dictionary/autocomplete?q=${encodeURIComponent(q)}&limit=${limit}`, 5 * 60_000),
  dictionaryPreviewApply: (payload: DictionaryApplyPayload) =>
    request<DictionaryPreview>("/api/dictionary/preview-apply", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(payload)
    }),
  dictionaryApply: (payload: DictionaryApplyPayload) =>
    request<DictionaryApplyResult>("/api/dictionary/apply", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(payload)
    }),
  dictionaryTranslate: (text: string) =>
    request<{ text: string; translation: string; provider: string }>("/api/dictionary/translate", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ text })
    }),
  dictionarySuggestBatch: (limit = 20) =>
    request<{ generated: number; items: Array<{ original_text: string; zh_name: string; tag_type: string; remote_tag_id: number }> }>(
      "/api/dictionary/suggest-batch",
      { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ limit }) }
    ),
  dictionaryPreviewBulkImport: (rows: BulkImportRow[]) =>
    request<BulkImportPreview>("/api/dictionary/preview-bulk-import", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ rows })
    }),
  dictionaryBulkImport: (rows: BulkImportRow[]) =>
    request<BulkImportPreview>("/api/dictionary/bulk-import", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ rows })
    }),
  dictionaryIgnore: (id: number) => request<DictionaryStatusResult>(`/api/dictionary/${id}/ignore`, { method: "POST", headers: JSON_HEADERS }),
  dictionaryReview: (id: number) => request<DictionaryStatusResult>(`/api/dictionary/${id}/review`, { method: "POST", headers: JSON_HEADERS }),
  dictionaryDelete: (id: number) => request<DictionaryDeleteResult>(`/api/dictionary/${id}`, { method: "DELETE", headers: JSON_HEADERS }),
  importGallery: (id: number) =>
    request<Job>(`/api/discover/galleries/${id}/import`, { method: "POST", headers: JSON_HEADERS }),
  workbenchOverview: () => request<WorkbenchOverview>("/api/workbench/overview"),
  librarySummary: () => request<LibrarySummary>("/api/library/summary"),
  librarySearch: (params: LibrarySearchParams = {}) => {
    const query = new URLSearchParams();
    query.set("q", params.q ?? "");
    query.set("page", String(params.page ?? 1));
    query.set("per_page", String(params.per_page ?? 24));
    query.set("sort", params.sort ?? "recent_updated");
    query.set("read_status", params.read_status ?? "all");
    query.set("source", params.source ?? "all");
    query.set("language", params.language ?? "all");
    if (params.tag_ids?.length) query.set("tag_ids", params.tag_ids.join(","));
    return request<LibrarySearchResult>(`/api/library/search?${query.toString()}`);
  },
  libraryRecentAdded: (limit = 12) => request<{ result: LibraryWork[] }>(`/api/library/recent-added?limit=${limit}`),
  libraryRecentRead: (limit = 12) => request<{ result: LibraryWork[] }>(`/api/library/recent-read?limit=${limit}`),
  libraryContinueReading: (limit = 12) => request<{ result: LibraryWork[] }>(`/api/library/continue-reading?limit=${limit}`),
  libraryTagFilters: (q = "", limit = 40) =>
    request<{ result: LibraryTagFilter[] }>(`/api/library/tag-filters?q=${encodeURIComponent(q)}&limit=${limit}`),
  governanceQueue: () => request<GovernanceQueue>("/api/governance/queue"),
  workGovernance: (id: number) => request<GovernanceAggregate>(`/api/works/${id}/governance`),
  applyWorkGovernance: (id: number, payload: GovernanceApplyPayload) =>
    request<GovernanceApplyResult>(`/api/works/${id}/governance/apply`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(payload)
    }),
  exportQueue: () => request<ExportQueue>("/api/exports/queue"),
  exportSummary: () => request<ExportSummaryStats>("/api/exports/summary"),
  exportPreview: (id: number, options?: ExportRequestOptions) =>
    options
      ? request<ExportPreview>(`/api/works/${id}/export-preview`, {
          method: "POST",
          headers: JSON_HEADERS,
          body: JSON.stringify(options)
        })
      : request<ExportPreview>(`/api/works/${id}/export-preview`),
  downloadExport: (id: number, options?: ExportRequestOptions) => {
    const query = new URLSearchParams();
    if (options?.output_name) query.set("output_name", options.output_name);
    if (options?.write_comicinfo !== undefined) query.set("write_comicinfo", String(options.write_comicinfo));
    if (options?.keep_json !== undefined) query.set("keep_json", String(options.keep_json));
    if (options?.compress !== undefined) query.set("compress", String(options.compress));
    const qs = query.toString();
    return downloadFile(`/api/works/${id}/export/download${qs ? `?${qs}` : ""}`, {}, `work-${id}.cbz`);
  },
  downloadExportBundle: (items: ExportBatchItem[], options?: Omit<ExportRequestOptions, "output_name">) =>
    downloadFile(
      "/api/exports/download",
      { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ items, ...options }) },
      "导出合集.zip"
    ),
  filesOverview: () => request<FileOverview>("/api/files/overview"),
  filesInventory: (params: FileInventoryParams = {}) => {
    const query = new URLSearchParams();
    query.set("category", params.category ?? "all");
    if (params.q) query.set("q", params.q);
    if (params.status) query.set("status", params.status);
    query.set("page", String(params.page ?? 1));
    query.set("per_page", String(params.per_page ?? 50));
    return request<FileInventory>(`/api/files/inventory?${query.toString()}`);
  },
  previewFileDelete: (targets: FileDeleteTarget[]) =>
    request<FileDeletePreview>("/api/files/preview-delete", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ targets }),
    }),
  deleteFiles: (targets: FileDeleteTarget[]) =>
    request<FileDeleteResult>("/api/files/delete", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ targets }),
    }),
  filesDuplicates: () => request<FileDuplicates>("/api/files/duplicates"),
  works: () => request<{ result: Work[] }>("/api/works"),
  work: (id: number) => request<Work>(`/api/works/${id}`),
  pages: (id: number) => request<{ result: PageInfo[] }>(`/api/works/${id}/pages`),
  readerState: (id: number) => request<ReaderState>(`/api/works/${id}/reader-state`),
  updateReaderState: (id: number, pageIndex: number, completed = false) =>
    request<ReaderState>(`/api/works/${id}/reader-state`, {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify({ page_index: pageIndex, completed })
    }),
  jobs: () => request<{ result: Job[] }>("/api/jobs"),
  jobLogs: (id: number) => request<{ result: JobLog[] }>(`/api/jobs/${id}/logs`),
  pauseJob: (id: number) => request<Job>(`/api/jobs/${id}/pause`, { method: "POST", headers: JSON_HEADERS }),
  resumeJob: (id: number) => request<Job>(`/api/jobs/${id}/resume`, { method: "POST", headers: JSON_HEADERS }),
  cancelJob: (id: number) => request<Job>(`/api/jobs/${id}/cancel`, { method: "POST", headers: JSON_HEADERS }),
  retryJob: (id: number) => request<Job>(`/api/jobs/${id}/retry`, { method: "POST", headers: JSON_HEADERS }),
  deleteJob: (id: number) => request<{ deleted: number }>(`/api/jobs/${id}`, { method: "DELETE" }),
  clearJobs: () => request<{ deleted: number }>("/api/jobs/clear", { method: "POST", headers: JSON_HEADERS }),
  settings: () => request<SettingsSummary>("/api/settings"),
  updateSettings: (payload: Record<string, unknown>) =>
    request<SettingsSummary>("/api/settings", {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify(payload)
    }),
  verifyNhentaiSettings: () =>
    request<{ configured: boolean; ok: boolean; source: string; status_code: number | null; message: string }>(
      "/api/settings/nhentai/verify",
      { method: "POST", headers: JSON_HEADERS }
    ),
  verifyTranslationSettings: () =>
    request<TranslationVerifyResult>("/api/settings/translation/verify", { method: "POST", headers: JSON_HEADERS }),
  clearNhentaiCache: () =>
    request<{ ok: boolean; message: string }>("/api/settings/nhentai/clear-cache", { method: "POST", headers: JSON_HEADERS }),
  nhentaiRuntime: () => request<NhentaiRuntimeStats>("/api/settings/nhentai/runtime")
};
