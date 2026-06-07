import { mockState, type AppState, type DictionaryTerm, type ExportJob, type Gallery, type SettingsState, type Task, type Work } from './mock';

export type AuthPayload = { token: string; username: string };
export type SetupStatus = { needs_setup: boolean };

class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function allowMockFallback() {
  return import.meta.env.DEV && import.meta.env.VITE_ENABLE_MOCK === 'true';
}

export class ApiClient {
  token: string | null;

  constructor(token: string | null) {
    this.token = token;
  }

  async setupStatus() {
    return requestOrMock<SetupStatus>('/api/auth/setup-status', { needs_setup: false });
  }

  async setupAdmin(username: string, password: string) {
    return requestJSON<AuthPayload>('/api/auth/setup-admin', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
  }

  async login(username: string, password: string) {
    return requestJSON<AuthPayload>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
  }

  async appState() {
    return requestOrMock<AppState>('/api/app/state', mockState, this.headers());
  }

  async settings() {
    return requestOrMock<SettingsState>('/api/settings', mockState.settings, this.headers());
  }

  async discover() {
    return requestOrMock<{ galleries: Gallery[] }>('/api/discover/feed', { galleries: mockState.galleries }, this.headers());
  }

  async works() {
    return requestOrMock<{ works: Work[] }>('/api/library/works', { works: mockState.works }, this.headers());
  }

  async tasks() {
    return requestOrMock<{ tasks: Task[] }>('/api/tasks', { tasks: mockState.tasks }, this.headers());
  }

  async dictionary() {
    return requestOrMock<{ terms: DictionaryTerm[] }>('/api/dictionary/terms', { terms: mockState.dictionary }, this.headers());
  }

  async exports() {
    return requestOrMock<{ exports: ExportJob[] }>('/api/exports', { exports: mockState.exports }, this.headers());
  }

  headers(options: RequestInit = {}) {
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');
    if (this.token) headers.set('Authorization', `Bearer ${this.token}`);
    return { ...options, headers };
  }
}

async function requestOrMock<T>(path: string, fallback: T, options: RequestInit = {}): Promise<T> {
  try {
    const response = await fetch(path, options);
    if (!response.ok) throw new ApiError(response.status, await response.text());
    return await response.json() as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (allowMockFallback()) return fallback;
    throw error;
  }
}

async function requestJSON<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  const response = await fetch(path, { ...options, headers });
  if (!response.ok) throw new ApiError(response.status, await response.text());
  return await response.json() as T;
}
