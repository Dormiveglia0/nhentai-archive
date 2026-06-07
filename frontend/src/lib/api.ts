export type TaskStatus = 'queued' | 'running' | 'success' | 'failed' | 'canceled' | 'completed' | 'downloading' | string;

export type Task = {
  id: number;
  type: string;
  gallery_id: number | null;
  work_id: number | null;
  status: TaskStatus;
  title: string | null;
  cover_url: string | null;
  language: string | null;
  error: string | null;
  message: string | null;
  current_step: string | null;
  progress_current: number;
  progress_total: number;
  progress: number;
  cbz_path: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
};

export type GalleryTag = { id: number; type: string; name: string };

export type Gallery = {
  id: number;
  media_id: string;
  title: string;
  cover_url: string;
  thumb_url: string;
  proxied_cover_url: string;
  proxied_thumb_url: string;
  cover_error?: string;
  thumb_error?: string;
  num_pages: number;
  language: string;
  tags: GalleryTag[];
  tag_ids: number[];
  tag_sample: string[];
};

export type WorkTagPreview = { type: string; value: string; confirmed: boolean };

export type Work = {
  id: number;
  source_type: string;
  source_id: string;
  media_id: string;
  display_title: string;
  status: string;
  local_cbz_path: string;
  cover_path: string;
  cover_url: string;
  file_hash: string;
  page_count: number;
  tag_count: number;
  unconfirmed_tag_count: number;
  export_count: number;
  tag_preview: WorkTagPreview[];
  created_at: string;
  updated_at: string;
};

export type ComicInfo = {
  Title?: string;
  Series?: string;
  AlternateSeries?: string;
  Writer?: string;
  Translator?: string;
  Format?: string;
  Tags?: string;
  LanguageISO?: string;
  Web?: string;
  PageCount?: number;
  Year?: number;
  Month?: number;
  Day?: number;
  Manga?: string;
  AgeRating?: string;
};

export type WorkMetadata = Record<string, { comic_info: ComicInfo | null; meta_json: unknown; updated_at: string | null }>;

export type WorkTag = {
  id: number;
  work_id: number;
  remote_id: number;
  type: string;
  original_name: string;
  dictionary_value: string;
  machine_suggestion: string;
  final_value: string;
  final_source: string;
  is_confirmed: boolean;
};

export type ExportRecord = {
  id: number;
  work_id: number;
  path: string;
  filename: string;
  created_at: string;
  download_url: string;
  exists?: boolean;
  size_bytes?: number;
  work_title?: string;
  work?: Work;
};

export type DictionaryEntry = {
  id: number;
  source_type: string;
  source_text: string;
  translated_text: string;
  enabled: boolean;
};

export type DictionaryTagItem = {
  type: string;
  source_type: string;
  original: string;
  source_text: string;
  count: number;
  work_count: number;
  dictionary_id: number;
  current_translation: string;
  machine_suggestion: string;
  final_value: string;
  state: 'configured' | 'unconfigured' | 'ignored' | string;
  example_works: Work[];
};

export type DictionaryTagRef = {
  type: string;
  original: string;
  translation?: string;
};

export type TranslationProvider = 'none' | 'google_free_gtx' | 'deepl' | 'google_paid';

export type AppSettings = {
  translate_tags: boolean;
  translate_titles: boolean;
  translation_provider: TranslationProvider;
  nhentai_user_agent: string;
  library_dir: string;
  library_import_dir: string;
  library_export_dir: string;
  cover_cache_dir: string;
  export_pattern: string;
  tag_separator: string;
  keep_meta_json: boolean;
  update_meta_json: boolean;
  secrets: Record<string, { configured: boolean; masked: string }>;
};

export type ImportResponse = {
  tasks: Task[];
  added: number;
  existing: number;
  retried: number;
  ignored: number;
  errors: { id: number; error: string }[];
};

export type AppStatus = {
  uptime_seconds: number;
  api: { user_agent: string; key_configured: boolean };
  cdn: { servers: string[]; last_update: string };
  translation: { provider: TranslationProvider; deepl: boolean; google: boolean };
  storage: { library_dir: string; free_bytes: number; total_bytes: number };
  worker: { queued: number; downloading: number; completed: number; failed: number };
};

export type ConnectionCheck = { ok: boolean; detail: string };
export type ConnectionTest = {
  api_root: ConnectionCheck;
  auth_key: ConnectionCheck;
  cdn: { ok: boolean; detail: string; servers: string[]; image_servers?: string[]; thumb_servers?: string[] };
};

export type AppLogs = {
  events: { id: number; level: string; action: string; message: string; created_at: string }[];
  task_errors: { task_id: number; gallery_id: number; message: string; updated_at: string }[];
};

export type WorkDetail = { work: Work; metadata: WorkMetadata; tags: WorkTag[]; exports: ExportRecord[] };

