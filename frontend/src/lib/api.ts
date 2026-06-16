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
  tags?: Array<{ id: number; type?: string; name?: string; slug?: string }>;
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
  tags: Array<{ id: number; type: string; name: string; slug: string }>;
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

export type Job = {
  id: number;
  type: string;
  status: "queued" | "running" | "completed" | "failed";
  stage: string;
  progress: { current: number; total: number; percent: number };
  target: Record<string, unknown>;
  error?: string | null;
  retry_after?: number | null;
  updated_at: string;
};

export type SettingsSummary = {
  nhentai: {
    base_url: string;
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
  retryJob: (id: number) => request<Job>(`/api/jobs/${id}/retry`, { method: "POST", headers: JSON_HEADERS }),
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
    )
};
