import { ChevronDown, Download, EyeOff, ListTodo, Search, Upload } from 'lucide-react';
import type { ReactNode } from 'react';
import archiveRoom from '../assets/archive-room.svg';
import { nav, type View } from '../lib/navigation';
import type { AppState, ExportJob, Task, Work } from '../lib/mock';
import { Cover } from './Cover';

export function Splash() {
  return <div className="splash">NH Archive</div>;
}

export function TopChrome({ view, state, onView, onLogout }: { view: View; state: AppState; onView: (view: View) => void; onLogout: () => void }) {
  const queue = state.tasks.filter((task) => task.status === 'running' || task.status === 'queued').length;
  return (
    <header className="top">
      <div className="top-row">
        <button className="logo-button" onClick={() => onView('dashboard')}><Logo /></button>
        <label className="global-search"><Search size={17} /><input placeholder="搜索 书名 / 团子 / 作者 / 标签..." /><kbd>/</kbd></label>
        <div className="top-actions">
          <button onClick={() => onView('queue')}><ListTodo size={16} />队列 <b>{queue}</b></button>
          <Toggle icon={<EyeOff size={15} />} label="隐私模式" />
          <Toggle label="封面模糊" active />
          <button onClick={() => onView('discover')}><Upload size={16} />导入</button>
          <button onClick={() => onView('exports')}><Download size={16} />导出</button>
          <button className="avatar" onClick={onLogout}><span>NH</span><strong>NH_Collector</strong><ChevronDown size={14} /></button>
        </div>
      </div>
      <nav className="nav">
        {nav.map((item) => (
          <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => onView(item.id)}>{item.label}{item.id === 'queue' ? <b>{queue}</b> : null}</button>
        ))}
      </nav>
    </header>
  );
}

export function Logo({ large }: { large?: boolean }) {
  return (
    <div className={`logo ${large ? 'large' : ''}`}>
      <strong>NH</strong>
      <span>ARCHIVE<small>アーカイブ</small></span>
      <i>秘藏</i>
    </div>
  );
}

export function Toggle({ label, icon, active }: { label: string; icon?: ReactNode; active?: boolean }) {
  return <button className="toggle">{icon}<span>{label}</span><em className={active ? 'on' : ''} /></button>;
}

export function PageHero({ title, seal, desc }: { title: string; seal: string; desc: string }) {
  return (
    <section className="hero">
      <div>
        <h1>{title}<small>{seal}</small></h1>
        <p>{desc}</p>
      </div>
      <img src={archiveRoom} alt="" />
      <blockquote>在纸与墨的世界里，<br />我们收藏的不是作品，<br />而是创作者的心意与时光。<span>- NH Archive</span></blockquote>
    </section>
  );
}