export function galleryCoverSrc(gallery: Pick<Gallery, 'proxied_cover_url' | 'proxied_thumb_url' | 'cover_url' | 'thumb_url'>) {
  return gallery.proxied_cover_url || gallery.proxied_thumb_url || gallery.cover_url || gallery.thumb_url || '';
}

export function parseGalleryIds(input: string) {
  const ids = new Set<number>();
  for (const match of input.matchAll(/(?:nhentai\.net\/g\/)?(\d+)/gi)) {
    const id = Number(match[1]);
    if (Number.isFinite(id) && id > 0) ids.add(id);
  }
  return [...ids];
}

export class ApiClient {
  token: string | null;

  constructor(token: string | null) {
    this.token = token;
  }

  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers);
    if (!(options.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    if (this.token) headers.set('Authorization', `Bearer ${this.token}`);
    const response = await fetch(path, { ...options, headers });
    if (!response.ok) throw new Error(await parseError(response));
    if (response.status === 204) return undefined as T;
    const type = response.headers.get('Content-Type') || '';
    if (!type.includes('application/json')) return response.blob() as Promise<T>;
    return response.json() as Promise<T>;
  }

  status() {
    return this.request<AppStatus>('/api/status');
  }

  settings() {
    return this.request<AppSettings>('/api/settings');
  }

  saveSettings(settings: Partial<AppSettings>) {
    return this.request<AppSettings>('/api/settings', { method: 'PATCH', body: JSON.stringify(settings) });
  }

  saveSecrets(secrets: Record<string, string>) {
    return this.request<{ secrets: AppSettings['secrets'] }>('/api/settings/secrets', { method: 'PATCH', body: JSON.stringify(secrets) });
  }

  testConnection(payload: { nhentai_user_agent: string; nhentai_api_key?: string }) {
    return this.request<ConnectionTest>('/api/settings/test-connection', { method: 'POST', body: JSON.stringify(payload) });
  }

  searchGalleries(query: string, page: number, sort: string) {
    return this.request<{ result: Gallery[]; count: number; page?: number; num_pages?: number; total?: number }>(
      `/api/sources/nhentai/search?q=${encodeURIComponent(query)}&page=${page}&sort=${encodeURIComponent(sort)}`
    );
  }

  gallery(id: number) {
    return this.request<{ gallery: Gallery; raw: unknown; already_imported: boolean }>(`/api/sources/nhentai/galleries/${id}`);
  }

  related(id: number) {
    return this.request<{ result: Gallery[] }>(`/api/sources/nhentai/galleries/${id}/related`);
  }

  import(ids: number[]) {
    return this.request<ImportResponse>('/api/tasks/import', { method: 'POST', body: JSON.stringify({ ids }) });
  }

  upload(file: File) {
    const form = new FormData();
    form.append('file', file);
    return this.request<{ work: Work }>('/api/local/upload', { method: 'POST', body: form });
  }

  scan(directory?: string) {
    return this.request<{ status: string; counts: Record<string, number>; errors: { path: string; error: string }[] }>('/api/local/scan', {
      method: 'POST',
      body: JSON.stringify({ directory })
    });
  }

  works(params: Record<string, string> = {}) {
    const qs = new URLSearchParams(params);
    return this.request<{ works: Work[]; summary: Record<string, number> }>(`/api/works${qs.size ? `?${qs}` : ''}`);
  }

  work(id: number) {
    return this.request<WorkDetail>(`/api/works/${id}`);
  }

  saveMetadata(id: number, comicInfo: ComicInfo) {
    return this.request<WorkMetadata>(`/api/works/${id}/metadata`, { method: 'PATCH', body: JSON.stringify({ comic_info: comicInfo }) });
  }

  metadataAction(id: number, action: 'reset' | 'refill-from-meta' | 'compare') {
    return this.request<unknown>(`/api/works/${id}/metadata/${action}`, { method: 'POST' });
  }

  translateMetadata(id: number) {
    return this.request<{ suggestions: Partial<Record<keyof ComicInfo, string>>; metadata: WorkMetadata }>(`/api/works/${id}/metadata/translate`, { method: 'POST' });
  }

  patchTag(workId: number, tagId: number, patch: Partial<WorkTag>) {
    return this.request<{ tags: WorkTag[] }>(`/api/works/${workId}/tags/${tagId}`, { method: 'PATCH', body: JSON.stringify(patch) });
  }

  tagBulk(workId: number, ids: number[], action: string, extra: Record<string, unknown> = {}) {
    return this.request<{ tags: WorkTag[] }>(`/api/works/${workId}/tags/bulk-update`, { method: 'POST', body: JSON.stringify({ ids, action, ...extra }) });
  }

  applyDictionary(workId: number) {
    return this.request<{ updated: number; tags: WorkTag[] }>(`/api/works/${workId}/tags/apply-dictionary`, { method: 'POST' });
  }

  machineSuggest(workId: number) {
    return this.request<{ updated: number; tags: WorkTag[] }>(`/api/works/${workId}/tags/machine-translate`, { method: 'POST' });
  }

  confirmTags(workId: number) {
    return this.request<{ tags: WorkTag[] }>(`/api/works/${workId}/tags/confirm`, { method: 'POST' });
  }

  exportWork(workId: number) {
    return this.request<{ export: ExportRecord }>(`/api/works/${workId}/export`, { method: 'POST' });
  }

  bulkWorks(ids: number[], action: string) {
    return this.request<{ result: Record<string, number>; works: Work[] }>('/api/works/bulk-action', { method: 'POST', body: JSON.stringify({ ids, action }) });
  }

  tasks() {
    return this.request<Task[]>('/api/tasks');
  }

  retryTask(id: number) {
    return this.request<Task>(`/api/tasks/${id}/retry`, { method: 'POST' });
  }

  deleteTask(id: number) {
    return this.request<{ status: string }>(`/api/tasks/${id}`, { method: 'DELETE' });
  }

  retryFailed() {
    return this.request<{ status: string; count: number; tasks: Task[] }>('/api/tasks/retry-failed', { method: 'POST' });
  }

  clearCompleted() {
    return this.request<{ status: string; count: number; tasks: Task[] }>('/api/tasks/clear-completed', { method: 'POST' });
  }

  dictionary() {
    return this.request<DictionaryEntry[]>('/api/dictionary');
  }

  dictionaryTags(params: Record<string, string> = {}) {
    const qs = new URLSearchParams(params);
    return this.request<{ items: DictionaryTagItem[]; total: number }>(`/api/dictionary/tags${qs.size ? `?${qs}` : ''}`);
  }

  suggestDictionaryTags(items: DictionaryTagRef[], provider?: string) {
    return this.request<{ suggestions: { type: string; original: string; suggestion: string }[]; errors: { type: string; original: string; error: string }[] }>(
      '/api/dictionary/tags/suggest',
      { method: 'POST', body: JSON.stringify({ items, provider }) }
    );
  }

  upsertDictionaryTags(items: DictionaryTagRef[]) {
    return this.request<{ updated: number; entries: DictionaryEntry[] }>('/api/dictionary/tags/upsert', { method: 'POST', body: JSON.stringify({ items }) });
  }

  ignoreDictionaryTags(items: DictionaryTagRef[]) {
    return this.request<{ ignored: number }>('/api/dictionary/tags/ignore', { method: 'POST', body: JSON.stringify({ items }) });
  }

  dictionaryTagWorks(type: string, original: string) {
    return this.request<{ works: Work[] }>(`/api/dictionary/tags/${encodeURIComponent(type)}/${encodeURIComponent(original)}`);
  }

  saveDictionary(entry: Partial<DictionaryEntry>) {
    return this.request<DictionaryEntry>('/api/dictionary', { method: 'POST', body: JSON.stringify(entry) });
  }

  deleteDictionary(id: number) {
    return this.request<{ status: string }>(`/api/dictionary/${id}`, { method: 'DELETE' });
  }

  previewDictionary(text: string, sourceType: string) {
    return this.request<{ items: unknown[]; summary: Record<string, number> }>('/api/dictionary/bulk-import/preview', {
      method: 'POST',
      body: JSON.stringify({ text, source_type: sourceType })
    });
  }

  importDictionary(text: string, sourceType: string, overwrite: boolean) {
    return this.request<{ imported: number; skipped: number }>('/api/dictionary/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ text, source_type: sourceType, overwrite })
    });
  }

  logs() {
    return this.request<AppLogs>('/api/logs');
  }

  exports() {
    return this.request<{ exports: ExportRecord[] }>('/api/exports');
  }

  rerunExport(id: number) {
    return this.request<{ export: ExportRecord; exports: ExportRecord[] }>(`/api/exports/${id}/rerun`, { method: 'POST' });
  }

  deleteExport(id: number, deleteFile = false) {
    return this.request<{ status: string; exports: ExportRecord[] }>(`/api/exports/${id}`, { method: 'DELETE', body: JSON.stringify({ delete_file: deleteFile }) });
  }

  async download(url: string, filename: string) {
    const response = await fetch(url, { headers: this.token ? { Authorization: `Bearer ${this.token}` } : {} });
    if (!response.ok) throw new Error(await parseError(response));
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  }

  exportConfig() {
    return this.download('/api/settings/export', 'nh-archive-config.json');
  }
}

async function parseError(response: Response) {
  const type = response.headers.get('Content-Type') || '';
  if (type.includes('application/json')) {
    const detail = await response.json().catch(() => null);
    if (typeof detail?.detail === 'string') return detail.detail;
    if (typeof detail?.error === 'string') return detail.error;
    if (Array.isArray(detail?.detail)) return detail.detail.map((item: { msg?: string }) => item.msg || 'validation error').join('; ');
  }
  return (await response.text().catch(() => '')) || response.statusText;
}
