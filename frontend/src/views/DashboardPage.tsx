import { BookOpen, Import, ListTodo, Settings } from 'lucide-react';
import { PageHeader, type ViewId } from '../components/Shell';
import { Cover } from '../components/Cover';
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
  const running = tasks.filter((task) => ['queued', 'running', 'downloading'].includes(task.status)).length;
  const failed = tasks.filter((task) => task.status === 'failed').length;

  return (
    <section className="page">
      <PageHeader
        title="总览"
        subtitle="本地 CBZ 元数据工作台状态、最近导入和配置健康。"
        action={<button className="primary-button" type="button" onClick={() => navigate('import')}><Import size={17} />搜索与导入</button>}
      />
      <div className="metric-grid wide">
        <Metric label="全部作品" value={summary.total_works || 0} />
        <Metric label="待整理标签" value={summary.unconfirmed_tags || 0} tone={(summary.unconfirmed_tags || 0) > 0 ? 'warn' : undefined} />
        <Metric label="词典条目" value={summary.dictionary_entries || 0} />
        <Metric label="运行中任务" value={running} />
        <Metric label="失败任务" value={failed || summary.failed_tasks || 0} tone={failed ? 'danger' : undefined} />
      </div>

      {!summary.total_works ? (
        <section className="onboarding-strip">
          <button type="button" onClick={() => navigate('settings')}><Settings size={18} />配置数据源</button>
          <button type="button" onClick={() => navigate('import')}><Import size={18} />搜索或上传 CBZ</button>
          <button type="button" onClick={() => navigate('library')}><BookOpen size={18} />编辑元数据</button>
          <button type="button" onClick={() => navigate('dictionary')}>维护词典</button>
        </section>
      ) : null}

      <div className="dashboard-columns">
        <section className="dashboard-panel">
          <header>
            <h2>最近作品</h2>
            <button className="ghost-button" type="button" onClick={() => navigate('library')}><BookOpen size={16} />打开我的库</button>
          </header>
          <div className="recent-work-list">
            {works.slice(0, 6).map((work) => (
              <button className="recent-work" key={work.id} type="button" onClick={() => openWork(work)}>
                <Cover src={work.cover_url} title={work.display_title} token={localStorage.getItem('token')} />
                <span>
                  <strong>{work.display_title}</strong>
                  <small>{sourceName(work.source_type)} · {work.page_count || '?'} 页 · {work.unconfirmed_tag_count} 个待确认</small>
                </span>
                <em className={`status-chip ${work.status}`}>{statusName(work.status)}</em>
              </button>
            ))}
            {!works.length ? <p className="empty">暂无作品。先配置源，然后搜索导入或上传本地 CBZ。</p> : null}
          </div>
        </section>

        <section className="dashboard-panel">
          <header>
            <h2>任务队列</h2>
            <button className="ghost-button" type="button" onClick={() => navigate('tasks')}><ListTodo size={16} />查看任务</button>
          </header>
          <div className="simple-list">
            {tasks.slice(0, 8).map((task) => (
              <div className="simple-row" key={task.id}>
                <div>
                  <strong>{task.title || task.message || `任务 #${task.id}`}</strong>
                  <span>{task.type} · {task.current_step || statusText(task.status)}</span>
                </div>
                <span className={`status-chip ${task.status}`}>{statusText(task.status)}</span>
                <div className="progress-bar"><span style={{ width: `${progress(task)}%` }} /></div>
              </div>
            ))}
            {!tasks.length ? <p className="empty">暂无任务</p> : null}
          </div>
        </section>
      </div>

      <section className="dashboard-panel health-grid">
        <Health label="数据源" value={status?.api.key_configured ? 'API key 已配置' : '缺少 API key'} good={Boolean(status?.api.key_configured)} />
        <Health label="CDN" value={`${status?.cdn.servers?.length || 0} 个图片节点`} good={(status?.cdn.servers?.length || 0) > 0} />
        <Health label="翻译" value={status?.translation.provider || '无'} good={status?.translation.provider !== 'none'} />
        <Health label="词典" value={`${summary.dictionary_entries || 0} 条`} good={(summary.dictionary_entries || 0) > 0} />
        <Health label="任务" value={`${running} 个运行中`} good={failed === 0} />
      </section>
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: 'warn' | 'danger' }) {
  return <div className={`metric ${tone || ''}`}><span>{label}</span><strong>{value}</strong></div>;
}

function Health({ label, value, good }: { label: string; value: string; good: boolean }) {
  return <div className="health-item"><span>{label}</span><strong className={good ? 'good' : 'warn'}>{value}</strong></div>;
}

function sourceName(value: string) {
  if (value === 'local') return '本地文件';
  return value || '未知来源';
}

function statusName(value: string) {
  const map: Record<string, string> = { ready: '可编辑', exported: '已导出', failed: '失败', success: '成功' };
  return map[value] || value || '未知';
}
