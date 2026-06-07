import {
  Activity,
  BookOpen,
  Database,
  Grid2X2,
  Import,
  ListTodo,
  LogOut,
  Settings,
  Tags
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { AppStatus, Task } from '../lib/api';

export type ViewId = 'dashboard' | 'import' | 'library' | 'tasks' | 'dictionary' | 'settings';

const nav = [
  ['dashboard', Grid2X2, '总览'],
  ['import', Import, '搜索'],
  ['library', BookOpen, '我的库'],
  ['tasks', ListTodo, '队列'],
  ['dictionary', Tags, '词典'],
  ['settings', Settings, '设置']
] as const;

export function Shell({
  active,
  tasks,
  status,
  onNavigate,
  onLogout,
  children
}: {
  active: ViewId;
  tasks: Task[];
  status: AppStatus | null;
  onNavigate: (view: ViewId) => void;
  onLogout: () => void;
  children: ReactNode;
}) {
  const running = tasks.filter((task) => ['queued', 'running', 'downloading'].includes(task.status)).length;
  const failed = tasks.filter((task) => task.status === 'failed').length;

  return (
    <div className="app-shell manga-shell">
      <aside className="sidebar manga-rail" aria-label="主导航">
        <button className="brand manga-brand" type="button" onClick={() => onNavigate('dashboard')}>
          <span className="brand-mark">NH</span>
          <span>Archive</span>
        </button>
        <nav className="nav-list">
          {nav.map(([id, Icon, label]) => (
            <button className={`nav-item ${active === id ? 'active' : ''}`} key={id} type="button" onClick={() => onNavigate(id)}>
              <Icon size={18} />
              <span>{label}</span>
              {id === 'tasks' && running > 0 ? <span className="nav-count">{running}</span> : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="storage-mini">
            <div>
              <span>存储空间</span>
              <strong>{formatBytes(status?.storage.free_bytes || 0)}</strong>
            </div>
            <div className="mini-meter"><span style={{ width: storageWidth(status) }} /></div>
          </div>
          <button className="nav-item" type="button" onClick={onLogout}>
            <LogOut size={18} />
            <span>退出</span>
          </button>
        </div>
      </aside>
      <main className="main-frame manga-main">
        <header className="status-header manga-statusbar">
          <StatusPill icon={<Activity size={15} />} label="数据源" value={status?.api.key_configured ? '密钥已配置' : '缺少密钥'} state={status?.api.key_configured ? 'good' : 'warn'} />
          <StatusPill icon={<Database size={15} />} label="CDN" value={`${status?.cdn.servers?.length || 0} 个节点`} state={(status?.cdn.servers?.length || 0) > 0 ? 'good' : 'warn'} />
          <StatusPill icon={<Tags size={15} />} label="翻译" value={translationName(status?.translation.provider)} state={status?.translation.provider === 'none' ? 'warn' : 'good'} />
          <button className={`task-indicator ${failed ? 'danger' : ''}`} type="button" onClick={() => onNavigate('tasks')}>
            <ListTodo size={15} />
            <span>{running} 个运行中</span>
            {failed ? <strong>{failed} 个失败</strong> : null}
          </button>
        </header>
        {children}
      </main>
    </div>
  );
}

function StatusPill({ icon, label, value, state }: { icon: ReactNode; label: string; value: string; state: 'good' | 'warn' }) {
  return (
    <div className={`status-pill ${state}`}>
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function storageWidth(status: AppStatus | null) {
  if (!status?.storage.total_bytes) return '0%';
  const used = status.storage.total_bytes - status.storage.free_bytes;
  return `${Math.min(100, Math.max(0, (used / status.storage.total_bytes) * 100))}%`;
}

function formatBytes(value: number) {
  if (!value) return 'n/a';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let next = value;
  let unit = 0;
  while (next > 1024 && unit < units.length - 1) {
    next /= 1024;
    unit++;
  }
  return `${next.toFixed(next > 10 ? 0 : 1)} ${units[unit]}`;
}

function translationName(value?: string) {
  switch (value) {
    case 'google_free_gtx':
      return 'Google 免费';
    case 'deepl':
      return 'DeepL';
    case 'google_paid':
      return 'Google API';
    default:
      return '未启用';
  }
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}
