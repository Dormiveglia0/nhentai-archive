import { Download, ExternalLink, FileOutput, RefreshCcw, RotateCcw, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Cover } from '../components/Cover';
import { PageHeader } from '../components/Shell';
import type { ApiClient, ExportRecord, Task, Work } from '../lib/api';
import { progress, statusText } from './TaskQueueDrawer';

type Detail = { kind: 'task'; task: Task } | { kind: 'export'; exportRecord: ExportRecord } | null;

export function TasksPage({ api, tasks, refreshTasks, openWork }: { api: ApiClient; tasks: Task[]; refreshTasks: () => Promise<void>; openWork: (work: Work | number) => void }) {
  const [exports, setExports] = useState<ExportRecord[]>([]);
  const [detail, setDetail] = useState<Detail>(null);
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const filteredTasks = useMemo(() => {
    if (filter === 'all') return tasks;
    if (filter === 'active') return tasks.filter((task) => ['queued', 'running', 'downloading'].includes(task.status));
    return tasks.filter((task) => task.status === filter);
  }, [tasks, filter]);

  async function loadExports() {
    const data = await api.exports();
    setExports(data.exports);
  }

  async function refreshAll() {
    await Promise.all([refreshTasks(), loadExports()]);
  }

  useEffect(() => {
    loadExports().catch((err) => setError(err instanceof Error ? err.message : '导出记录加载失败'));
  }, []);

  async function run(label: string, action: () => Promise<void>) {
    setBusy(label);
    setError('');
    setMessage('');
    try {
      await action();
      setMessage(label);
    } catch (err) {
      setError(err instanceof Error ? err.message : `${label}失败`);
    } finally {
      setBusy('');
    }
  }

  async function retry(task: Task) {
    await run('任务已重新排队', async () => {
      await api.retryTask(task.id);
      await refreshTasks();
    });
  }

  async function removeTask(task: Task) {
    if (!window.confirm('删除任务记录？已生成的库文件不会被删除。')) return;
    await run('任务记录已删除', async () => {
      await api.deleteTask(task.id);
      await refreshTasks();
      setDetail(null);
    });
  }

  async function rerunExport(record: ExportRecord) {
    await run('已重新生成导出', async () => {
      const result = await api.rerunExport(record.id);
      setExports(result.exports);
      setDetail({ kind: 'export', exportRecord: result.export });
      await refreshTasks();
    });
  }

  async function deleteExport(record: ExportRecord) {
    if (!window.confirm('仅删除导出记录？原始 CBZ 和库内作品不会被删除。')) return;
    await run('导出记录已删除', async () => {
      const result = await api.deleteExport(record.id, false);
      setExports(result.exports);
      setDetail(null);
    });
  }

  return (
    <section className="page tasks-workbench">
      <PageHeader
        title="队列任务"
        subtitle="集中管理导入、扫描、解析、导出任务，以及已生成的 CBZ 产物。"
        action={<div className="row-actions"><button className="ghost-button" type="button" onClick={refreshAll}><RefreshCcw size={16} />刷新</button><button className="ghost-button" type="button" onClick={() => run('失败任务已重试', async () => { await api.retryFailed(); await refreshTasks(); })}>重试失败</button><button className="ghost-button" type="button" onClick={() => run('已清空成功任务记录', async () => { await api.clearCompleted(); await refreshTasks(); })}>清空成功记录</button></div>}
      />
      {message ? <p className="notice success">{message}</p> : null}
      {error ? <p className="notice error">{error}</p> : null}

      <div className="task-summary-strip">
        <SummaryItem label="等待/运行" value={tasks.filter((task) => ['queued', 'running', 'downloading'].includes(task.status)).length} />
        <SummaryItem label="失败任务" value={tasks.filter((task) => task.status === 'failed').length} tone="danger" />
        <SummaryItem label="成功记录" value={tasks.filter((task) => ['success', 'completed'].includes(task.status)).length} />
        <SummaryItem label="导出产物" value={exports.length} />
      </div>

      <div className="tasks-layout">
        <main className="tasks-main">
          <section className="task-section">
            <header className="section-toolbar">
              <h2>任务流</h2>
              <div className="segmented compact">
                {[
                  ['all', '全部'],
                  ['active', '进行中'],
                  ['failed', '失败'],
                  ['success', '成功']
                ].map(([value, label]) => <button key={value} type="button" className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>)}
              </div>
            </header>
            <div className="data-table task-table dense">
              <div className="task-table-head"><span>任务</span><span>状态</span><span>步骤</span><span>进度</span><span>更新时间</span><span>操作</span></div>
              {filteredTasks.map((task) => (
                <div className="task-table-row clickable" key={task.id} onClick={() => setDetail({ kind: 'task', task })}>
                  <div>
                    <strong>{task.title || task.message || `任务 #${task.id}`}</strong>
                    {task.error ? <p className="error-text">{task.error}</p> : <span>{taskTypeName(task.type)}{task.gallery_id ? ` · 画廊 #${task.gallery_id}` : ''}</span>}
                  </div>
                  <span className={`status-chip ${task.status}`}>{statusText(task.status)}</span>
                  <span>{task.current_step || task.message || '-'}</span>
                  <div className="progress-cell"><div className="progress-bar"><span style={{ width: `${progress(task)}%` }} /></div><small>{progress(task)}%</small></div>
                  <span>{formatDate(task.updated_at)}</span>
                  <div className="row-actions" onClick={(event) => event.stopPropagation()}>
                    {task.work_id ? <button className="icon-button" type="button" onClick={() => openWork(task.work_id || 0)} title="打开作品"><ExternalLink size={16} /></button> : null}
                    {task.status === 'failed' ? <button className="icon-button" type="button" onClick={() => retry(task)} title="重试"><RefreshCcw size={16} /></button> : null}
                    {['completed', 'success'].includes(task.status) && task.cbz_path ? <button className="icon-button" type="button" onClick={() => api.download(`/api/tasks/${task.id}/download`, `${task.title || task.gallery_id || task.id}.cbz`)} title="下载"><Download size={16} /></button> : null}
                    <button className="icon-button danger" type="button" onClick={() => removeTask(task)} title="删除"><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
              {!filteredTasks.length ? <p className="empty">当前筛选下暂无任务</p> : null}
            </div>
          </section>

          <section className="task-section">
            <header className="section-toolbar">
              <h2>导出产物</h2>
              <span>{exports.length} 个生成记录</span>
            </header>
            <div className="exports-grid">
              {exports.map((record) => (
                <button className="export-card" key={record.id} type="button" onClick={() => setDetail({ kind: 'export', exportRecord: record })}>
                  {record.work ? <Cover src={record.work.cover_url} title={record.work.display_title} token={localStorage.getItem('token')} /> : <div className="export-file-icon"><FileOutput size={28} /></div>}
                  <span>
                    <strong>{record.work_title || record.filename}</strong>
                    <small>{record.filename}</small>
                    <em>{formatBytes(record.size_bytes || 0)} · {formatDate(record.created_at)}</em>
                  </span>
                  <StateDot ok={Boolean(record.exists)} />
                </button>
              ))}
              {!exports.length ? <p className="empty">暂无导出产物。作品详情或我的库批量操作里导出后会显示在这里。</p> : null}
            </div>
          </section>
        </main>
        <TaskDetailDrawer detail={detail} busy={busy} api={api} openWork={openWork} onClose={() => setDetail(null)} onRetry={retry} onDeleteTask={removeTask} onRerun={rerunExport} onDeleteExport={deleteExport} />
      </div>
    </section>
  );
}

function TaskDetailDrawer({ detail, busy, api, openWork, onClose, onRetry, onDeleteTask, onRerun, onDeleteExport }: {
  detail: Detail;
  busy: string;
  api: ApiClient;
  openWork: (work: Work | number) => void;
  onClose: () => void;
  onRetry: (task: Task) => Promise<void>;
  onDeleteTask: (task: Task) => Promise<void>;
  onRerun: (record: ExportRecord) => Promise<void>;
  onDeleteExport: (record: ExportRecord) => Promise<void>;
}) {
  if (!detail) {
    return <aside className="task-detail"><p className="empty">选择任务或导出记录查看步骤、错误和操作。</p></aside>;
  }
  if (detail.kind === 'task') {
    const task = detail.task;
    return (
      <aside className="task-detail">
        <header><div><span>{taskTypeName(task.type)}</span><h2>{task.title || `任务 #${task.id}`}</h2></div><button className="icon-button" type="button" onClick={onClose}><X size={18} /></button></header>
        <dl className="detail-list">
          <div><dt>状态</dt><dd><span className={`status-chip ${task.status}`}>{statusText(task.status)}</span></dd></div>
          <div><dt>当前步骤</dt><dd>{task.current_step || task.message || '-'}</dd></div>
          <div><dt>进度</dt><dd>{progress(task)}%</dd></div>
          <div><dt>画廊 ID</dt><dd>{task.gallery_id || '-'}</dd></div>
          <div><dt>错误</dt><dd>{task.error || '无'}</dd></div>
          <div><dt>创建时间</dt><dd>{formatDate(task.created_at)}</dd></div>
          <div><dt>更新时间</dt><dd>{formatDate(task.updated_at)}</dd></div>
        </dl>
        <div className="split-actions vertical">
          {task.work_id ? <button className="primary-button" type="button" onClick={() => openWork(task.work_id || 0)}><ExternalLink size={16} />打开作品</button> : null}
          {task.status === 'failed' ? <button className="ghost-button" type="button" disabled={Boolean(busy)} onClick={() => onRetry(task)}><RefreshCcw size={16} />重试任务</button> : null}
          {task.cbz_path ? <button className="ghost-button" type="button" onClick={() => api.download(`/api/tasks/${task.id}/download`, `${task.title || task.id}.cbz`)}><Download size={16} />下载文件</button> : null}
          <button className="ghost-button danger" type="button" disabled={Boolean(busy)} onClick={() => onDeleteTask(task)}><Trash2 size={16} />删除记录</button>
        </div>
      </aside>
    );
  }
  const record = detail.exportRecord;
  return (
    <aside className="task-detail">
      <header><div><span>导出产物</span><h2>{record.work_title || record.filename}</h2></div><button className="icon-button" type="button" onClick={onClose}><X size={18} /></button></header>
      <dl className="detail-list">
        <div><dt>文件名</dt><dd>{record.filename}</dd></div>
        <div><dt>状态</dt><dd>{record.exists ? '文件存在' : '文件缺失'}</dd></div>
        <div><dt>大小</dt><dd>{formatBytes(record.size_bytes || 0)}</dd></div>
        <div><dt>生成时间</dt><dd>{formatDate(record.created_at)}</dd></div>
        <div><dt>路径</dt><dd>{record.path}</dd></div>
      </dl>
      <div className="split-actions vertical">
        {record.work_id ? <button className="primary-button" type="button" onClick={() => openWork(record.work_id)}><ExternalLink size={16} />打开作品</button> : null}
        <button className="ghost-button" type="button" onClick={() => api.download(record.download_url, record.filename)}><Download size={16} />下载导出文件</button>
        <button className="ghost-button" type="button" disabled={Boolean(busy)} onClick={() => onRerun(record)}><RotateCcw size={16} />重新导出</button>
        <button className="ghost-button danger" type="button" disabled={Boolean(busy)} onClick={() => onDeleteExport(record)}><Trash2 size={16} />删除记录</button>
      </div>
    </aside>
  );
}

function SummaryItem({ label, value, tone }: { label: string; value: number; tone?: 'danger' }) {
  return <div className={`summary-item ${tone || ''}`}><span>{label}</span><strong>{value}</strong></div>;
}

function StateDot({ ok }: { ok: boolean }) {
  return <i className={`state-dot ${ok ? 'ok' : 'bad'}`} />;
}

function formatDate(value: string) {
  return value ? new Date(value).toLocaleString() : '无';
}

function formatBytes(bytes: number) {
  if (!bytes) return '未知大小';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let index = 0;
  while (size > 1024 && index < units.length - 1) {
    size /= 1024;
    index++;
  }
  return `${size.toFixed(index ? 1 : 0)} ${units[index]}`;
}

function taskTypeName(value: string) {
  const map: Record<string, string> = { import: '远程导入', local_upload: '本地上传', scan: '目录扫描', export: '导出' };
  return map[value] || value || '任务';
}
