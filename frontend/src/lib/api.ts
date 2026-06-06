export type Task = {
  id: number;
  gallery_id: number;
  status: string;
  title: string | null;
  error: string | null;
  progress_current: number;
  progress_total: number;
  cbz_path: string | null;
  created_at: string;
  updated_at: string;
};

export type DictionaryEntry = {
  id: number;
  source_type: string;
  source_text: string;
  translated_text: string;
  enabled: boolean;
};

export type Suggestion = {
  id: number;
  source_type: string;
  source_text: string;
  suggested_text: string;
  provider: string;
  status: string;
};

export type AppSettings = {
  translate_tags: boolean;
  translate_titles: boolean;
  translation_provider: 'none' | 'deepl' | 'google';
};

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  `${window.location.protocol}//${window.location.hostname}:8000`;

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
    const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(detail.detail || response.statusText);
    }
    if (response.status === 204) {
      return undefined as T;
    }
    return response.json() as Promise<T>;
  }

  downloadUrl(taskId: number): string {
    return `${API_BASE}/api/tasks/${taskId}/download`;
  }
}

export const apiBase = API_BASE;
