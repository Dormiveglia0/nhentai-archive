import { Check, ChevronLeft, ChevronRight, FileArchive, FileUp, Layers, ListPlus, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { type FormEvent, useMemo, useState } from 'react';
import { Cover } from '../components/Cover';
import { PageHeader } from '../components/Shell';
import { galleryCoverSrc, parseGalleryIds, type ApiClient, type Gallery, type Task, type Work } from '../lib/api';
import { TaskQueueDrawer } from './TaskQueueDrawer';

type ImportPanel = 'advanced' | 'bulk' | 'local' | null;

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
  const [lookupId, setLookupId] = useState('');
  const [sort, setSort] = useState('date');
  const [page, setPage] = useState(1);
  const [ids, setIds] = useState('');
  const [scanDir, setScanDir] = useState('');
  const [results, setResults] = useState<Gallery[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [focused, setFocused] = useState<Gallery | null>(null);
  const [panel, setPanel] = useState<ImportPanel>(null);
  const [queueOpen, setQueueOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const selectedGallery = focused || results.find((item) => selectedSet.has(item.id)) || results[0] || null;
  const parsedBulkIds = useMemo(() => parseGalleryIds(ids), [ids]);
  const runningTasks = tasks.filter((task) => ['queued', 'running', 'downloading'].includes(task.status)).length;

  async function search() {
    if (!query.trim()) {
      setError('请输入关键词、标签过滤或高级查询');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const data = await api.searchGalleries(query, page, sort);
      const next = Array.isArray(data.result) ? data.result : [];
      setResults(next);
      setFocused(next[0] || null);
      setMessage(`找到 ${data.total ?? data.count ?? next.length} 个结果`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '搜索失败');
    } finally {
      setBusy(false);
    }
  }

  async function lookup(event?: FormEvent) {
    event?.preventDefault();
    const parsed = parseGalleryIds(lookupId);
    if (!parsed.length) {
      setError('请输入有效画廊 ID 或 nhentai 链接');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const data = await api.gallery(parsed[0]);
      setFocused(data.gallery);
      setResults((previous) => [data.gallery, ...previous.filter((item) => item.id !== data.gallery.id)]);
      setMessage(data.already_imported ? '该作品已经在本地库中' : '画廊预览已加载');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ID 查询失败');
    } finally {
      setBusy(false);
    }
  }

  async function importIds(nextIds: number[]) {
    const clean = Array.from(new Set(nextIds.filter((id) => Number.isFinite(id) && id > 0)));
    if (!clean.length) {
      setError('没有可导入的画廊 ID');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await api.import(clean);
      if (Array.isArray(response.tasks)) setTasks(response.tasks);
      setSelected([]);
      setQueueOpen(true);
      await Promise.allSettled([refreshTasks(), refreshWorks()]);
      const suffix = response.errors?.length ? `，${response.errors.length} 项有问题` : '';
      setMessage(`加入队列完成：新增 ${response.added}，已存在 ${response.existing}，重试 ${response.retried}，忽略 ${response.ignored}${suffix}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加入队列失败');
    } finally {
      setBusy(false);
    }
  }

  async function importBulk(event?: FormEvent) {
    event?.preventDefault();
    await importIds(parsedBulkIds);
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const data = await api.upload(file);
      await refreshWorks();
      setMessage('本地 CBZ 已解析并加入库');
      openWork(data.work);
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传解析失败');
    } finally {
      setBusy(false);
    }
  }

  async function scan(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const data = await api.scan(scanDir || undefined);
      await refreshWorks();
      setMessage(`扫描完成：新增 ${data.counts?.created || 0}，更新 ${data.counts?.updated || 0}，失败 ${data.counts?.failed || 0}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '扫描失败');
    } finally {
      setBusy(false);
    }
  }

  function toggle(id: number) {
    setSelected((previous) => previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id]);
  }

  function selectVisible() {
    setSelected(results.map((item) => item.id));
  }

  return (
    <section className="page import-page search-workspace">
      <PageHeader
        title="搜索与导入"
        subtitle="搜索远程画廊，预览封面与标签，再导入为本地 CBZ 工作项。"
        action={<button type="button" className="ghost-button" onClick={() => setQueueOpen(true)}><Layers size={16} />队列 <span className="button-count">{runningTasks}</span></button>}
      />

      <section className="import-command">
        <div className="source-field">
          <span>数据源</span>
          <select aria-label="数据源">
            <option>nhentai API v2</option>
          </select>
        </div>
        <div className="main-search">
          <Search size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' ? search() : undefined} placeholder='关键词、artist:name、language:chinese、pages:>10' />
        </div>
        <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="排序">
          <option value="date">最新上传</option>
          <option value="popular">热门</option>
          <option value="popular-today">今日热门</option>
          <option value="popular-week">本周热门</option>
          <option value="popular-month">本月热门</option>
        </select>
        <div className="page-stepper" aria-label="页码">
          <button type="button" onClick={() => setPage(Math.max(1, page - 1))}><ChevronLeft size={16} /></button>
          <input value={page} min={1} onChange={(event) => setPage(Number(event.target.value) || 1)} type="number" />
          <button type="button" onClick={() => setPage(page + 1)}><ChevronRight size={16} /></button>
        </div>
        <button type="button" className="primary-button" onClick={search} disabled={busy}><Search size={17} />搜索</button>
        <button type="button" className="ghost-button" onClick={() => setPanel('advanced')}><SlidersHorizontal size={16} />高级</button>
      </section>

      <div className="import-quick-actions">
        <button type="button" onClick={() => setPanel('bulk')}><ListPlus size={16} />画廊 ID / 批量导入</button>
        <button type="button" onClick={() => setPanel('local')}><FileArchive size={16} />本地 CBZ / 目录扫描</button>
        <button type="button" onClick={selectVisible} disabled={!results.length}>选择当前结果</button>
        <button type="button" onClick={() => setSelected([])} disabled={!selected.length}>取消选择</button>
      </div>

      {error ? <p className="notice error">{error}</p> : null}
      {message ? <p className="notice success">{message}</p> : null}

      <div className="import-stage">
        <div className="result-board">
          <div className="result-board-head">
            <div>
              <strong>{results.length ? `结果 ${results.length} 项` : '等待搜索'}</strong>
              <span>默认显示后端代理封面；缺图时卡片会标记原因。</span>
            </div>
            <span>{selected.length} 项已选</span>
          </div>
          <div className="gallery-grid-large redesigned">
            {results.map((gallery) => (
              <article className={`gallery-card ${selectedSet.has(gallery.id) ? 'selected' : ''}`} key={gallery.id} onClick={() => setFocused(gallery)}>
                <label className="select-box" onClick={(event) => event.stopPropagation()}>
                  <input type="checkbox" checked={selectedSet.has(gallery.id)} onChange={() => toggle(gallery.id)} />
                  <span><Check size={13} /></span>
                </label>
                <Cover src={galleryCoverSrc(gallery)} title={gallery.title} selected={selectedSet.has(gallery.id)} token={api.token} />
                <div className="gallery-card-copy">
                  <span>#{gallery.id}</span>
                  <strong>{gallery.title}</strong>
                  <small>{gallery.language || '未知语言'} · {gallery.num_pages || '?'} 页</small>
                  {(gallery.cover_error || gallery.thumb_error) && !galleryCoverSrc(gallery) ? <em>{gallery.thumb_error || gallery.cover_error}</em> : null}
                </div>
                <button type="button" className="card-import" onClick={(event) => { event.stopPropagation(); importIds([gallery.id]); }} disabled={busy}><Plus size={15} />入队</button>
              </article>
            ))}
            {!results.length ? <EmptyImportState openBulk={() => setPanel('bulk')} openLocal={() => setPanel('local')} /> : null}
          </div>
        </div>

        {selectedGallery ? <GalleryPreview gallery={selectedGallery} imported={tasks.some((task) => task.gallery_id === selectedGallery.id)} token={api.token} busy={busy} onImport={() => importIds([selectedGallery.id])} /> : null}
      </div>

      {selected.length ? (
        <div className="selection-dock">
          <div className="selected-strip">
            {results.filter((item) => selectedSet.has(item.id)).slice(0, 10).map((item) => (
              <Cover key={item.id} src={galleryCoverSrc(item)} title={item.title} token={api.token} />
            ))}
          </div>
          <strong>已选择 {selected.length} 项</strong>
          <button type="button" onClick={() => setSelected([])}>清空</button>
          <button type="button" className="primary-button" onClick={() => importIds(selected)} disabled={busy}><Plus size={16} />批量加入队列</button>
        </div>
      ) : null}

      {panel ? (
        <ImportPanelDrawer panel={panel} busy={busy} ids={ids} setIds={setIds} parsedBulkIds={parsedBulkIds} importBulk={importBulk} lookupId={lookupId} setLookupId={setLookupId} lookup={lookup} scanDir={scanDir} setScanDir={setScanDir} scan={scan} upload={upload} close={() => setPanel(null)} />
      ) : null}

      <TaskQueueDrawer api={api} open={queueOpen} tasks={tasks} onClose={() => setQueueOpen(false)} onRefresh={refreshTasks} />
    </section>
  );
}

function GalleryPreview({ gallery, imported, token, busy, onImport }: { gallery: Gallery; imported: boolean; token: string | null; busy: boolean; onImport: () => void }) {
  const grouped = groupTags(gallery.tags || []);
  return (
    <aside className="gallery-preview redesigned">
      <Cover src={galleryCoverSrc(gallery)} title={gallery.title} token={token} />
      <div className="preview-title">
        <span>#{gallery.id}</span>
        <h2>{gallery.title}</h2>
        <p>{gallery.media_id || '无 media id'} · {gallery.language || '未知语言'} · {gallery.num_pages || '?'} 页</p>
      </div>
      <div className="preview-facts">
        <Info label="作者" value={namesOf(grouped.artist)} />
        <Info label="社团" value={namesOf(grouped.group)} />
        <Info label="分类" value={namesOf(grouped.category)} />
      </div>
      <div className="preview-section compact-tags">
        <h3>标签分组</h3>
        {Object.entries(grouped).slice(0, 8).map(([type, tags]) => (
          <div className="tag-group" key={type}>
            <strong>{tagTypeName(type)}</strong>
            <div className="tag-row">{tags.slice(0, 10).map((tag) => <span key={`${tag.type}-${tag.id}-${tag.name}`}>{tag.name}</span>)}</div>
          </div>
        ))}
      </div>
      <button type="button" className="primary-button" disabled={imported || busy} onClick={onImport}>{imported ? '已在队列或库中' : '加入导入队列'}</button>
    </aside>
  );
}

function ImportPanelDrawer({
  panel,
  busy,
  ids,
  setIds,
  parsedBulkIds,
  importBulk,
  lookupId,
  setLookupId,
  lookup,
  scanDir,
  setScanDir,
  scan,
  upload,
  close
}: {
  panel: ImportPanel;
  busy: boolean;
  ids: string;
  setIds: (value: string) => void;
  parsedBulkIds: number[];
  importBulk: (event?: FormEvent) => Promise<void>;
  lookupId: string;
  setLookupId: (value: string) => void;
  lookup: (event?: FormEvent) => Promise<void>;
  scanDir: string;
  setScanDir: (value: string) => void;
  scan: (event: FormEvent) => Promise<void>;
  upload: (file: File | undefined) => Promise<void>;
  close: () => void;
}) {
  return (
    <div className="drawer-backdrop" onClick={close}>
      <aside className="side-drawer import-drawer" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <h2>{panel === 'local' ? '本地导入' : panel === 'bulk' ? '画廊 ID 导入' : '高级查询'}</h2>
            <p>{panel === 'local' ? '上传 CBZ/ZIP 或扫描已挂载目录。' : '支持纯 ID、逗号、空格、换行和 nhentai 链接。'}</p>
          </div>
          <button type="button" className="icon-button" onClick={close}><X size={18} /></button>
        </header>
        {panel === 'bulk' ? (
          <>
            <form className="drawer-form" onSubmit={lookup}>
              <label>单个画廊预览</label>
              <div className="inline-form">
                <input value={lookupId} onChange={(event) => setLookupId(event.target.value)} placeholder="654778 或 https://nhentai.net/g/654778/" />
                <button type="submit" className="ghost-button" disabled={busy}>预览</button>
              </div>
            </form>
            <form className="drawer-form" onSubmit={importBulk}>
              <label>批量加入队列</label>
              <textarea value={ids} onChange={(event) => setIds(event.target.value)} placeholder="654778&#10;https://nhentai.net/g/654779/&#10;654780" />
              <div className="split-actions">
                <span className="muted">已解析 {parsedBulkIds.length} 个 ID</span>
                <button type="submit" className="primary-button" disabled={busy || !parsedBulkIds.length}>加入队列</button>
              </div>
            </form>
          </>
        ) : null}
        {panel === 'local' ? (
          <>
            <label className="upload-drop drawer-upload">
              <FileUp size={18} />
              <span>上传本地 CBZ/ZIP</span>
              <input type="file" accept=".cbz,.zip" onChange={(event) => upload(event.target.files?.[0])} />
            </label>
            <form className="drawer-form" onSubmit={scan}>
              <label>扫描目录</label>
              <div className="inline-form">
                <input value={scanDir} onChange={(event) => setScanDir(event.target.value)} placeholder="留空使用设置中的导入目录" />
                <button type="submit" className="ghost-button" disabled={busy}>扫描</button>
              </div>
            </form>
          </>
        ) : null}
        {panel === 'advanced' ? (
          <div className="query-help">
            <strong>查询语法</strong>
            <span>精确短语：&quot;exact phrase&quot;</span>
            <span>排除：-tag 或 -&quot;exact phrase&quot;</span>
            <span>可用字段：artist:name、language:chinese、tag:school uniform</span>
            <span>数值：pages:&gt;10、favorites:&gt;=100、uploaded:&lt;7d</span>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

function EmptyImportState({ openBulk, openLocal }: { openBulk: () => void; openLocal: () => void }) {
  return (
    <div className="empty-state import-empty">
      <Search size={28} />
      <h2>从搜索、ID 或本地 CBZ 开始</h2>
      <p>封面会通过后端代理加载；如果远端没有返回路径，会显示缺图原因。</p>
      <div className="split-actions">
        <button type="button" className="ghost-button" onClick={openBulk}>画廊 ID</button>
        <button type="button" className="ghost-button" onClick={openLocal}>本地文件</button>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value || '无'}</strong></div>;
}

function groupTags(tags: Gallery['tags']) {
  return tags.reduce<Record<string, Gallery['tags']>>((acc, tag) => {
    const key = tag.type || 'other';
    acc[key] = [...(acc[key] || []), tag];
    return acc;
  }, {});
}

function namesOf(tags?: Gallery['tags']) {
  return tags?.map((tag) => tag.name).filter(Boolean).slice(0, 3).join('、') || '无';
}

function tagTypeName(type: string) {
  const map: Record<string, string> = { artist: '作者', group: '社团', category: '分类', parody: '作品', character: '角色', language: '语言', tag: '标签' };
  return map[type] || type || '其他';
}
