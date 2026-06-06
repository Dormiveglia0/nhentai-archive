import {
  BookOpen,
  Check,
  Download,
  FileArchive,
  Home,
  Import,
  KeyRound,
  Languages,
  Library,
  LogOut,
  RefreshCcw,
  Search,
  Settings,
  Tags,
  Trash2
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  ApiClient,
  type AppSettings,
  type DictionaryEntry,
  type Gallery,
  type Task,
  type TranslationItem
} from './lib/api';

type AuthPayload = { token: string; username: string };

const nav = [
  ['dashboard', Home, '概览'],
  ['import', Import, '导入'],
  ['tasks', RefreshCcw, '任务'],
  ['translate', Languages, '翻译'],
  ['dictionary', Tags, '词典'],
  ['files', FileArchive, '文件'],
  ['settings', Settings, '设置']
] as const;

export function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [active, setActive] = useState('dashboard');
  const [tasks, setTasks] = useState<Task[]>([]);
  const api = useMemo(() => new ApiClient(token), [token]);

  async function refreshTasks() {
    if (!token) return;
    const next = await api.request<Task[]>('/api/tasks');
    setTasks(Array.isArray(next) ? next : []);
  }

  useEffect(() => {
    fetch('/api/setup/status')
      .then((r) => r.json())
      .then((data) => setNeedsSetup(data.needs_setup))
      .catch(() => setNeedsSetup(false));
  }, []);

  useEffect(() => {
    refreshTasks().catch(() => undefined);
    const timer = window.setInterval(() => refreshTasks().catch(() => undefined), 3500);
    return () => window.clearInterval(timer);
  }, [token, api]);

  function onAuth(payload: AuthPayload) {
    localStorage.setItem('token', payload.token);
    setToken(payload.token);
    setNeedsSetup(false);
  }

  function logout() {
    localStorage.removeItem('token');
    setToken(null);
  }

  if (needsSetup === null) return <Splash />;
  if (needsSetup) return <SetupView onAuth={onAuth} />;
  if (!token) return <LoginView onAuth={onAuth} />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <BookOpen size={22} />
          <span>NH Archive</span>
        </div>
        <nav>
          {nav.map(([id, Icon, label]) => (
            <button className={`nav-item ${active === id ? 'active' : ''}`} key={id} onClick={() => setActive(id)}>
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <button className="ghost-button logout" onClick={logout}>
          <LogOut size={17} />
          <span>退出</span>
        </button>
      </aside>
      <main className="content">
        {active === 'dashboard' ? <Dashboard tasks={tasks} setActive={setActive} /> : null}
        {active === 'import' ? <ImportView api={api} refresh={refreshTasks} /> : null}
        {active === 'tasks' ? <TasksView api={api} tasks={tasks} refresh={refreshTasks} setActive={setActive} /> : null}
        {active === 'translate' ? <TranslateView api={api} tasks={tasks} refresh={refreshTasks} /> : null}
        {active === 'dictionary' ? <DictionaryView api={api} /> : null}
        {active === 'files' ? <FilesView api={api} tasks={tasks} /> : null}
        {active === 'settings' ? <SettingsView api={api} /> : null}
      </main>
    </div>
  );
}

function Splash() {
  return <div className="login-screen"><div className="login-panel">Loading</div></div>;
}

function SetupView({ onAuth }: { onAuth: (payload: AuthPayload) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    try {
      const api = new ApiClient(null);
      onAuth(await api.request<AuthPayload>('/api/setup/admin', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : '初始化失败');
    }
  }

  return (
    <AuthFrame title="首次运行" subtitle="创建管理员账户后才能访问平台。">
      <form className="stack" onSubmit={submit}>
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="管理员用户名" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="密码" />
        {error ? <p className="error-text">{error}</p> : null}
        <button className="primary-button">创建并登录</button>
      </form>
    </AuthFrame>
  );
}

function LoginView({ onAuth }: { onAuth: (payload: AuthPayload) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    try {
      const api = new ApiClient(null);
      onAuth(await api.request<AuthPayload>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    }
  }

  return (
    <AuthFrame title="管理员登录" subtitle="公网入口必须登录后使用。">
      <form className="stack" onSubmit={submit}>
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="用户名" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="密码" />
        {error ? <p className="error-text">{error}</p> : null}
        <button className="primary-button">登录</button>
      </form>
    </AuthFrame>
  );
}

function AuthFrame({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="login-screen">
      <section className="login-panel">
        <div className="login-icon"><KeyRound size={24} /></div>
        <h1>{title}</h1>
        <p className="muted">{subtitle}</p>
        {children}
      </section>
    </div>
  );
}

function Dashboard({ tasks, setActive }: { tasks: Task[]; setActive: (id: string) => void }) {
  const completed = tasks.filter((t) => t.status === 'completed').length;
  const failed = tasks.filter((t) => t.status === 'failed').length;
  const active = tasks.filter((t) => ['queued', 'downloading'].includes(t.status)).length;
  return (
    <section className="view">
      <header className="view-header">
        <h1>概览</h1>
        <button className="primary-button" onClick={() => setActive('import')}>新建导入</button>
      </header>
      <div className="metric-grid">
        <Metric label="队列中" value={active} />
        <Metric label="已完成" value={completed} />
        <Metric label="失败" value={failed} />
        <Metric label="总任务" value={tasks.length} />
      </div>
      <TaskCards tasks={tasks.slice(0, 6)} />
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
}

function ImportView({ api, refresh }: { api: ApiClient; refresh: () => Promise<void> }) {
  const [ids, setIds] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('date');
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<Gallery[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [message, setMessage] = useState('');

  async function importIds(nextIds: number[]) {
    await api.request('/api/tasks/import', { method: 'POST', body: JSON.stringify({ ids: nextIds }) });
    setSelected([]);
    await refresh();
    setMessage(`已加入 ${nextIds.length} 个任务`);
  }

  async function submitIds() {
    const parsed = ids.split(/[\s,，]+/).map((v) => Number(v)).filter((v) => v > 0);
    await importIds(parsed);
  }

  async function search() {
    setMessage('');
    const data = await api.request<{ result: Gallery[] }>(`/api/search?q=${encodeURIComponent(query)}&sort=${sort}&page=${page}`);
    setResults(Array.isArray(data.result) ? data.result : []);
  }

  return (
    <section className="view">
      <header className="view-header"><h1>搜索与导入</h1></header>
      <div className="import-grid">
        <div className="panel">
          <h2>ID 导入</h2>
          <textarea value={ids} onChange={(e) => setIds(e.target.value)} placeholder="654778&#10;654779,654780" />
          <button className="primary-button" onClick={submitIds}>加入队列</button>
          {message ? <p className="status-message">{message}</p> : null}
        </div>
        <div className="panel">
          <h2>关键词搜索</h2>
          <div className="search-row">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="作品名 / 作者 / 社团 / tag" />
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="date">最新</option>
              <option value="popular">热门</option>
            </select>
            <input value={page} min={1} onChange={(e) => setPage(Number(e.target.value) || 1)} type="number" />
            <button className="primary-button" onClick={search}><Search size={17} />搜索</button>
          </div>
        </div>
      </div>
      {results.length ? (
        <>
          <div className="actions">
            <button className="primary-button" onClick={() => importIds(selected)} disabled={!selected.length}>导入选中</button>
            <span className="muted">已选 {selected.length}</span>
          </div>
          <div className="gallery-grid">
            {results.map((item) => (
              <article className="gallery-card" key={item.id}>
                <label className="cover-check">
                  <input
                    type="checkbox"
                    checked={selected.includes(item.id)}
                    onChange={(e) => setSelected((prev) => e.target.checked ? [...prev, item.id] : prev.filter((id) => id !== item.id))}
                  />
                  {item.cover_url || item.thumb_url ? <img src={item.cover_url || item.thumb_url} alt="" /> : <div className="cover-fallback" />}
                </label>
                <strong>{item.title}</strong>
                <p>#{item.id} · {item.num_pages || '?'} pages · {item.language || 'unknown'}</p>
                <small>{(item.tag_sample || []).slice(0, 5).join(' / ')}</small>
              </article>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

function TasksView({ api, tasks, refresh, setActive }: { api: ApiClient; tasks: Task[]; refresh: () => Promise<void>; setActive: (id: string) => void }) {
  async function retry(id: number) {
    await api.request(`/api/tasks/${id}/retry`, { method: 'POST' });
    await refresh();
  }
  async function remove(id: number) {
    if (!confirm('删除任务和已生成文件？')) return;
    await api.request(`/api/tasks/${id}`, { method: 'DELETE' });
    await refresh();
  }
  return (
    <section className="view">
      <header className="view-header"><h1>任务</h1></header>
      <TaskTable tasks={tasks} actions={(task) => (
        <>
          {task.status === 'failed' ? <button className="icon-button" onClick={() => retry(task.id)} title="重试"><RefreshCcw size={16} /></button> : null}
          {task.status === 'completed' ? <button className="icon-button" onClick={() => setActive('translate')} title="翻译"><Languages size={16} /></button> : null}
          <button className="icon-button danger" onClick={() => remove(task.id)} title="删除"><Trash2 size={16} /></button>
        </>
      )} />
    </section>
  );
}

function TaskTable({ tasks, actions }: { tasks: Task[]; actions: (task: Task) => React.ReactNode }) {
  return (
    <div className="table">
      <div className="table-head task-grid"><span>封面</span><span>标题</span><span>状态</span><span>进度</span><span>操作</span></div>
      {tasks.map((task) => (
        <div className="table-row task-grid" key={task.id}>
          {task.cover_url ? <img className="thumb" src={task.cover_url} alt="" /> : <div className="thumb" />}
          <div><strong>{task.title || `#${task.gallery_id}`}</strong><p className="muted">#{task.gallery_id} {task.language || ''}</p>{task.error ? <p className="error-text">{task.error}</p> : null}</div>
          <span className={`badge ${task.status}`}>{task.status}</span>
          <span>{task.progress_current}/{task.progress_total || '?'}</span>
          <div className="actions">{actions(task)}</div>
        </div>
      ))}
      {!tasks.length ? <p className="empty">暂无任务</p> : null}
    </div>
  );
}

function TaskCards({ tasks }: { tasks: Task[] }) {
  return <div className="file-grid">{tasks.map((t) => <div className="file-card" key={t.id}>{t.cover_url ? <img className="wide-cover" src={t.cover_url} alt="" /> : null}<strong>{t.title || `#${t.gallery_id}`}</strong><span className={`badge ${t.status}`}>{t.status}</span></div>)}</div>;
}

function TranslateView({ api, tasks }: { api: ApiClient; tasks: Task[]; refresh: () => Promise<void> }) {
  const completed = tasks.filter((t) => t.status === 'completed');
  const [taskId, setTaskId] = useState<number>(0);
  const [items, setItems] = useState<TranslationItem[]>([]);
  const [translated, setTranslated] = useState<any>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [provider, setProvider] = useState('google_free_gtx');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!taskId && completed[0]) setTaskId(completed[0].id);
  }, [completed, taskId]);

  async function load() {
    if (!taskId) return;
    const data = await api.request<{ items: TranslationItem[]; translated: any }>(`/api/tasks/${taskId}/translation`);
    setItems(data.items || []);
    setTranslated(data.translated);
  }

  useEffect(() => { load().catch(() => undefined); }, [taskId]);

  async function dictionary() {
    const data = await api.request<{ translated: any }>(`/api/tasks/${taskId}/translation/dictionary`, { method: 'POST', body: '{}' });
    setTranslated(data.translated);
  }

  async function suggest() {
    const chosen = items.filter((item) => selected.includes(keyOf(item)));
    const suggestions = await api.request<any[]>(`/api/tasks/${taskId}/translation/suggest`, {
      method: 'POST',
      body: JSON.stringify({ provider, items: chosen })
    });
    setMessage(`生成 ${suggestions.length} 条建议；确认后可手动加入词典。`);
  }

  async function apply() {
    await api.request(`/api/tasks/${taskId}/translation/apply`, { method: 'POST', body: JSON.stringify({ translated }) });
    setMessage('已写入 ComicInfo.xml');
  }

  return (
    <section className="view">
      <header className="view-header"><h1>作品翻译</h1></header>
      <div className="settings-strip">
        <select value={taskId} onChange={(e) => setTaskId(Number(e.target.value))}>
          {completed.map((task) => <option key={task.id} value={task.id}>#{task.gallery_id} {task.title}</option>)}
        </select>
        <select value={provider} onChange={(e) => setProvider(e.target.value)}>
          <option value="google_free_gtx">Google 免费</option>
          <option value="deepl">DeepL</option>
          <option value="google_paid">Google API</option>
        </select>
        <button className="ghost-button" onClick={dictionary}>词典替换</button>
        <button className="ghost-button" onClick={suggest} disabled={!selected.length}>机器建议</button>
        <button className="primary-button" onClick={apply} disabled={!translated}>写入 ComicInfo</button>
      </div>
      {message ? <p className="status-message">{message}</p> : null}
      <div className="translation-grid">
        <div className="panel">
          <h2>原始元数据</h2>
          <div className="compact-list">
            {items.map((item) => (
              <label className="compact-row" key={keyOf(item)}>
                <input type="checkbox" checked={selected.includes(keyOf(item))} onChange={(e) => setSelected((prev) => e.target.checked ? [...prev, keyOf(item)] : prev.filter((v) => v !== keyOf(item)))} />
                <span>{item.source_type}</span>
                <strong>{item.source_text}</strong>
              </label>
            ))}
          </div>
        </div>
        <div className="panel">
          <h2>翻译预览</h2>
          <textarea value={JSON.stringify(translated, null, 2)} onChange={(e) => {
            try { setTranslated(JSON.parse(e.target.value)); } catch { setTranslated(e.target.value); }
          }} />
        </div>
      </div>
    </section>
  );
}

function keyOf(item: TranslationItem) {
  return `${item.source_type}:${item.source_text}`;
}

function DictionaryView({ api }: { api: ApiClient }) {
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [sourceType, setSourceType] = useState('tag');
  const [source, setSource] = useState('');
  const [translated, setTranslated] = useState('');
  const [bulk, setBulk] = useState('');
  const [overwrite, setOverwrite] = useState(true);
  const [message, setMessage] = useState('');

  async function load() {
    const next = await api.request<DictionaryEntry[]>('/api/dictionary');
    setEntries(Array.isArray(next) ? next : []);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    await api.request('/api/dictionary', { method: 'POST', body: JSON.stringify({ source_type: sourceType, source_text: source, translated_text: translated, enabled: true }) });
    setSource('');
    setTranslated('');
    await load();
  }
  async function importBulk() {
    const result = await api.request<any>('/api/dictionary/bulk', { method: 'POST', body: JSON.stringify({ source_type: sourceType, text: bulk, overwrite }) });
    setMessage(`导入 ${result.imported} 条，跳过 ${result.skipped} 条`);
    await load();
  }
  async function remove(id: number) {
    await api.request(`/api/dictionary/${id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <section className="view">
      <header className="view-header"><h1>词典</h1></header>
      <div className="dictionary-grid">
        <div className="panel">
          <h2>单条词条</h2>
          <div className="inline-form">
            <TypeSelect value={sourceType} onChange={setSourceType} />
            <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="原文" />
            <input value={translated} onChange={(e) => setTranslated(e.target.value)} placeholder="译文" />
            <button className="primary-button" onClick={add}>保存</button>
          </div>
        </div>
        <div className="panel">
          <h2>批量导入</h2>
          <textarea value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder="原文=译文&#10;artist=作者" />
          <label className="checkbox-line"><input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />覆盖已有词条</label>
          <button className="primary-button" onClick={importBulk}>导入</button>
          {message ? <p className="status-message">{message}</p> : null}
        </div>
      </div>
      <div className="table">
        <div className="table-head dict-grid"><span>类型</span><span>原文</span><span>译文</span><span>操作</span></div>
        {entries.map((entry) => (
          <div className="table-row dict-grid" key={entry.id}>
            <span>{entry.source_type}</span><strong>{entry.source_text}</strong><span>{entry.translated_text}</span>
            <button className="icon-button danger" onClick={() => remove(entry.id)}><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
    </section>
  );
}

function TypeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {['tag', 'title', 'artist', 'group', 'parody', 'character', 'language', 'category'].map((t) => <option key={t} value={t}>{t}</option>)}
    </select>
  );
}

function FilesView({ api, tasks }: { api: ApiClient; tasks: Task[] }) {
  const completed = tasks.filter((task) => task.status === 'completed');
  return (
    <section className="view">
      <header className="view-header"><h1>文件</h1></header>
      <div className="file-grid">
        {completed.map((task) => (
          <article className="file-card" key={task.id}>
            {task.cover_url ? <img className="wide-cover" src={task.cover_url} alt="" /> : null}
            <strong>{task.title || `#${task.gallery_id}`}</strong>
            <p>#{task.gallery_id} · {task.progress_total} pages</p>
            <button className="primary-button" onClick={() => api.download(task)}><Download size={17} />下载 CBZ</button>
          </article>
        ))}
        {!completed.length ? <p className="empty">暂无已完成文件</p> : null}
      </div>
    </section>
  );
}

function SettingsView({ api }: { api: ApiClient }) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');

  async function load() {
    setSettings(await api.request<AppSettings>('/api/settings'));
  }
  useEffect(() => { load(); }, []);

  async function save(next: Partial<AppSettings>) {
    setSettings(await api.request<AppSettings>('/api/settings', { method: 'PATCH', body: JSON.stringify(next) }));
  }
  async function saveSecrets() {
    const result = await api.request<any>('/api/settings/secrets', { method: 'PATCH', body: JSON.stringify(secrets) });
    setSettings((prev) => prev ? { ...prev, secrets: result.secrets } : prev);
    setSecrets({});
    setMessage('密钥已保存');
  }

  if (!settings) return <section className="view"><h1>设置</h1></section>;
  return (
    <section className="view">
      <header className="view-header"><h1>设置</h1></header>
      <div className="panel">
        <h2>翻译</h2>
        <label className="checkbox-line"><input type="checkbox" checked={settings.translate_tags} onChange={(e) => save({ translate_tags: e.target.checked })} />写入翻译 tag</label>
        <label className="checkbox-line"><input type="checkbox" checked={settings.translate_titles} onChange={(e) => save({ translate_titles: e.target.checked })} />写入翻译标题</label>
        <select value={settings.translation_provider} onChange={(e) => save({ translation_provider: e.target.value as AppSettings['translation_provider'] })}>
          <option value="google_free_gtx">Google 免费</option>
          <option value="deepl">DeepL</option>
          <option value="google_paid">Google API</option>
          <option value="none">无机器翻译</option>
        </select>
      </div>
      <div className="panel">
        <h2>连接密钥</h2>
        <input value={settings.nhentai_user_agent} onChange={(e) => setSettings({ ...settings, nhentai_user_agent: e.target.value })} onBlur={() => save({ nhentai_user_agent: settings.nhentai_user_agent })} placeholder="User-Agent" />
        <SecretInput label="nhentai API key" name="nhentai_api_key" settings={settings} values={secrets} setValues={setSecrets} />
        <SecretInput label="DeepL API key" name="deepl_api_key" settings={settings} values={secrets} setValues={setSecrets} />
        <SecretInput label="Google Translate API key" name="google_translate_api_key" settings={settings} values={secrets} setValues={setSecrets} />
        <button className="primary-button" onClick={saveSecrets}>保存密钥</button>
        {message ? <p className="status-message">{message}</p> : null}
      </div>
      <div className="panel">
        <h2>存储</h2>
        <p className="muted">CBZ 保存路径：{settings.library_dir}</p>
      </div>
    </section>
  );
}

function SecretInput({ label, name, settings, values, setValues }: { label: string; name: string; settings: AppSettings; values: Record<string, string>; setValues: (v: Record<string, string>) => void }) {
  const state = settings.secrets?.[name];
  return (
    <label>
      <span>{label} {state?.configured ? `已配置 ${state.masked}` : '未配置'}</span>
      <input value={values[name] || ''} onChange={(e) => setValues({ ...values, [name]: e.target.value })} type="password" placeholder="输入新值后保存" />
    </label>
  );
}
