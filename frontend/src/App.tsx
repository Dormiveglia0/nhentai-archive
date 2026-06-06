import { useEffect, useMemo, useState } from 'react';
import { Shell } from './components/Shell';
import { ApiClient, type Task } from './lib/api';
import { DictionaryView } from './views/DictionaryView';
import { FilesView } from './views/FilesView';
import { ImportView } from './views/ImportView';
import { LoginView } from './views/LoginView';
import { TasksView } from './views/TasksView';

export function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [active, setActive] = useState('import');
  const [tasks, setTasks] = useState<Task[]>([]);
  const api = useMemo(() => new ApiClient(token), [token]);

  async function refreshTasks() {
    if (!token) return;
    setTasks(await api.request<Task[]>('/api/tasks'));
  }

  useEffect(() => {
    refreshTasks().catch(() => undefined);
    const timer = window.setInterval(() => refreshTasks().catch(() => undefined), 4000);
    return () => window.clearInterval(timer);
  }, [token, api]);

  function login(nextToken: string) {
    localStorage.setItem('token', nextToken);
    setToken(nextToken);
  }

  function logout() {
    localStorage.removeItem('token');
    setToken(null);
  }

  if (!token) {
    return <LoginView onLogin={login} />;
  }

  return (
    <Shell active={active} onActive={setActive} onLogout={logout}>
      {active === 'import' ? <ImportView api={api} onImported={refreshTasks} /> : null}
      {active === 'tasks' ? <TasksView api={api} tasks={tasks} refresh={refreshTasks} /> : null}
      {active === 'dictionary' ? <DictionaryView api={api} /> : null}
      {active === 'files' ? <FilesView api={api} tasks={tasks} refresh={refreshTasks} /> : null}
    </Shell>
  );
}
