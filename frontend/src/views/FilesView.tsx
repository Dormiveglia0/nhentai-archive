import { Download, FileJson, RefreshCcw } from 'lucide-react';
import type { ApiClient, Task } from '../lib/api';

type Props = {
  api: ApiClient;
  tasks: Task[];
  refresh: () => void;
};

export function FilesView({ api, tasks, refresh }: Props) {
  const completed = tasks.filter((task) => task.status === 'completed');

  async function showMetadata(id: number) {
    const metadata = await api.request(`/api/tasks/${id}/metadata`);
    const blob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' });
    window.open(URL.createObjectURL(blob), '_blank');
  }

  return (
    <section className="view">
      <header className="view-header">
        <h1>文件库</h1>
        <button className="ghost-button" onClick={refresh}>
          <RefreshCcw size={18} />
          <span>刷新</span>
        </button>
      </header>
      <div className="file-grid">
        {completed.map((task) => (
          <article className="file-card" key={task.id}>
            <span className="badge completed">CBZ</span>
            <h2>#{task.gallery_id}</h2>
            <p>{task.title}</p>
            <div className="actions">
              <a className="primary-link" href={api.downloadUrl(task.id)} target="_blank" rel="noreferrer">
                <Download size={16} />
                <span>下载</span>
              </a>
              <button className="ghost-button" onClick={() => showMetadata(task.id)}>
                <FileJson size={16} />
                <span>元数据</span>
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
