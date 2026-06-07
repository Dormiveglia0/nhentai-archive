import { useEffect, useMemo, useState } from 'react';
import { LoginView, SetupView, Splash, type AuthPayload } from './components/Auth';
import { Shell, type ViewId } from './components/Shell';
import { ApiClient, type AppStatus, type Task, type Work } from './lib/api';
import { DashboardPage } from './views/DashboardPage';
import { DictionaryPage } from './views/DictionaryPage';
import { ImportPage } from './views/ImportPage';
import { LibraryPage } from './views/LibraryPage';
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
    setActive(view);
    if (view !== 'library') setSelectedWork(null);
    const hash = view === 'dashboard' ? '#/' : `#/${view}`;
    if (window.location.hash !== hash) {
      if (options.replace) window.history.replaceState(null, '', hash);
      else window.history.pushState(null, '', hash);
    }
  }

  function openWork(work: Work | number) {
    const id = typeof work === 'number' ? work : work.id;
    setSelectedWork(id);
    setActive('library');
    const hash = `#/library/work/${id}`;
    if (window.location.hash !== hash) window.history.pushState(null, '', hash);
  }

  function syncRoute() {
    const hash = window.location.hash.replace(/^#\/?/, '');
    const parts = hash.split('/').filter(Boolean);
    if (parts[0] === 'library' && parts[1] === 'work') {
      const id = Number(parts[2]);
      setActive('library');
      setSelectedWork(Number.isFinite(id) && id > 0 ? id : null);
      return;
    }
    const next = (parts[0] || 'dashboard') as ViewId;
    if (['dashboard', 'import', 'library', 'tasks', 'dictionary', 'settings'].includes(next)) {
      setActive(next);
      setSelectedWork(null);
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

  return (
    <Shell active={active} tasks={tasks} status={status} onNavigate={navigate} onLogout={logout}>
      {active === 'dashboard' ? <DashboardPage tasks={tasks} works={works} summary={summary} status={status} navigate={navigate} openWork={openWork} /> : null}
      {active === 'import' ? <ImportPage api={api} tasks={tasks} setTasks={setTasks} refreshTasks={refreshTasks} refreshWorks={refreshWorks} openWork={openWork} /> : null}
      {active === 'library' && selectedWork ? <WorkDetailPage api={api} workId={selectedWork} back={() => navigate('library')} refreshWorks={refreshWorks} /> : null}
      {active === 'library' && !selectedWork ? <LibraryPage api={api} works={works} setWorks={setWorks} summary={summary} refreshWorks={refreshWorks} openWork={openWork} /> : null}
      {active === 'tasks' ? <TasksPage api={api} tasks={tasks} refreshTasks={refreshTasks} openWork={openWork} /> : null}
      {active === 'dictionary' ? <DictionaryPage api={api} /> : null}
      {active === 'settings' ? <SettingsPage api={api} refreshStatus={refreshStatus} /> : null}
    </Shell>
  );
}
