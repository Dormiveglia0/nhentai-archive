import { useEffect, useMemo, useState } from 'react';
import { LoginView, SetupView, Splash, type AuthPayload } from './components/Auth';
import { Shell, type ViewId } from './components/Shell';
import { ApiClient, type AppStatus, type Task, type Work } from './lib/api';
import { DashboardPage } from './views/DashboardPage';
import { DictionaryPage } from './views/DictionaryPage';
import { ExportsPage } from './views/ExportsPage';
import { FilesPage } from './views/FilesPage';
import { ImportPage } from './views/ImportPage';
import { LibraryPage } from './views/LibraryPage';
import { ReaderPage } from './views/ReaderPage';
import { SettingsPage } from './views/SettingsPage';
import { TasksPage } from './views/TasksPage';
import { WorkDetailPage } from './views/WorkDetailPage';

export function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [active, setActive] = useState<ViewId>('dashboard');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [selectedWork, setSelectedWork] = useState<number | null>(null);
  const [works, setWorks] = useState<Work[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [privacy, setPrivacy] = useState(() => localStorage.getItem('privacy_mode') === 'true');
  const [blurCovers, setBlurCovers] = useState(() => localStorage.getItem('blur_covers') === 'true');
  const api = useMemo(() => new ApiClient(token), [token]);

  async function refreshTasks() {
    if (!token) return;
    setTasks(await api.tasks());
  }

  async function refreshStatus() {
    if (!token) return;
    setStatus(await api.status());
  }

  async function refreshWorks() {
    if (!token) return;
    const data = await api.works();
    setWorks(data.works || []);
    setSummary(data.summary || {});
  }

  function navigate(view: ViewId, options: { replace?: boolean } = {}) {
    const normalized = view === 'reader' && selectedWork ? `#/reader/work/${selectedWork}` : view === 'dashboard' ? '#/' : `#/${view}`;
    setActive(view);
    if (!['reader', 'governance'].includes(view)) setSelectedWork(null);
    if (window.location.hash !== normalized) {
      if (options.replace) window.history.replaceState(null, '', normalized);
      else window.history.pushState(null, '', normalized);
    }
  }

  function openWork(work: Work | number, target: 'governance' | 'reader' = 'governance') {
    const id = typeof work === 'number' ? work : work.id;
    setSelectedWork(id);
    setActive(target);
    const hash = target === 'reader' ? `#/reader/work/${id}` : `#/governance/work/${id}`;
    if (window.location.hash !== hash) window.history.pushState(null, '', hash);
  }

  function syncRoute() {
    const parts = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    if (parts[0] === 'library' && parts[1] === 'work') {
      const id = Number(parts[2]);
      setActive('governance');
      setSelectedWork(Number.isFinite(id) && id > 0 ? id : null);
      return;
    }
    if ((parts[0] === 'governance' || parts[0] === 'reader') && parts[1] === 'work') {
      const id = Number(parts[2]);
      setActive(parts[0] as ViewId);
      setSelectedWork(Number.isFinite(id) && id > 0 ? id : null);
      return;
    }
    const aliases: Record<string, ViewId> = { import: 'discover' };
    const next = aliases[parts[0] || ''] || ((parts[0] || 'dashboard') as ViewId);
    if (['dashboard', 'discover', 'library', 'reader', 'governance', 'tasks', 'dictionary', 'files', 'exports', 'settings'].includes(next)) {
      setActive(next);
      if (!['reader', 'governance'].includes(next)) setSelectedWork(null);
    }
  }

  useEffect(() => {
    fetch('/api/setup/status')
      .then((response) => response.json())
      .then((data) => setNeedsSetup(Boolean(data.needs_setup)))
      .catch(() => setNeedsSetup(false));
  }, []);

  useEffect(() => {
    if (!window.location.hash) window.history.replaceState(null, '', '#/');
    syncRoute();
    window.addEventListener('popstate', syncRoute);
    window.addEventListener('hashchange', syncRoute);
    return () => {
      window.removeEventListener('popstate', syncRoute);
      window.removeEventListener('hashchange', syncRoute);
    };
  }, []);

  useEffect(() => {
    refreshTasks().catch(() => undefined);
    refreshStatus().catch(() => undefined);
    refreshWorks().catch(() => undefined);
    if (!token) return undefined;
    const timer = window.setInterval(() => {
      refreshTasks().catch(() => undefined);
      refreshStatus().catch(() => undefined);
    }, 3500);
    return () => window.clearInterval(timer);
  }, [token, api]);

  useEffect(() => localStorage.setItem('privacy_mode', String(privacy)), [privacy]);
  useEffect(() => localStorage.setItem('blur_covers', String(blurCovers)), [blurCovers]);

  function onAuth(payload: AuthPayload) {
    localStorage.setItem('token', payload.token);
    setToken(payload.token);
    setNeedsSetup(false);
  }

  function logout() {
    localStorage.removeItem('token');
    setToken(null);
    setTasks([]);
    setWorks([]);
    setSelectedWork(null);
    window.history.replaceState(null, '', '#/');
  }

  if (needsSetup === null) return <Splash />;
  if (needsSetup) return <SetupView onAuth={onAuth} />;
  if (!token) return <LoginView onAuth={onAuth} />;

  const fallbackWork = selectedWork || works[0]?.id || null;

  return (
    <Shell
      active={active}
      tasks={tasks}
      status={status}
      privacy={privacy}
      blurCovers={blurCovers}
      onNavigate={navigate}
      onLogout={logout}
      onPrivacy={setPrivacy}
      onBlurCovers={setBlurCovers}
    >
      {active === 'dashboard' ? <DashboardPage tasks={tasks} works={works} summary={summary} status={status} navigate={navigate} openWork={(work) => openWork(work)} /> : null}
      {active === 'discover' ? <ImportPage api={api} tasks={tasks} setTasks={setTasks} refreshTasks={refreshTasks} refreshWorks={refreshWorks} openWork={(work) => openWork(work)} /> : null}
      {active === 'library' ? <LibraryPage api={api} works={works} setWorks={setWorks} summary={summary} refreshWorks={refreshWorks} openWork={(work) => openWork(work)} /> : null}
      {active === 'governance' && fallbackWork ? <WorkDetailPage api={api} workId={fallbackWork} back={() => navigate('library')} refreshWorks={refreshWorks} openReader={(id) => openWork(id, 'reader')} /> : null}
      {active === 'governance' && !fallbackWork ? <EmptyRoute title="作品治理" text="先从我的库选择一本作品，或从发现页导入新的 CBZ。" /> : null}
      {active === 'reader' && fallbackWork ? <ReaderPage api={api} workId={fallbackWork} back={() => navigate('library')} openGovernance={(id) => openWork(id, 'governance')} /> : null}
      {active === 'reader' && !fallbackWork ? <EmptyRoute title="阅读器" text="库中还没有可阅读作品。导入或上传 CBZ 后，阅读器会显示分页。" /> : null}
      {active === 'tasks' ? <TasksPage api={api} tasks={tasks} refreshTasks={refreshTasks} openWork={(work) => openWork(work)} /> : null}
      {active === 'dictionary' ? <DictionaryPage api={api} /> : null}
      {active === 'files' ? <FilesPage api={api} works={works} status={status} refreshWorks={refreshWorks} openWork={(work) => openWork(work)} /> : null}
      {active === 'exports' ? <ExportsPage api={api} openWork={(work) => openWork(work)} /> : null}
      {active === 'settings' ? <SettingsPage api={api} refreshStatus={refreshStatus} /> : null}
    </Shell>
  );
}

function EmptyRoute({ title, text }: { title: string; text: string }) {
  return (
    <section className="page empty-route">
      <h1>{title}</h1>
      <p>{text}</p>
    </section>
  );
}
