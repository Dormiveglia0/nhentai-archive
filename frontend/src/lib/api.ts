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
  favorites: number;
  related: GallerySummary[];
  imported: boolean;
  work_id?: number | null;
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
  unimported_only?: boolean;
};

const JSON_HEADERS = { "Content-Type": "application/json" };

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

export const api = {
  latest: (page = 1, perPage = 24) =>
    request<{ result: GallerySummary[]; total: number; num_pages?: number; per_page?: number }>(
      `/api/discover/latest?page=${page}&per_page=${perPage}`
    ),
  popular: () => request<{ result: GallerySummary[]; total: number }>("/api/discover/popular"),
  random: () => request<GalleryDetail>("/api/discover/random"),
  search: (params: DiscoverSearchParams) => {
    const query = new URLSearchParams();
    query.set("q", params.q ?? "");
    query.set("page", String(params.page ?? 1));
    query.set("per_page", String(params.per_page ?? 24));
    query.set("sort", params.sort ?? "date");
    query.set("language", params.language ?? "all");
    query.set("type", params.type ?? "all");
    query.set("unimported_only", String(Boolean(params.unimported_only)));
    return request<{ result: GallerySummary[]; total: number; num_pages: number; per_page: number; reason?: string; query?: string }>(
      `/api/discover/search?${query.toString()}`
    );
  },
  gallery: (id: number) => request<GalleryDetail>(`/api/discover/galleries/${id}`),
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
