import {
  Archive,
  BookOpen,
  CheckCircle2,
  Download,
  EyeOff,
  FileArchive,
  Files,
  Grid2X2,
  Import,
  Library,
  ListTodo,
  LogOut,
  Search,
  Settings,
  SlidersHorizontal,
  Tags,
  Upload
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { AppStatus, Task } from '../lib/api';
import { progress, statusText } from '../views/TaskQueueDrawer';

export type ViewId = 'dashboard' | 'discover' | 'library' | 'reader' | 'governance' | 'dictionary' | 'tasks' | 'files' | 'exports' | 'settings';

const nav = [
  ['dashboard', Grid2X2, '工作台'],
  ['library', Library, '我的库'],
  ['discover', Search, '发现'],
  ['reader', BookOpen, '阅读'],
  ['governance', Archive, '治理'],
  ['dictionary', Tags, '词典'],
  ['tasks', ListTodo, '队列'],
  ['exports', Download, '导出'],
  ['files', Files, '文件'],
  ['settings', Settings, '设置']
] as const;

export function Shell({
  active,
  tasks,
  status,
  privacy,
  blurCovers,
  onNavigate,
  onLogout,
  onPrivacy,
  onBlurCovers,
  children
}: {
  active: ViewId;
  tasks: Task[];
  status: AppStatus | null;
  privacy: boolean;
  blurCovers: boolean;
  onNavigate: (view: ViewId) => void;
  onLogout: () => void;
  onPrivacy: (value: boolean) => void;
  onBlurCovers: (value: boolean) => void;
  children: ReactNode;
}) {
  const running = tasks.filter((task) => ['queued', 'running', 'downloading'].includes(task.status)).length;
  const failed = tasks.filter((task) => task.status === 'failed').length;

  return (
    <div className={`archive-app ${privacy ? 'privacy-on' : ''} ${blurCovers ? 'blur-covers' : ''}`}>
      <header className="global-header">
        <button className="wordmark" type="button" onClick={() => onNavigate('dashboard')} aria-label="返回工作台">
          <strong>NH</strong>
          <span>ARCHIVE<small>アーカイブ</small></span>
          <i>私藏</i>
        </button>
        <label className="global-search">
          <Search size={18} />
          <input placeholder="搜索 书名 / 团子 / 作者 / 标签..." onKeyDown={(event) => {
            if (event.key === 'Enter') onNavigate('library');
          }} />
          <kbd>/</kbd>
        </label>
        <div className="header-tools">
          <button type="button" className="plain-tool" onClick={() => onNavigate('tasks')}>
            <ListTodo size={17} />队列{running ? <b>{running}</b> : null}
          </button>
          <Toggle label="隐私模式" checked={privacy} onChange={onPrivacy} icon={<EyeOff size={16} />} />
          <Toggle label="封面模糊" checked={blurCovers} onChange={onBlurCovers} />
          <button type="button" className="plain-tool" onClick={() => onNavigate('discover')}><Upload size={17} />导入</button>
          <button type="button" className="plain-tool" onClick={() => onNavigate('exports')}><Download size={17} />导出</button>
          <button type="button" className="account-chip" onClick={onLogout}>
            <span>NH</span>
            <strong>NH_Collector</strong>
            <LogOut size={16} />
          </button>
        </div>
      </header>
      <nav className="section-nav" aria-label="主导航">
        {nav.map(([id, Icon, label]) => (
          <button key={id} type="button" className={active === id ? 'active' : ''} onClick={() => onNavigate(id)}>
            <Icon size={16} />
            <span>{label}</span>
            {id === 'tasks' && running ? <b>{running}</b> : null}
          </button>
        ))}
      </nav>
      <main className="archive-main">{children}</main>
      <TaskDock tasks={tasks} status={status} failed={failed} onNavigate={onNavigate} />
    </div>
  );
}

export function PageHero({
  title,
  seal,
  subtitle,
  quote,
  children
}: {
  title: string;
  seal?: string;
  subtitle: string;
  quote?: string;
  children?: ReactNode;
}) {
  return (
    <section className="page-hero">
      <div>
        <h1>{title}{seal ? <small>{seal}</small> : null}</h1>
        <p>{subtitle}</p>
        {children}
      </div>
      <div className="hero-sketch" aria-hidden="true" />
      <blockquote>{quote || '在纸与墨的世界里，我们收藏的不是作品，而是创作者的心意与时光。'}<span>- NH Archive</span></blockquote>
    </section>
  );
}

export function StatStrip({ items }: { items: { label: string; value: ReactNode; hint?: string; icon?: ReactNode; tone?: 'red' | 'green' | 'amber' | 'blue' }[] }) {
  return (
    <section className="stat-strip">
      {items.map((item) => (
        <article className={`stat-card ${item.tone || ''}`} key={item.label}>
          {item.icon ? <div className="stat-icon">{item.icon}</div> : null}
          <div>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            {item.hint ? <small>{item.hint}</small> : null}
          </div>
        </article>
      ))}
    </section>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="legacy-page-header">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}

function Toggle({ label, checked, onChange, icon }: { label: string; checked: boolean; onChange: (value: boolean) => void; icon?: ReactNode }) {
  return (
    <label className="top-toggle">
      {icon}
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <i />
    </label>
  );
}

function TaskDock({ tasks, status, failed, onNavigate }: { tasks: Task[]; status: AppStatus | null; failed: number; onNavigate: (view: ViewId) => void }) {
  const active = tasks.filter((task) => ['queued', 'running', 'downloading'].includes(task.status)).slice(0, 3);
  return (
    <aside className="task-dock">
      <button type="button" className="dock-title" onClick={() => onNavigate('tasks')}>
        <CheckCircle2 size={20} />
        <strong>任务中心</strong>
        {failed ? <b>{failed}</b> : null}
      </button>
      {active.length ? active.map((task) => (
        <button key={task.id} type="button" className="dock-task" onClick={() => onNavigate('tasks')}>
          <FileArchive size={18} />
          <span>
            <strong>{task.title || task.message || `任务 #${task.id}`}</strong>
            <small>{statusText(task.status)} · {progress(task)}%</small>
          </span>
          <i><em style={{ width: `${progress(task)}%` }} /></i>
        </button>
      )) : <p>暂无运行任务</p>}
      <button type="button" className="dock-more" onClick={() => onNavigate('settings')}>
        <SlidersHorizontal size={16} />
        {status?.api.key_configured ? '源已配置' : '配置数据源'}
      </button>
    </aside>
  );
}
