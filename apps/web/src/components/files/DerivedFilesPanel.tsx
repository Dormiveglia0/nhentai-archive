import { Archive, ArrowUpRight, Image, RefreshCw, SearchCheck, Unlink } from "lucide-react";
import { useEffect, useState } from "react";

import { api, type DerivedEntry, type DerivedInventory, type FileDeletePreview } from "../../lib/api";
import { formatBytes } from "../../lib/format";
import { FolioMetricGrid } from "../folio/ui/FolioMetricGrid";
import { FolioSearchField, FolioSelect } from "../folio/ui/FolioPrimitives";
import { IconPager } from "../folio/ui/IconPager";
import { FileDeleteDialog } from "./FileDeleteDialog";
import "./MetadataPanel.css";

const CATEGORIES = [{ value: "all", label: "全部派生文件" }, { value: "cover", label: "封面" }, { value: "thumbnail", label: "缩略图" }, { value: "page", label: "页面缓存" }, { value: "archive", label: "阅读归档缓存" }];
const STATUSES = [{ value: "all", label: "全部状态" }, { value: "linked", label: "已关联作品" }, { value: "active", label: "在用 · 受保护" }, { value: "orphan", label: "无关联 · 残留" }];

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
  const [target, setTarget] = useState<DerivedEntry | null>(null);
  const [preview, setPreview] = useState<FileDeletePreview | null>(null);
  const [trigger, setTrigger] = useState<HTMLElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const update = () => { setFilter(readFilter()); setPage(1); };
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => { setQ(query.trim()); setPage(1); }, 250); return () => window.clearTimeout(timer); }, [query]);
  useEffect(() => {
    let alive = true; setLoading(true); setError(null);
    api.derivedFiles({ category: filter.category, status: filter.status, work_id: filter.work, q, page }).then(data => { if (alive) {
      const lastPage = Math.max(1, Math.ceil(data.total / data.per_page));
      if (page > lastPage) { setPage(lastPage); return; }
      setInventory(data);
    } })
      .catch(exc => { if (alive) setError(exc.message); }).finally(() => { if (alive) setLoading(false); });
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
  async function prepare(entry: DerivedEntry, button: HTMLElement) {
    setBusy(true); setError(null); setTarget(entry); setTrigger(button);
    try { setPreview(await api.previewFileDelete([{ kind: "derived", path: entry.path }])); }
    catch (exc) { setError(exc instanceof Error ? exc.message : String(exc)); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!target) return;
    setBusy(true); setError(null);
    try {
      const result = await api.deleteFiles([{ kind: "derived", path: target.path }]);
      if (result.errors.length) { setError(result.errors.map(error => error.message).join("；")); return; }
      setNotice(`已清理 ${result.deleted_files} 个派生文件，释放 ${formatBytes(result.reclaimed_bytes)}。作品资料和源文件保留。`);
      setPreview(null); setRevision(value => value + 1);
    } catch (exc) { setError(exc instanceof Error ? exc.message : String(exc)); }
    finally { setBusy(false); }
  }
  const summary = inventory?.summary;
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
    {error && !preview ? <p className="folio-media-error" role="alert">{error}</p> : null}{notice ? <p className="folio-data-notice" role="status">{notice}</p> : null}
    <div className="folio-data-list-head"><h3>实际文件清单</h3><span>{loading ? "正在读取…" : `${inventory?.total ?? 0} 个文件`}</span></div>
    <ul className="folio-data-list" aria-busy={loading}>{inventory?.result.map(entry => <li key={entry.id} data-path={entry.path}>
      <div className="folio-data-record"><span className="folio-data-record-kind">{CATEGORIES.find(item => item.value === entry.category)?.label}</span><strong>{entry.name}</strong><code className="folio-data-path">{entry.path}</code>{entry.title ? <span className="folio-data-title">{entry.title}</span> : null}</div>
      <div className="folio-data-record-state"><span className={`folio-data-status is-${entry.status}`}>{STATUSES.find(item => item.value === entry.status)?.label}</span><span>{formatBytes(entry.size_bytes)}</span><small>{new Date(entry.updated_at * 1000).toLocaleString()}</small></div>
      <div className="folio-data-row-actions">{entry.work_id ? <a className="folio-line-button" href={`#files?view=metadata&work_id=${entry.work_id}`}>查看所属资料<ArrowUpRight size={15} /></a> : null}<button className="folio-line-button" type="button" disabled={busy || entry.status === "active" || (entry.category === "cover" && entry.status === "linked")} onClick={event => void prepare(entry, event.currentTarget)}><SearchCheck size={15} />预览清理</button></div>
    </li>)}</ul>
    {!loading && !inventory?.result.length ? <p className="folio-data-empty">没有符合筛选条件的派生文件。</p> : null}
    <IconPager className="folio-files-pager" page={page} totalPages={Math.max(1, Math.ceil((inventory?.total ?? 0) / (inventory?.per_page ?? 50)))} loading={loading} onPage={setPage} />
    <p className="folio-data-footnote">实际存储：<code>{inventory?.data_dir ?? "正在读取…"}</code>。在用文件和当前封面受保护。清理缓存不清除作品元数据，所需缩略图会在再次读取时生成。</p>
    <FileDeleteDialog preview={preview} label={target?.name ?? null} returnFocus={trigger} error={error} busy={busy} onConfirm={() => void remove()} onCancel={() => setPreview(null)} />
  </section>;
}
