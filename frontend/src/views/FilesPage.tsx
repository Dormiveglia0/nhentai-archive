import { Database, FileArchive, FolderOpen, RefreshCcw, Search, ShieldAlert, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Cover } from '../components/Cover';
import { PageHero, StatStrip } from '../components/Shell';
import type { ApiClient, AppStatus, Work } from '../lib/api';

export function FilesPage({ api, works, status, refreshWorks, openWork }: { api: ApiClient; works: Work[]; status: AppStatus | null; refreshWorks: () => Promise<void>; openWork: (work: Work) => void }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Work | null>(null);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return works;
    return works.filter((work) => `${work.display_title} ${work.local_cbz_path} ${work.source_id}`.toLowerCase().includes(q));
  }, [works, query]);
  const missingCovers = works.filter((work) => !work.cover_path).length;
  const missingFiles = works.filter((work) => !work.local_cbz_path).length;

  return (
    <section className="page files-page">
      <PageHero title="文件管理" seal="采检" subtitle="管理 Archive 系统文件，检查数据完整性，清理冗余文件并维护存储健康。" />
      <StatStrip items={[
        { label: '原始 CBZ', value: works.length, hint: '库内记录', icon: <FileArchive size={21} /> },
        { label: '封面缺失', value: missingCovers, hint: '需要修复', icon: <ShieldAlert size={21} />, tone: missingCovers ? 'amber' : 'green' },
        { label: '路径缺失', value: missingFiles, hint: '孤儿记录', icon: <FolderOpen size={21} />, tone: missingFiles ? 'red' : 'green' },
        { label: '可用空间', value: formatBytes(status?.storage.free_bytes || 0), hint: status?.storage.library_dir || 'library', icon: <Database size={21} /> }
      ]} />

      <div className="files-layout">
        <main className="paper-panel">
          <header className="panel-head">
            <label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索文件名 / 路径 / 画廊 ID" /></label>
            <button type="button" className="ghost-button" onClick={refreshWorks}><RefreshCcw size={16} />重新扫描记录</button>
          </header>
          <div className="archive-table">
            <div className="table-head"><span>文件名</span><span>路径</span><span>大小</span><span>来源</span><span>状态</span></div>
            {filtered.map((work) => (
              <button type="button" className={`table-row ${selected?.id === work.id ? 'active' : ''}`} key={work.id} onClick={() => setSelected(work)} onDoubleClick={() => openWork(work)}>
                <strong>{work.display_title}<small>{work.source_id || work.file_hash.slice(0, 10)}</small></strong>
                <span>{work.local_cbz_path || '缺失'}</span>
                <span>{work.page_count || '?'}P</span>
                <span>{work.source_type}</span>
                <span>{work.cover_path ? '正常' : '缺少封面'}</span>
              </button>
            ))}
          </div>
        </main>

        <aside className="paper-panel inspector-panel sticky">
          <h2>文件详情</h2>
          {selected ? (
            <>
              <Cover src={selected.cover_url} title={selected.display_title} token={api.token} />
              <h3>{selected.display_title}</h3>
              <dl className="meta-list">
                <div><dt>原始 CBZ</dt><dd>{selected.local_cbz_path || '缺失'}</dd></div>
                <div><dt>封面缓存</dt><dd>{selected.cover_path || '缺失'}</dd></div>
                <div><dt>Hash</dt><dd>{selected.file_hash || '-'}</dd></div>
              </dl>
              <button type="button" className="primary-button full" onClick={() => openWork(selected)}>进入治理</button>
            </>
          ) : <p className="empty-panel">选择文件查看完整路径与维护动作。</p>}
          <h2>清理工具</h2>
          <button type="button" className="ghost-button full"><Trash2 size={16} />清理失效封面</button>
          <button type="button" className="ghost-button full"><Trash2 size={16} />清理临时文件</button>
        </aside>
      </div>
    </section>
  );
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
  return `${size.toFixed(size > 10 ? 0 : 1)} ${units[unit]}`;
}
