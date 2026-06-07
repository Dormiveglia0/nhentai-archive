import { BookOpen, Database, Download, Import, ListTodo, ShieldCheck, Tags } from 'lucide-react';
import { Cover } from '../components/Cover';
import { PageHero, StatStrip, type ViewId } from '../components/Shell';
import type { AppStatus, Task, Work } from '../lib/api';
import { progress, statusText } from './TaskQueueDrawer';

export function DashboardPage({
  tasks,
  works,
  summary,
  status,
  navigate,
  openWork
}: {
  tasks: Task[];
  works: Work[];
  summary: Record<string, number>;
  status: AppStatus | null;
  navigate: (view: ViewId) => void;
  openWork: (work: Work) => void;
}) {
  const activeTasks = tasks.filter((task) => ['queued', 'running', 'downloading'].includes(task.status));
  const failed = tasks.filter((task) => task.status === 'failed').length;

  return (
    <section className="page home-page">
      <PageHero title="工作台" seal="私藏" subtitle="本地优先的私人同人志馆藏平台。发现、阅读、治理、导出都从这里进入。">
        <div className="hero-actions">
          <button className="primary-button" type="button" onClick={() => navigate('discover')}><Import size={17} />发现 / 导入</button>
          <button className="ghost-button" type="button" onClick={() => navigate('library')}><BookOpen size={17} />打开我的库</button>
        </div>
      </PageHero>

      <StatStrip items={[
        { label: '总收藏', value: summary.total_works || works.length || 0, hint: '本地 CBZ', icon: <BookOpen size={21} /> },
        { label: '待治理', value: summary.unconfirmed_tags || 0, hint: '未确认标签', icon: <Tags size={21} />, tone: (summary.unconfirmed_tags || 0) ? 'amber' : 'green' },
        { label: '导出作品', value: summary.exported_works || 0, hint: 'CBZ 产物', icon: <Download size={21} /> },
        { label: '运行任务', value: activeTasks.length, hint: failed ? `${failed} 个失败` : '队列健康', icon: <ListTodo size={21} />, tone: failed ? 'red' : 'blue' },
        { label: '数据源', value: status?.api.key_configured ? '已配置' : '待配置', hint: `${status?.cdn.servers?.length || 0} 个 CDN`, icon: <ShieldCheck size={21} />, tone: status?.api.key_configured ? 'green' : 'amber' }
      ]} />

      <div className="dashboard-grid">
        <section className="paper-panel span-2">
          <header className="panel-head">
            <div><h2>最近入库</h2><p>馆藏墙会优先展示最近更新的作品。</p></div>
            <button type="button" className="ghost-button" onClick={() => navigate('library')}>全部作品</button>
          </header>
          <div className="cover-row">
            {works.slice(0, 8).map((work) => (
              <button className="mini-work" type="button" key={work.id} onClick={() => openWork(work)}>
                <Cover src={work.cover_url} title={work.display_title} token={localStorage.getItem('token')} />
                <strong>{work.display_title}</strong>
                <span>{work.page_count || '?'}P · {work.unconfirmed_tag_count || 0} 待确认</span>
              </button>
            ))}
            {!works.length ? <EmptyPanel title="还没有馆藏" text="从发现页搜索远端作品，或上传本地 CBZ。" /> : null}
          </div>
        </section>

        <section className="paper-panel">
          <header className="panel-head"><div><h2>任务流</h2><p>下载、扫描、解析和导出。</p></div></header>
          <div className="timeline-list">
            {tasks.slice(0, 7).map((task) => (
              <button type="button" className="timeline-row" key={task.id} onClick={() => navigate('tasks')}>
                <i />
                <span><strong>{task.title || task.message || `任务 #${task.id}`}</strong><small>{statusText(task.status)} · {progress(task)}%</small></span>
              </button>
            ))}
            {!tasks.length ? <EmptyPanel title="暂无任务" text="导入或导出后会出现处理记录。" /> : null}
          </div>
        </section>

        <section className="paper-panel">
          <header className="panel-head"><div><h2>系统健康</h2><p>隐私优先，本地沉淀。</p></div></header>
          <div className="health-stack">
            <Health label="资料库" value={status?.storage.library_dir || '未加载'} ok={Boolean(status?.storage.library_dir)} />
            <Health label="翻译" value={status?.translation.provider || 'none'} ok={status?.translation.provider !== 'none'} />
            <Health label="词典" value={`${summary.dictionary_entries || 0} 条`} ok={(summary.dictionary_entries || 0) > 0} />
            <Health label="存储" value={formatBytes(status?.storage.free_bytes || 0)} ok />
          </div>
        </section>
      </div>
    </section>
  );
}

function Health({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return <div className="health-row"><Database size={17} /><span>{label}</span><strong className={ok ? 'ok' : 'warn'}>{value}</strong></div>;
}

function EmptyPanel({ title, text }: { title: string; text: string }) {
  return <div className="empty-panel"><strong>{title}</strong><span>{text}</span></div>;
}

function formatBytes(value: number) {
  if (!value) return 'n/a';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unit = 0;
  while (size > 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }
  return `${size.toFixed(size > 10 ? 0 : 1)} ${units[unit]} 可用`;
}
