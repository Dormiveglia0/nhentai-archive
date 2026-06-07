import { Check, FileArchive, Import, ListPlus, Search, Upload } from 'lucide-react';
import { type FormEvent, useMemo, useState } from 'react';
import { Cover } from '../components/Cover';
import { PageHero, StatStrip } from '../components/Shell';
import { galleryCoverSrc, parseGalleryIds, type ApiClient, type Gallery, type Task, type Work } from '../lib/api';

export function ImportPage({
  api,
  tasks,
  setTasks,
  refreshTasks,
  refreshWorks,
  openWork
}: {
  api: ApiClient;
  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
  refreshTasks: () => Promise<void>;
  refreshWorks: () => Promise<void>;
  openWork: (work: Work | number) => void;
}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('date');
  const [page, setPage] = useState(1);
  const [ids, setIds] = useState('');
  const [scanDir, setScanDir] = useState('');
  const [results, setResults] = useState<Gallery[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [focused, setFocused] = useState<Gallery | null>(null);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const parsedIds = useMemo(() => parseGalleryIds(ids), [ids]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const preview = focused || results[0] || null;
  const running = tasks.filter((task) => ['queued', 'running', 'downloading'].includes(task.status)).length;

  async function search(event?: FormEvent) {
    event?.preventDefault();
    if (query.trim().length < 2) {
      setError('至少输入 2 个字符；短关键词请用画廊 ID 或标签候选。');
      return;
    }
    setBusy('search');
    setError('');
    setNotice('');
    try {
      const data = await api.searchGalleries(query.trim(), page, sort);
      const next = data.result || [];
      setResults(next);
      setFocused(next[0] || null);
      setNotice(`找到 ${data.total ?? data.count ?? next.length} 个远端结果`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '搜索失败');
    } finally {
      setBusy('');
    }
  }

  async function importIds(nextIds: number[]) {
    const clean = [...new Set(nextIds)].filter((id) => Number.isFinite(id) && id > 0);
    if (!clean.length) {
      setError('没有可导入的画廊 ID');
      return;
    }
    setBusy('import');
    setError('');
    setNotice('');
    try {
      const response = await api.import(clean);
      setTasks(response.tasks || []);
      setSelected([]);
      await Promise.allSettled([refreshTasks(), refreshWorks()]);
      setNotice(`已加入队列：新增 ${response.added}，已存在 ${response.existing}，重试 ${response.retried}，忽略 ${response.ignored}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加入队列失败');
    } finally {
      setBusy('');
    }
  }

  async function upload(file?: File) {
    if (!file) return;
    setBusy('upload');
    setError('');
    try {
      const data = await api.upload(file);
      await refreshWorks();
      openWork(data.work);
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败');
    } finally {
      setBusy('');
    }
  }

  async function scan(event: FormEvent) {
    event.preventDefault();
    setBusy('scan');
    setError('');
    try {
      const data = await api.scan(scanDir || undefined);
      await refreshWorks();
      setNotice(`扫描完成：新增 ${data.counts?.created || 0}，更新 ${data.counts?.updated || 0}，失败 ${data.counts?.failed || 0}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '扫描失败');
    } finally {
      setBusy('');
    }
  }

  function toggle(id: number) {
    setSelected((previous) => previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id]);
  }

  return (
    <section className="page discover-page">
      <PageHero title="发现" seal="采集" subtitle="从远端源发现同人志，支持关键词搜索、画廊 ID、批量 ID、CBZ 上传与目录扫描。" />
      <StatStrip items={[
        { label: '搜索结果', value: results.length, hint: '当前页', icon: <Search size={21} /> },
        { label: '已选择', value: selected.length, hint: '待入队', icon: <Check size={21} />, tone: selected.length ? 'red' : undefined },
        { label: '运行任务', value: running, hint: '下载 / 解析', icon: <Import size={21} />, tone: running ? 'blue' : undefined },
        { label: '批量 ID', value: parsedIds.length, hint: '已解析', icon: <ListPlus size={21} /> }
      ]} />

      <form className="command-bar" onSubmit={search}>
        <label className="search-box"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="关键词、artist:name、language:chinese、tag:school uniform" /></label>
        <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="排序">
          <option value="date">最新</option>
          <option value="popular">热门</option>
          <option value="popular-today">今日热门</option>
          <option value="popular-week">本周热门</option>
          <option value="popular-month">本月热门</option>
        </select>
        <input className="page-input" type="number" min={1} value={page} onChange={(event) => setPage(Number(event.target.value) || 1)} aria-label="页码" />
        <button className="primary-button" disabled={busy === 'search'}><Search size={16} />搜索</button>
      </form>

      {notice ? <p className="notice success">{notice}</p> : null}
      {error ? <p className="notice error">{error}</p> : null}

      <div className="discover-layout">
        <main className="paper-panel">
          <header className="panel-head">
            <div><h2>远端取材台</h2><p>封面通过后端代理加载，选中后可批量加入队列。</p></div>
            <div className="row-actions">
              <button type="button" className="ghost-button" onClick={() => setSelected(results.map((item) => item.id))} disabled={!results.length}>全选</button>
              <button type="button" className="primary-button" onClick={() => importIds(selected)} disabled={!selected.length || busy === 'import'}>导入选中</button>
            </div>
          </header>
          <div className="gallery-wall">
            {results.map((gallery) => (
              <article className={`gallery-tile ${selectedSet.has(gallery.id) ? 'selected' : ''}`} key={gallery.id}>
                <button className="tile-main" type="button" onClick={() => setFocused(gallery)}>
                  <Cover src={galleryCoverSrc(gallery)} title={gallery.title} token={api.token} selected={selectedSet.has(gallery.id)} />
                  <strong>{gallery.title}</strong>
                  <span>#{gallery.id} · {gallery.language || '未知'} · {gallery.num_pages || '?'}P</span>
                </button>
                <footer>
                  <label><input type="checkbox" checked={selectedSet.has(gallery.id)} onChange={() => toggle(gallery.id)} />选择</label>
                  <button type="button" onClick={() => importIds([gallery.id])}>入队</button>
                </footer>
              </article>
            ))}
            {!results.length ? <Empty title="等待搜索" text="输入远端关键词，或使用右侧 ID/本地导入。" /> : null}
          </div>
        </main>

        <aside className="side-stack">
          <section className="paper-panel inspector-panel">
            <h2>作品预览</h2>
            {preview ? <GalleryPreview gallery={preview} token={api.token} onImport={() => importIds([preview.id])} /> : <Empty title="未选择作品" text="搜索后点选封面查看 tags 和入库动作。" />}
          </section>
          <section className="paper-panel">
            <h2>画廊 ID</h2>
            <textarea className="id-box" value={ids} onChange={(event) => setIds(event.target.value)} placeholder="654778&#10;https://nhentai.net/g/654779/" />
            <button type="button" className="primary-button full" onClick={() => importIds(parsedIds)} disabled={!parsedIds.length}>批量加入队列</button>
          </section>
          <section className="paper-panel">
            <h2>本地文件</h2>
            <label className="upload-box"><FileArchive size={18} />上传 CBZ / ZIP<input type="file" accept=".cbz,.zip" onChange={(event) => upload(event.target.files?.[0])} /></label>
            <form className="scan-form" onSubmit={scan}>
              <input value={scanDir} onChange={(event) => setScanDir(event.target.value)} placeholder="留空使用设置中的导入目录" />
              <button className="ghost-button"><Upload size={16} />扫描目录</button>
            </form>
          </section>
        </aside>
      </div>
    </section>
  );
}

function GalleryPreview({ gallery, token, onImport }: { gallery: Gallery; token: string | null; onImport: () => void }) {
  return (
    <div className="preview-card">
      <Cover src={galleryCoverSrc(gallery)} title={gallery.title} token={token} />
      <h3>{gallery.title}</h3>
      <p>#{gallery.id} · {gallery.language || '未知语言'} · {gallery.num_pages || '?'} 页</p>
      <div className="tag-cloud">{(gallery.tags || []).slice(0, 18).map((tag) => <span key={`${tag.type}-${tag.id}`}>{tag.name}</span>)}</div>
      <button type="button" className="primary-button full" onClick={onImport}>加入导入队列</button>
    </div>
  );
}

function Empty({ title, text }: { title: string; text: string }) {
  return <div className="empty-panel"><strong>{title}</strong><span>{text}</span></div>;
}
