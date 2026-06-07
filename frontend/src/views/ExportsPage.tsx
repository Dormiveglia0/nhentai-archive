import { AlertTriangle, Download, FileOutput, RefreshCcw, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Cover } from '../components/Cover';
import { PageHero, StatStrip } from '../components/Shell';
import type { ApiClient, ExportRecord, Work } from '../lib/api';

export function ExportsPage({ api, openWork }: { api: ApiClient; openWork: (work: Work | number) => void }) {
  const [exports, setExports] = useState<ExportRecord[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [error, setError] = useState('');
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const selectedExports = exports.filter((item) => selectedSet.has(item.id));

  async function load() {
    const data = await api.exports();
    setExports(data.exports || []);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : '导出记录加载失败'));
  }, []);

  async function rerun(record: ExportRecord) {
    const result = await api.rerunExport(record.id);
    setExports(result.exports || []);
  }

  return (
    <section className="page exports-page">
      <PageHero title="导出中心" seal="采集" subtitle="批量导出你的作品为 CBZ 格式，或按预设规则重新打包与整理。" />
      <StatStrip items={[
        { label: '导出记录', value: exports.length, hint: '历史产物', icon: <FileOutput size={21} /> },
        { label: '已选择', value: selected.length, hint: '批量操作', icon: <Download size={21} />, tone: selected.length ? 'red' : undefined },
        { label: '文件缺失', value: exports.filter((item) => item.exists === false).length, hint: '需要重导', icon: <AlertTriangle size={21} />, tone: exports.some((item) => item.exists === false) ? 'amber' : 'green' },
        { label: '总大小', value: formatBytes(exports.reduce((sum, item) => sum + (item.size_bytes || 0), 0)), hint: '导出目录', icon: <Download size={21} /> }
      ]} />
      {error ? <p className="notice error">{error}</p> : null}

      <div className="exports-layout">
        <main className="paper-panel">
          <header className="panel-head">
            <div><h2>待导出与历史记录</h2><p>导出永远生成新 CBZ，不覆盖原始文件。</p></div>
            <div className="row-actions">
              <button className="ghost-button" type="button" onClick={load}><RefreshCcw size={16} />刷新</button>
              <button className="ghost-button" type="button" onClick={() => setSelected(exports.map((item) => item.id))}>全选</button>
            </div>
          </header>
          <div className="export-grid">
            {exports.map((record) => (
              <article className={`export-card-new ${selectedSet.has(record.id) ? 'selected' : ''}`} key={record.id}>
                <label className="floating-check"><input type="checkbox" checked={selectedSet.has(record.id)} onChange={() => setSelected((previous) => previous.includes(record.id) ? previous.filter((id) => id !== record.id) : [...previous, record.id])} /><span /></label>
                {record.work ? <Cover src={record.work.cover_url} title={record.work.display_title} token={api.token} /> : <div className="file-glyph"><FileOutput size={32} /></div>}
                <strong>{record.work_title || record.filename}</strong>
                <span>{record.filename}</span>
                <small>{formatBytes(record.size_bytes || 0)} · {formatDate(record.created_at)}</small>
                <footer>
                  <button type="button" onClick={() => api.download(record.download_url, record.filename)}><Download size={15} />下载</button>
                  <button type="button" onClick={() => rerun(record)}><RefreshCcw size={15} />重导</button>
                  {record.work_id ? <button type="button" onClick={() => openWork(record.work_id)}>治理</button> : null}
                </footer>
              </article>
            ))}
          </div>
        </main>

        <aside className="paper-panel inspector-panel sticky">
          <h2>导出预览</h2>
          <p>已选择 {selectedExports.length} 项，预计大小 {formatBytes(selectedExports.reduce((sum, item) => sum + (item.size_bytes || 0), 0))}。</p>
          <button className="primary-button full" type="button" disabled={!selectedExports.length}>批量重新导出</button>
          <button className="ghost-button full danger" type="button" disabled={!selectedExports.length}><Trash2 size={16} />删除导出记录</button>
        </aside>
      </div>
    </section>
  );
}

function formatBytes(value: number) {
  if (!value) return '未知大小';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unit = 0;
  while (size > 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }
  return `${size.toFixed(size > 10 ? 0 : 1)} ${units[unit]}`;
}

function formatDate(value: string) {
  return value ? new Date(value).toLocaleString() : '-';
}
