import { Archive, ArrowUpRight, Image, RefreshCw, Unlink, Eye, Download, X, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { api, type DerivedEntry, type DerivedInventory, type FileDeletePreview } from "../../lib/api";
import { useNativeDialog } from "../../lib/useNativeDialog";
import { formatBytes } from "../../lib/format";
import { FolioMetricGrid } from "../folio/ui/FolioMetricGrid";
import { FolioSearchField, FolioSelect } from "../folio/ui/FolioPrimitives";
import { IconPager } from "../folio/ui/IconPager";
import { FileDeleteDialog } from "./FileDeleteDialog";
import "./MetadataPanel.css";

const CATEGORIES = [{ value: "all", label: "全部派生文件" }, { value: "cover", label: "封面" }, { value: "thumbnail", label: "缩略图" }, { value: "page", label: "页面缓存" }, { value: "archive", label: "阅读归档缓存" }];
const STATUSES = [{ value: "all", label: "全部状态" }, { value: "linked", label: "已关联作品" }, { value: "active", label: "在用 · 受保护" }, { value: "orphan", label: "无关联 · 残留" }];

function canSelectEntry(entry: DerivedEntry) {
  return entry.status !== "active" && !(entry.category === "cover" && entry.status === "linked");
}

export function DerivedFilesPanel() {
  const readFilter = () => {
    const params = new URLSearchParams(window.location.hash.split("?")[1]);
    return { category: params.get("category") ?? "all", status: params.get("status") ?? "all", work: params.get("work_id") ?? "" };
  };
  const [filter, setFilter] = useState(readFilter);
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [inventory, setInventory] = useState<DerivedInventory | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [targets, setTargets] = useState<DerivedEntry[]>([]);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewing, setViewing] = useState<DerivedEntry | null>(null);
  const [preview, setPreview] = useState<FileDeletePreview | null>(null);
  const [trigger, setTrigger] = useState<HTMLElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const update = () => { setFilter(readFilter()); setPage(1); };
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => { setQ(query.trim()); setPage(1); }, 250); return () => window.clearTimeout(timer); }, [query]);
  useEffect(() => {
    let alive = true; setLoading(true); setInventory(null); setSelected(new Set()); setLoadError(null);
    api.derivedFiles({ category: filter.category, status: filter.status, work_id: filter.work, q, page }).then(data => { if (alive) {
      const lastPage = Math.max(1, Math.ceil(data.total / data.per_page));
      if (page > lastPage) { setPage(lastPage); return; }
      setInventory(data);
      if (!data.result.some(canSelectEntry)) setSelecting(false);
    } })
      .catch(exc => { if (alive) setLoadError(exc.message); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [filter, q, page, revision]);
  function changeFilter(next: typeof filter) {
    setFilter(next); setPage(1);
    const params = new URLSearchParams({ view: "derived" });
    if (next.category !== "all") params.set("category", next.category);
    if (next.status !== "all") params.set("status", next.status);
    if (next.work) params.set("work_id", next.work);
    window.history.replaceState(null, "", "#files?" + params);
  }
  async function prepare(entries: DerivedEntry[], button: HTMLElement) {
    if (busy || !entries.length) return;
    setBusy(true); setError(null); setTargets(entries); setTrigger(button);
    try { setPreview(await api.previewFileDelete(entries.map(entry => ({ kind: "derived", path: entry.path })))); }
    catch (exc) { setError(exc instanceof Error ? exc.message : String(exc)); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (busy || !targets.length) return;
    setBusy(true); setError(null);
    try {
      const result = await api.deleteFiles(targets.map(entry => ({ kind: "derived", path: entry.path })));
      setError(result.errors.length ? result.errors.map(error => error.message).join("；") : null);
      setNotice(`已清理 ${result.deleted_files} 个派生文件，释放 ${formatBytes(result.reclaimed_bytes)}。作品资料和源文件保留。`);
      setPreview(null); setRevision(value => value + 1);
    } catch (exc) { setError(exc instanceof Error ? exc.message : String(exc)); }
    finally { setBusy(false); }
  }
  const summary = inventory?.summary;
  const entries = inventory?.result ?? [];
  const selectable = entries.filter(canSelectEntry);
  const canSelectPage = !loading && !loadError && selectable.length > 0;
  const selectionMode = selecting && canSelectPage;
  const allSelected = selectionMode && selectable.every(entry => selected.has(entry.id));
  return <section className="folio-derived-files" aria-label="派生文件管理">
    <header className="folio-data-heading"><div><h2>派生文件</h2><p>封面、缩略图、页面与阅读归档缓存只存于应用数据目录，不写入媒体库。</p></div><button className="folio-line-button" type="button" aria-label="刷新派生文件列表" disabled={loading || busy} onClick={() => setRevision(value => value + 1)}><RefreshCw size={16} />刷新</button></header>
    <FolioMetricGrid ariaLabel="派生文件概览" className="folio-files-summary" items={[
      { label: "封面", value: summary?.cover ?? "—", icon: Image },
      { label: "缩略图 / 页面", value: summary ? summary.thumbnail + summary.page : "—", icon: Image },
      { label: "阅读归档缓存", value: summary?.archive ?? "—", icon: Archive, detail: <a href="#settings?section=storage">缓存配额与自动回收<ArrowUpRight size={12} /></a> },
      { label: "无关联残留", value: summary?.orphan_count ?? "—", icon: Unlink, tone: summary?.orphan_count ? "warning" : "good", detail: summary ? formatBytes(summary.orphan_bytes) : "正在读取" },
    ]} />
    <div className="folio-data-filters"><FolioSearchField value={query} onChange={setQuery} placeholder="搜索派生文件路径或作品标题" /><FolioSelect label="派生文件类型" value={filter.category} options={CATEGORIES} onChange={category => changeFilter({ ...filter, category })} /><FolioSelect label="关联状态" value={filter.status} options={STATUSES} onChange={status => changeFilter({ ...filter, status })} /></div>
    {filter.work ? <p className="folio-data-footnote">正在查看作品 #{filter.work} 的派生文件。<button className="folio-line-button" type="button" onClick={() => changeFilter({ ...filter, work: "" })}>查看全部作品</button></p> : null}
    {(error || loadError) && !preview ? <p className="folio-media-error" role="alert">{error || loadError}</p> : null}{notice ? <p className="folio-data-notice" role="status">{notice}</p> : null}
    <div className="folio-data-list-head folio-files-list-headbar">
      <div className="folio-files-list-heading">
        <h3>文件清单</h3>
        <span aria-live="polite">{loading ? "正在读取…" : `${inventory?.total ?? 0} 项`}{selectionMode ? ` · 已选 ${selected.size}` : ""}</span>
      </div>
      <div className="folio-files-list-actions" role="group" aria-label="派生文件批量操作">
        {selectionMode ? <>
          <button className="folio-line-button" type="button" title="选择或取消选择本页可清理文件" aria-pressed={allSelected} disabled={busy || !canSelectPage} onClick={() => { if (canSelectPage) setSelected(allSelected ? new Set() : new Set(selectable.map(entry => entry.id))); }}>全选</button>
          <button className="folio-line-button" type="button" disabled={busy || !selected.size} onClick={() => setSelected(new Set())}>清空</button>
          <button className="folio-line-button" type="button" title="预览清理影响" disabled={loading || busy || !selected.size} onClick={event => void prepare(selectable.filter(entry => selected.has(entry.id)), event.currentTarget)}>清理</button>
        </> : null}
        <button className="folio-line-button" type="button" aria-pressed={selectionMode} disabled={busy || !canSelectPage} onClick={() => { if (!canSelectPage) return; setSelecting(!selectionMode); setSelected(new Set()); }}>{selectionMode ? "取消" : "批量"}</button>
      </div>
    </div>
    <ul className="folio-data-list" aria-busy={loading}>{entries.map(entry => {
      const canSelect = selectable.includes(entry);
      const protectedReason = entry.status === "active" ? "正在使用" : "当前封面保留";
      return <li key={entry.id} data-path={entry.path} className={selected.has(entry.id) ? "is-selected" : ""}>
        <div className="folio-data-record"><span className="folio-data-record-kind">{CATEGORIES.find(item => item.value === entry.category)?.label}</span><strong>{entry.name}</strong><code className="folio-data-path">{entry.path}</code>{entry.title ? <span className="folio-data-title">{entry.title}</span> : null}</div>
        <div className="folio-data-record-state"><span className={`folio-data-status is-${entry.status}`}>{STATUSES.find(item => item.value === entry.status)?.label}</span><span>{formatBytes(entry.size_bytes)}</span><small>{new Date(entry.updated_at * 1000).toLocaleString()}</small></div>
        {selectionMode ? <>
          <span className="folio-derived-selection-state">{canSelect ? selected.has(entry.id) ? <><Check size={16} />已选</> : "点击选择" : protectedReason}</span>
          {canSelect ? <button type="button" className="folio-derived-row-select" aria-label={`选择 ${entry.name}`} aria-pressed={selected.has(entry.id)} disabled={loading || busy} onClick={() => setSelected(current => { const next = new Set(current); if (next.has(entry.id)) next.delete(entry.id); else next.add(entry.id); return next; })} /> : null}
        </> : <div className="folio-data-row-actions">
          <button className="folio-line-button" type="button" onClick={() => setViewing(entry)}><Eye size={15} />查看文件</button>
          {entry.work_id ? <a className="folio-line-button" href={`#files?view=metadata&work_id=${entry.work_id}`}>查看所属资料<ArrowUpRight size={15} /></a> : null}
          {canSelect ? <button className="folio-line-button" type="button" disabled={loading || busy} onClick={event => void prepare([entry], event.currentTarget)}>清理</button> : <span className="folio-derived-protected">{protectedReason}</span>}
        </div>}
      </li>;
    })}</ul>
    {!loading && !inventory?.result.length ? <p className="folio-data-empty">没有符合筛选条件的派生文件。</p> : null}
    <IconPager className="folio-files-pager" page={page} totalPages={Math.max(1, Math.ceil((inventory?.total ?? 0) / (inventory?.per_page ?? 50)))} loading={loading} onPage={setPage} />
    <p className="folio-data-footnote">实际存储：<code>{inventory?.data_dir ?? "正在读取…"}</code>。在用文件和当前封面受保护。清理缓存不清除作品元数据，所需缩略图会在再次读取时生成。</p>
    {viewing ? <DerivedFileViewer entry={viewing} onClose={() => setViewing(null)} /> : null}
    <FileDeleteDialog preview={preview} label={targets.length === 1 ? targets[0].name : `已选 ${targets.length} 个派生文件`} returnFocus={trigger} error={error} busy={busy} onConfirm={() => void remove()} onCancel={() => setPreview(null)} />
  </section>;
}

function DerivedFileViewer({ entry, onClose }: { entry: DerivedEntry; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [failed, setFailed] = useState(false);
  const dismiss = useNativeDialog(dialog, onClose, true);
  const isImage = /\.(jpe?g|png|webp|gif|avif)$/i.test(entry.name);
  return <dialog ref={dialog} className="folio-media-editor folio-derived-viewer" aria-label="查看派生文件">
    <header><h2>{entry.name}</h2><button type="button" className="folio-media-icon-button" aria-label="关闭文件预览" onClick={dismiss} data-dialog-focus autoFocus><X size={18} /></button></header>
    <div className="folio-derived-preview">
      <code className="folio-data-path">{entry.path}</code><p>{formatBytes(entry.size_bytes)}</p>
      {isImage ? failed ? <p role="alert">图片无法读取，文件可能已被清理，请刷新列表。</p> : <img src={api.derivedFileUrl(entry.path)} alt={entry.name} onError={() => setFailed(true)} /> : <p>此文件无法直接预览，可下载后查看。</p>}
    </div>
    <footer><a className="folio-line-button" href={api.derivedFileUrl(entry.path, true)}><Download size={15} />下载文件</a><button className="folio-line-button" type="button" onClick={dismiss}>关闭</button></footer>
  </dialog>;
}
