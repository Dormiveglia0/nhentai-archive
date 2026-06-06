export type Task = {
  id: number;
  gallery_id: number;
  status: string;
  title: string | null;
  cover_url: string | null;
  language: string | null;
  error: string | null;
  progress_current: number;
  progress_total: number;
  cbz_path: string | null;
  created_at: string;
  updated_at: string;
};

export type Gallery = {
  id: number;
  media_id: string;
  title: string;
  cover_url: string;
  thumb_url: string;
  num_pages: number;
  language: string;
  tag_sample: string[];
};

export type DictionaryEntry = {
  id: number;
  source_type: string;
  source_text: string;
  translated_text: string;
  enabled: boolean;
};

export type TranslationItem = {
  source_type: string;
  source_text: string;
};

export type AppSettings = {
  translate_tags: boolean;
  translate_titles: boolean;
  translation_provider: 'none' | 'google_free_gtx' | 'deepl' | 'google_paid';
  nhentai_user_agent: string;
  library_dir: string;
  secrets: Record<string, { configured: boolean; masked: string }>;
};

export class ApiClient {
  token: string | null;

  constructor(token: string | null) {
    this.token = token;
  }

  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers);
    if (!(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }
    const response = await fetch(path, { ...options, headers });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(detail.detail || response.statusText);
    }
    return response.json() as Promise<T>;
  }

  async download(task: Task) {
    const response = await fetch(`/api/tasks/${task.id}/download`, {
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : {}
    });
    if (!response.ok) throw new Error(response.statusText);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${task.gallery_id} - ${task.title || 'untitled'}.cbz`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}