export function StatRail({ items }: { items: { icon: ReactNode; label: string; value: string | number; hint: string }[] }) {
  return (
    <section className="stat-rail">
      {items.map((item) => <article key={item.label}><div>{item.icon}</div><span>{item.label}</span><strong>{item.value}</strong><small>{item.hint}</small></article>)}
    </section>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return <div className="page">{children}</div>;
}

export function Panel({ title, action, badge, children }: { title: string; action?: ReactNode; badge?: string; children: ReactNode }) {
  return <section className="panel"><header><h2>{title}</h2>{badge ? <TagChip>{badge}</TagChip> : null}{action}</header>{children}</section>;
}

export function Info({ label, value }: { label: string; value: string | number }) {
  return <div className="info"><span>{label}</span><strong>{value}</strong></div>;
}

export function Progress({ label, value, slim }: { label?: string; value: number; slim?: boolean }) {
  return <div className={`progress ${slim ? 'slim' : ''}`}>{label ? <span>{label}</span> : null}<i><em style={{ width: `${value}%` }} /></i><strong>{value}%</strong></div>;
}

export function TagChip({ children }: { children: ReactNode }) {
  return <span className="tag-chip">{children}</span>;
}

export function BulkBar() {
  return <aside className="bulk-bar"><strong>已选择 4 项</strong><button>清空选择</button><button>批量编辑</button><button>批量标签</button><button>批量状态</button><button>批量导出</button><button className="danger">删除</button></aside>;
}

export function TaskDock({ tasks, onView }: { tasks: Task[]; onView: () => void }) {
  return <aside className="task-dock"><button className="dock-title" onClick={onView}><span>任务中心</span><b>{tasks.filter((task) => task.status === 'running' || task.status === 'queued').length}</b></button>{tasks.slice(0, 3).map((task) => <div className="dock-task" key={task.id}><strong>{task.type}</strong><span>{task.title}</span><Progress value={task.progress} slim /></div>)}<button onClick={onView}>查看全部任务</button></aside>;
}

export function TaskList({ tasks }: { tasks: Task[] }) {
  return <div className="simple-list">{tasks.map((task) => <div key={task.id}><strong>{task.title}</strong><span>{task.phase} · {task.progress}%</span><Progress value={task.progress} slim /></div>)}</div>;
}

export function TaskRows({ tasks }: { tasks: Task[] }) {
  return <div className="task-rows"><div className="row head"><span>任务</span><span>目标 / 文件</span><span>阶段</span><span>进度</span><span>时间</span><span>操作</span></div>{tasks.map((task, index) => <div className={`row ${index === 0 ? 'active' : ''}`} key={task.id}><span><i className={`task-icon ${task.status}`} />{task.type}<small>{task.status}</small></span><strong>{task.title}<small>{task.target}</small></strong><span>{task.phase}</span><Progress value={task.progress} slim /><span>{task.eta}</span><span><button>{task.status === 'failed' ? '重试' : '暂停'}</button><button>查看日志</button></span></div>)}</div>;
}

export function ExportRows({ exports, works, onWork }: { exports: ExportJob[]; works: Work[]; onWork: (work: Work) => void }) {
  return <div className="export-rows"><div className="row head"><span>作品</span><span>输出名称</span><span>状态</span><span>警告</span><span>使用预设</span></div>{exports.map((item) => { const work = works.find((w) => w.id === item.workId) || works[0]; return <div className="row" key={item.id} onClick={() => onWork(work)}><span className="work-line"><Cover src={work.cover} title={work.title} small /><strong>{work.title}<small>{work.originalTitle}</small></strong></span><span>{item.filename}<small>{item.size}</small></span><span>{item.status === 'ready' ? '就绪' : '警告'}</span><span>{item.warnings.join(' / ') || '-'}</span><span>{item.preset}</span></div>; })}</div>;
}

export function FileRows({ works, onWork }: { works: Work[]; onWork: (work: Work) => void }) {
  return <div className="file-rows"><div className="row head"><span>文件名</span><span>路径</span><span>大小</span><span>状态</span><span>来源</span><span>最近修改</span></div>{works.slice(0, 8).map((work, index) => <div className={`row ${index === 0 ? 'active' : ''}`} key={work.id} onClick={() => onWork(work)}><strong>{work.originalTitle} [{work.sourceId}].cbz</strong><span>/data/archives/{work.sourceId}.cbz</span><span>{work.size}</span><span>{index === 3 ? '缺失封面' : '正常'}</span><span>{index % 2 ? '扫描' : '导入'}</span><span>2024-05-02 11:32</span></div>)}</div>;
}

export function MiniWorks({ works }: { works: Work[] }) {
  return <div className="mini-works">{works.map((work) => <div key={work.id}><Cover src={work.cover} title={work.title} small /><strong>{work.title}</strong><span>{work.pages}P</span></div>)}</div>;
}

export function FormLine({ label, value }: { label: string; value: string }) {
  return <label className="form-line"><span>{label}</span><input defaultValue={value} /></label>;
}

export function ActionBar({ primary, actions }: { primary: string; actions: string[] }) {
  return <aside className="action-bar">{actions.map((action) => <button key={action}>{action}</button>)}<button className="primary">{primary}</button></aside>;
}
