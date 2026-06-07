import { Download, Pause, RefreshCcw, Trash2, X } from 'lucide-react';
import type { ApiClient, Task } from '../lib/api';

export function TaskQueueDrawer({
  api,
  open,
  tasks,
  onClose,
  onRefresh
}: {
  api: ApiClient;
  open: boolean;
  tasks: Task[];
  onClose: () => void;
  onRefresh: () => Promise<void>;
}) {
  if (!open) return null;

  async function retry(task: Task) {
    await api.retryTask(task.id);
    await onRefresh();
  }

  async function remove(task: Task) {
    if (!window.confirm('删除任务和已生成文件？')) return;
    await api.deleteTask(task.id);
    await onRefresh();
  }

  const recent = tasks.slice(0, 8);

  return (
    <aside className="queue-drawer" aria-label="任务队列">
      <header>
        <div>
          <h2>任务队列</h2>
          <p>仅显示最近任务，可在队列页查看全部。</p>
        </div>
        <div className="drawer-actions">
          <button type="button" className="ghost-button" onClick={onRefresh}><RefreshCcw size={16} />刷新</button>
          <button type="button" className="icon-button" onClick={onClose} title="关闭"><X size={18} /></button>
        </div>
      </header>
      <div className="queue-table">
        <div className="queue-head">
          <span>#</span><span>画廊 ID / 标题</span><span>状态</span><span>进度</span><span>操作</span>
        </div>
        {recent.map((task, index) => (
          <div className="queue-row" key={task.id}>
            <span>{index + 1}</span>
            <div>
              <strong>{task.title || task.message || `任务 #${task.id}`}</strong>
              <span>{taskTypeName(task.type)}{task.gallery_id ? ` · #${task.gallery_id}` : ''}</span>
              {task.error ? <p className="error-text">{task.error}</p> : null}
            </div>
            <span className={`status-chip ${task.status}`}>{statusText(task.status)}</span>
            <div className="progress-cell">
              <div className="progress-bar"><span style={{ width: `${progress(task)}%` }} /></div>
              <small>{task.progress_current}/{task.progress_total || '?'}</small>
            </div>
            <div className="row-actions">
              {task.status === 'failed' ? <button type="button" className="icon-button" onClick={() => retry(task)} title="重试"><RefreshCcw size={16} /></button> : null}
              {['completed', 'success'].includes(task.status) ? <button type="button" className="icon-button" onClick={() => api.download(`/api/tasks/${task.id}/download`, `${task.title || task.gallery_id || task.id}.cbz`)} title="下载"><Download size={16} /></button> : null}
              {['downloading', 'running'].includes(task.status) ? <button type="button" className="icon-button subtle" title="运行中"><Pause size={16} /></button> : null}
              <button type="button" className="icon-button danger" onClick={() => remove(task)} title="删除"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
        {!recent.length ? <p className="empty">暂无任务</p> : null}
      </div>
    </aside>
  );
}

function taskTypeName(value: string) {
  const map: Record<string, string> = { import: '远程导入', local_upload: '本地上传', scan: '目录扫描', export: '导出' };
  return map[value] || value || '任务';
}

export function statusText(status: string) {
  const map: Record<string, string> = {
    queued: '排队中',
    running: '运行中',
    downloading: '下载中',
    completed: '已完成',
    success: '已完成',
    canceled: '已取消',
    failed: '失败'
  };
  return map[status] || status;
}

export function progress(task: Task) {
  if (task.progress) return Math.min(100, task.progress);
  if (!task.progress_total) return ['completed', 'success'].includes(task.status) ? 100 : 0;
  return Math.min(100, Math.round((task.progress_current / task.progress_total) * 100));
}
