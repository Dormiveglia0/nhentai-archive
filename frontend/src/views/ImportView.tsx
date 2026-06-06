import { DownloadCloud, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import type { ApiClient } from '../lib/api';

type Props = {
  api: ApiClient;
  onImported: () => void;
};

export function ImportView({ api, onImported }: Props) {
  const [ids, setIds] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [ack, setAck] = useState(false);
  const [message, setMessage] = useState('');

  function parseIds(value: string): number[] {
    return value
      .split(/[\s,;]+/)
      .map((part) => Number(part.trim()))
      .filter((value) => Number.isInteger(value) && value > 0);
  }

  async function importIds(values: number[]) {
    setMessage('');
    try {
      await api.request('/api/tasks/import', {
        method: 'POST',
        body: JSON.stringify({ ids: values, authorized_use_ack: ack })
      });
      setMessage(`已导入 ${values.length} 个任务`);
      onImported();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '导入失败');
    }
  }

  async function search() {
    setMessage('');
    try {
      const response = await api.request<{ result: any[] }>(`/api/search?q=${encodeURIComponent(query)}`);
      setResults(response.result || []);
      setSelected(new Set());
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '搜索失败');
    }
  }

  function titleOf(item: any): string {
    return item?.title?.display || item?.title?.english || item?.title?.japanese || `#${item?.id}`;
  }

  return (
    <section className="view">
      <header className="view-header">
        <h1>导入作品</h1>
      </header>
      <div className="import-grid">
        <div className="panel">
          <h2>作品 ID</h2>
          <textarea value={ids} onChange={(event) => setIds(event.target.value)} placeholder="例如：123456 234567" />
          <label className="checkbox-line">
            <input type="checkbox" checked={ack} onChange={(event) => setAck(event.target.checked)} />
            <span>确认这些作品用于授权的个人归档</span>
          </label>
          <button className="primary-button" onClick={() => importIds(parseIds(ids))}>
            <Plus size={18} />
            <span>导入 ID</span>
          </button>
        </div>
        <div className="panel">
          <h2>模糊搜索</h2>
          <div className="inline-form">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="作品名、作者名、社团名" />
            <button className="icon-button" onClick={search} title="搜索">
              <Search size={18} />
            </button>
          </div>
          <div className="result-list">
            {results.map((item) => (
              <label className="result-row" key={item.id}>
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  onChange={(event) => {
                    const next = new Set(selected);
                    event.target.checked ? next.add(item.id) : next.delete(item.id);
                    setSelected(next);
                  }}
                />
                <span>#{item.id}</span>
                <strong>{titleOf(item)}</strong>
              </label>
            ))}
          </div>
          <button className="primary-button" onClick={() => importIds([...selected])}>
            <DownloadCloud size={18} />
            <span>导入选中</span>
          </button>
        </div>
      </div>
      {message ? <p className="status-message">{message}</p> : null}
    </section>
  );
}
