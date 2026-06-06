import { Download, RefreshCcw, RotateCw, Trash2 } from 'lucide-react';
import type { ApiClient, Task } from '../lib/api';

type Props = {
  api: ApiClient;
  tasks: Task[];
  refresh: () => void;
};

export function TasksView({ api, tasks, refresh }: Props) {
  async function retry(id: number) {
    await api.request(`/api/tasks/${id}/retry`, { method: 'POST' });
    refresh();
  }

  async function remove(id: number) {
    await api.request(`/api/tasks/${id}`, { method: 'DELETE' });
    refresh();
  }

  return (
    <section className="view">
      <header className="view-header">
        <h1>任务队列</h1>
        <button className="ghost-button" onClick={refresh}>
          <RefreshCcw size={18} />
          <span>刷新</span>
        </button>
      </header>
      <div className="table">
        <div className="table-head task-grid">
          <span>ID</span>
          <span>标题</span>
          <span>状态</span>
          <span>进度</span>
          <span>操作</span>
        </div>
        {tasks.map((task) => (
          <div className="table-row task-grid" key={task.id}>
            <span>#{task.gallery_id}</span>
            <strong>{task.title || '等待获取元数据'}</strong>
            <span className={`badge ${task.status}`}>{task.status}</span>
            <span>
              {task.progress_current}/{task.progress_total}
              {task.error ? <small className="error-text">{task.error}</small> : null}
            </span>
            <span className="actions">
              <button className="icon-button" onClick={() => retry(task.id)} title="重试">
                <RotateCw size={16} />
              </button>
              {task.status === 'completed' ? (
                <a className="icon-link" href={api.downloadUrl(task.id)} target="_blank" rel="noreferrer" title="下载">
                  <Download size={16} />
                </a>
              ) : null}
              <button className="icon-button danger" onClick={() => remove(task.id)} title="删除">
                <Trash2 size={16} />
              </button>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
