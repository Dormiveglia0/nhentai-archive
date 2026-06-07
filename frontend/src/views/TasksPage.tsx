import { Download, ExternalLink, RefreshCcw, RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Cover } from '../components/Cover';
import { PageHero, StatStrip } from '../components/Shell';
import type { ApiClient, ExportRecord, Task, Work } from '../lib/api';
import { progress, statusText, taskTypeName } from './TaskQueueDrawer';

export function TasksPage({ api, tasks, refreshTasks, openWork }: { api: ApiClient; tasks: Task[]; refreshTasks: () => Promise<void>; openWork: (work: Work | number) => void }) {
  const [exports, setExports] = useState<ExportRecord[]>([]);
  const [filter, setFilter] = useState('active');
  const [active, setActive] = useState<Task | null>(null);
  const [error, setError] = useState('');
  const filtered = useMemo(() => {
    if (filter === 'all') return tasks;
    if (filter === 'active') return tasks.filter((task) => ['queued', 'running', 'downloading'].includes(task.status));
    return tasks.filter((task) => task.status === filter);
  }, [tasks, filter]);

  async function loadExports() {
    const data = await api.exports();
    setExports(data.exports || []);
  }

  useEffect(() => {
    loadExports().catch((err) => setError(err instanceof Error ? err.message : '导出记录加载失败'));
  }, []);

  return (
    <section className="page tasks-page">
      <PageHero title="任务中心" seal="采集" subtitle="追踪所有下载、扫描、解析、词典应用与导出任务。" />
      <StatStrip items={[
        { label: '正在运行', value: tasks.filter((task) => ['queued', 'running', 'downloading'].includes(task.status)).length, hint: '队列中', icon: <RefreshCcw size={21} />, tone: 'blue' },
        { label: '失败', value: tasks.filter((task) => task.status === 'failed').length, hint: '可重试', icon: <RotateCcw size={21} />, tone: tasks.some((task) => task.status === 'failed') ? 'red' : 'green' },
        { label: '已完成', value: tasks.filter((task) => ['success', 'completed'].includes(task.status)).length, hint: '历史记录', icon: <Download size={21} /> },
        { label: '导出产物', value: exports.length, hint: 'CBZ 文件', icon: <ExternalLink size={21} /> }
      ]} />
      {error ? <p className="notice error">{error}</p> : null}

      <div className="tasks-layout">
        <main className="paper-panel">
          <header className="panel-head">
            <div className="tabs">
              {['active', 'queued', 'running', 'failed', 'success', 'all'].map((item) => <button key={item} className={filter === item ? 'active' : ''} type="button" onClick={() => setFilter(item)}>{filterName(item)}</button>)}
            </div>
            <div className="row-actions">
              <button className="ghost-button" type="button" onClick={refreshTasks}>刷新</button>
              <button className="ghost-button" type="button" onClick={() => api.retryFailed().then(refreshTasks)}>重试失败</button>
              <button className="ghost-button" type="button" onClick={() => api.clearCompleted().then(refreshTasks)}>清空完成</button>
            </div>
          </header>
          <div className="archive-table">
            <div className="table-head"><span>任务</span><span>目标</span><span>阶段</span><span>进度</span><span>时间</span><span>操作</span></div>
            {filtered.map((task) => (
              <button key={task.id} type="button" className={`table-row task ${active?.id === task.id ? 'active' : ''}`} onClick={() => setActive(task)}>
                <strong>{taskTypeName(task.type)}<small>{statusText(task.status)}</small></strong>
                <span>{task.title || task.message || task.gallery_id || '-'}</span>
                <span>{task.current_step || task.message || '-'}</span>
                <span className="progress-inline"><i><em style={{ width: `${progress(task)}%` }} /></i>{progress(task)}%</span>
                <span>{formatDate(task.updated_at)}</span>
                <span className="row-actions">
                  {task.work_id ? <ExternalLink size={16} onClick={(event) => { event.stopPropagation(); openWork(task.work_id || 0); }} /> : null}
                  {task.status === 'failed' ? <RefreshCcw size={16} onClick={(event) => { event.stopPropagation(); api.retryTask(task.id).then(refreshTasks); }} /> : null}
                  <Trash2 size={16} onClick={(event) => { event.stopPropagation(); api.deleteTask(task.id).then(refreshTasks); }} />
                </span>
              </button>
            ))}
          </div>
        </main>

        <aside className="paper-panel inspector-panel sticky">
          <h2>任务详情</h2>
          {active ? (
            <>
              <dl className="meta-list">
                <div><dt>任务 ID</dt><dd>{active.id}</dd></div>
                <div><dt>状态</dt><dd>{statusText(active.status)}</dd></div>
                <div><dt>错误</dt><dd>{active.error || '无'}</dd></div>
                <div><dt>进度</dt><dd>{progress(active)}%</dd></div>
              </dl>
              {active.work_id ? <button type="button" className="primary-button full" onClick={() => openWork(active.work_id || 0)}>打开作品</button> : null}
            </>
          ) : <p className="empty-panel">选择任务查看详情。</p>}
          <h2>最近导出</h2>
          <div className="export-mini-list">
            {exports.slice(0, 5).map((record) => (
              <button key={record.id} type="button" onClick={() => record.work_id ? openWork(record.work_id) : undefined}>
                {record.work ? <Cover src={record.work.cover_url} title={record.work.display_title} token={api.token} /> : null}
                <span>{record.filename}</span>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}

function filterName(value: string) {
  const map: Record<string, string> = { active: '正在运行', queued: '等待中', running: '运行中', failed: '失败', success: '完成', all: '全部' };
  return map[value] || value;
}

function formatDate(value: string) {
  return value ? new Date(value).toLocaleString() : '-';
}
