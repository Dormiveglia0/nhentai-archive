import { ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight, Folder, Pause, Pencil, Play, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { api, type LibraryItem, type LibraryScanRun, type MediaLibrary, type MediaLibraryConfig } from "../../lib/api";
import { formatBytes, parseUtcTimestamp } from "../../lib/format";
import { statusLabel } from "../../lib/jobs";
import { pageHref } from "../../lib/navigation";
import { FolioSelect } from "../folio/ui/FolioPrimitives";
import { MediaLibraryEditor } from "./MediaLibraryEditor";
import { useNativeDialog } from "../../lib/useNativeDialog";
import "./StorageSection.css";

const KINDS = { managed: "本地导入", local: "本地目录", mounted: "挂载目录" };
const HEALTH: Record<string, string> = { unknown: "尚未检查", online: "正常", offline: "不可用", partial: "部分失败" };
const ITEM_STATUS = { error: "读取失败", pending: "待稳定", missing: "源文件缺失", all: "全部文件" } as const;

function LibraryChecks({ library, initialStatus }: { library: MediaLibrary; initialStatus: keyof typeof ITEM_STATUS }) {
  const [status, setStatus] = useState<keyof typeof ITEM_STATUS>(initialStatus);
  const [page, setPage] = useState(1);
  const [runs, setRuns] = useState<LibraryScanRun[]>([]);
  const [items, setItems] = useState<{ result: LibraryItem[]; total: number; per_page: number } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    Promise.all([api.libraryScanRuns(library.id), api.libraryItems(library.id, status, page)])
      .then(([history, files]) => { if (alive) {
        const lastPage = Math.max(1, Math.ceil(files.total / files.per_page));
        if (page > lastPage) { setPage(lastPage); return; }
        setRuns(history.result); setItems(files);
      } })
      .catch(exc => { if (alive) setError(exc.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [library.id, library.last_scan_at, library.scanning, library.active_scan_status, status, page]);

  return <div className="folio-library-checks" aria-busy={loading}>
    <FolioSelect label="文件状态" value={status} options={Object.entries(ITEM_STATUS).map(([value, label]) => ({ value: value as keyof typeof ITEM_STATUS, label }))} onChange={value => { setStatus(value); setPage(1); }} />
    {error ? <p className="folio-media-error" role="alert">{error}</p> : null}
    <ul className="folio-library-issues">
      {items?.result.map(item => <li key={item.id}>
        <div className="folio-library-issue-head"><strong>{item.title}</strong><span>{item.relative_path}{item.size_bytes ? ` · ${formatBytes(item.size_bytes)}` : ""}</span></div>
        <span>{item.last_error ?? ({ pending: "文件尚未稳定", missing: item.work_id ? "源文件不可见，作品信息已保留" : "源文件不可见，保留了扫描时读取的归档元数据", ready: "已索引", unsupported: "不支持的文件格式", ignored: "已排除", detached: "库已移除" } as Record<string, string>)[item.status] ?? item.status}</span>
        {Object.keys(item.metadata).length ? <details><summary>查看已保留元数据</summary><dl tabIndex={0} aria-label="已保留元数据">{Object.entries(item.metadata).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{typeof value === "string" ? value : JSON.stringify(value, null, 2)}</dd></div>)}</dl></details> : null}
        <div className="folio-library-issue-actions">
          {item.work_id ? <a className="folio-settings-mini-action" href={pageHref({ name: "governance", workId: item.work_id })}>查看作品信息<ArrowUpRight size={13} /></a> : null}
          <a className="folio-settings-mini-action" href={`#files?view=metadata&library_id=${library.id}${item.work_id ? `&work_id=${item.work_id}` : "&status=unlinked"}`}>管理本地元数据<ArrowUpRight size={13} /></a>
        </div>
      </li>)}
    </ul>
    {!loading && items?.total === 0 ? <p className="folio-media-hint">没有{ITEM_STATUS[status]}记录</p> : null}
    {items && items.total > items.per_page ? <div className="folio-media-pager">
      <button type="button" aria-label="上一页文件" disabled={loading || page === 1} onClick={() => setPage(value => value - 1)}><ChevronLeft size={17} /></button>
      <span>{page} / {Math.ceil(items.total / items.per_page)}</span>
      <button type="button" aria-label="下一页文件" disabled={loading || page * items.per_page >= items.total} onClick={() => setPage(value => value + 1)}><ChevronRight size={17} /></button>
    </div> : null}
    <details className="folio-library-scan-history"><summary>扫描历史{runs.length ? ` · 最近 ${runs.length} 次` : ""}</summary>
      {runs.length ? <div className="folio-library-runs">
        {runs.map(run => <div key={run.id}>
          <time>{parseUtcTimestamp(run.started_at)?.toLocaleString() ?? "—"}</time>
          <span>{({ running: "正在扫描", completed: "已完成", cancelled: "已取消", failed: "失败", partial: "部分失败" } as Record<string, string>)[run.status] ?? run.status}</span>
          <span>{run.counts.indexed ?? 0} 新增或更新 · {run.counts.errors ?? 0} 失败</span>
          {run.errors[0] ? <p className="folio-media-error">{run.errors[0].path}：{run.errors[0].reason}</p> : null}
        </div>)}
      </div> : <p className="folio-media-hint">{loading ? "正在读取扫描记录…" : "尚无扫描记录"}</p>}
    </details>
  </div>;
}

export function MediaLibrariesSection() {
  const [libraries, setLibraries] = useState<MediaLibrary[]>([]);
  const [defaults, setDefaults] = useState<MediaLibraryConfig | null>(null);
  const [downloadLibraryId, setDownloadLibraryId] = useState("");
  const [editing, setEditing] = useState<MediaLibrary | "new" | null>(null);
  const [removing, setRemoving] = useState<MediaLibrary | null>(null);
  const [checking, setChecking] = useState<{ id: number; status: keyof typeof ITEM_STATUS } | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [savingDownload, setSavingDownload] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision(value => value + 1), []);

  useEffect(() => {
    let alive = true;
    let timer = 0;
    async function load() {
      if (!alive) return;
      if (!document.hidden && !document.querySelector<HTMLElement>(".app-route-archive")?.inert) {
        try {
          const payload = await api.mediaLibraries(true);
          if (!alive) return;
          setLibraries(payload.result.filter(library => !library.removed_at || library.item_count > 0));
          setDefaults(payload.defaults);
          setDownloadLibraryId(String(payload.default_download_library_id));
          setLoadError("");
        } catch (exc) { if (alive) setLoadError(exc instanceof Error ? exc.message : String(exc)); }
      }
      if (alive) timer = window.setTimeout(load, 5000);
    }
    void load();
    return () => { alive = false; window.clearTimeout(timer); };
  }, [revision]);

  async function act(library: MediaLibrary, action: "scan" | "toggle") {
    setBusy(library.id);
    setError("");
    setMessage("");
    try {
      if (action === "scan") { await api.enqueueLibraryScan(undefined, library.id); setMessage("扫描已加入队列"); }
      if (action === "toggle") await api.updateMediaLibrary(library.id, { enabled: !library.enabled });
      reload();
    } catch (exc) { setError(exc instanceof Error ? exc.message : String(exc)); }
    finally { setBusy(null); }
  }

  async function selectDownloadLibrary(value: string) {
    setSavingDownload(true);
    setError("");
    setMessage("");
    try {
      const settings = await api.updateSettings({ downloads: { default_library_id: Number(value) } });
      setDownloadLibraryId(String(settings.downloads.default_library_id));
      setMessage("默认下载媒体库已更新");
    } catch (exc) { setError(exc instanceof Error ? exc.message : String(exc)); }
    finally { setSavingDownload(false); }
  }

  const writableLibraries = libraries.filter(library => library.enabled && !library.read_only && library.health !== "offline");
  const downloadAvailable = writableLibraries.some(library => String(library.id) === downloadLibraryId);
  const downloadOptions = writableLibraries.map(library => ({ value: String(library.id), label: library.name }));
  if (!downloadAvailable && downloadLibraryId) downloadOptions.unshift({ value: downloadLibraryId, label: "当前下载库不可用" });

  return <section className="folio-media-libraries" aria-label="媒体库">
    <div className="folio-settings-subhead">
      <h3><Folder size={16} />媒体库</h3>
      {defaults && downloadOptions.length ? <div className="folio-download-library">
        <FolioSelect label="默认下载到" value={downloadLibraryId} disabled={savingDownload} options={downloadOptions} onChange={value => void selectDownloadLibrary(value)} />
      </div> : null}
      <div className="folio-media-actions">
        <button type="button" className="folio-settings-mini-action" onClick={reload} aria-label="刷新媒体库"><RefreshCw size={15} /></button>
        <button type="button" className="folio-line-button" disabled={!defaults} onClick={() => setEditing("new")}><Plus size={15} />添加库</button>
      </div>
    </div>
    {error || loadError ? <p className="folio-media-error" role="alert">{error || loadError}</p> : null}
    {message ? <p className="folio-media-feedback" role="status">{message}{message === "扫描已加入队列" ? <a href={pageHref({ name: "tasks" })}>打开队列<ArrowUpRight size={13} /></a> : null}</p> : null}
    {!defaults && !loadError ? <p className="folio-media-hint">正在读取媒体库…</p> : null}
    {defaults && !downloadAvailable ? <p className="folio-media-error" role="alert">当前下载库已暂停、只读、离线或已移除，请检查或重新选择。下载会报错，不会自动改存本地。</p> : null}
    <div className="folio-library-directory-list">
      {libraries.map(library => <article className="folio-library-directory" key={library.id}>
        <div className="folio-library-directory-main">
          <div><h4>{library.name}</h4><span className={library.health === "offline" || library.health === "partial" || library.error_count || library.missing_count ? "folio-media-error" : ""}>{library.removed_at ? "已移除" : library.active_scan_status ? statusLabel(library.active_scan_status) : library.scanning ? "正在扫描" : !library.enabled ? "已暂停" : library.error_count || library.missing_count ? "需要检查" : HEALTH[library.health] ?? library.health}</span></div>
          <p className="folio-library-directory-path" title={library.root_path}>{library.root_path}</p>
          <p className="folio-library-directory-stats"><span>{KINDS[library.kind]} · {library.kind === "mounted" ? [!library.read_only && "可存入", library.config.allow_writeback && "可回写", library.config.allow_delete && "可删除"].filter(Boolean).join(" / ") || "只读" : library.read_only ? "只读" : "可写"}</span>{library.removed_at ? <a href={`#files?view=metadata&library_id=${library.id}&status=detached`}>{library.item_count} 条保留资料<ArrowUpRight size={12} /></a> : <a href={pageHref({ name: "library" }) + "?library_id=" + library.id}>{library.work_count} 部作品<ArrowUpRight size={12} /></a>}{library.pending_count ? <button type="button" onClick={() => setChecking({ id: library.id, status: "pending" })}>{library.pending_count} 待稳定</button> : null}{library.error_count ? <button type="button" className="folio-media-error" onClick={() => setChecking({ id: library.id, status: "error" })}>{library.error_count} 读取失败</button> : null}{library.missing_count ? <a className="folio-media-error" href={`#files?view=metadata&library_id=${library.id}&status=missing`}>{library.missing_count} 缺失 · 元数据<ArrowUpRight size={12} /></a> : null}{library.scrape_review_count ? <span>{library.scrape_review_count} 刮削待确认</span> : null}</p>
          {library.last_error || library.watch_error ? <p className="folio-media-error">{library.last_error ?? library.watch_error}</p> : null}
        </div>
        <div className="folio-media-actions">
          {!library.removed_at ? <>
          <button type="button" className="folio-line-button" disabled={busy !== null || !library.enabled || library.scanning || !!library.active_scan_job_id} onClick={() => void act(library, "scan")}><RefreshCw size={14} />扫描</button>
          <button type="button" className="folio-settings-mini-action" disabled={busy !== null} onClick={() => void act(library, "toggle")}>{library.enabled ? <Pause size={14} /> : <Play size={14} />}{library.enabled ? "暂停" : "启用"}</button>
          <button type="button" className="folio-settings-mini-action" disabled={busy !== null} onClick={() => setEditing(library)}><Pencil size={14} />设置</button>
          {library.kind !== "managed" ? <button type="button" className="folio-settings-mini-action is-danger" aria-label={"移除媒体库 " + library.name} disabled={busy !== null || library.scanning || !!library.active_scan_job_id} onClick={() => setRemoving(library)}><Trash2 size={14} /></button> : null}
          </> : null}
          <button type="button" className="folio-settings-mini-action" aria-expanded={checking?.id === library.id} onClick={() => setChecking(value => value?.id === library.id ? null : { id: library.id, status: "all" })}><ChevronDown size={14} />{library.removed_at ? "保留记录" : "文件状态"}</button>
        </div>
        {checking?.id === library.id ? <LibraryChecks key={`${library.id}-${checking.status}`} library={library} initialStatus={checking.status} /> : null}
      </article>)}
    </div>
    {editing && defaults ? <MediaLibraryEditor library={editing === "new" ? null : editing} defaults={defaults} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setMessage("媒体库设置已保存"); reload(); }} /> : null}
    {removing ? <RemoveLibraryDialog library={removing} onClose={() => setRemoving(null)} onRemoved={purge => { setRemoving(null); setChecking(null); setMessage(purge ? "媒体库及独有作品信息已移除，源文件已保留" : "媒体库已移除，作品信息已保留"); reload(); }} /> : null}
  </section>;
}

function RemoveLibraryDialog({ library, onClose, onRemoved }: { library: MediaLibrary; onClose: () => void; onRemoved: (purge: boolean) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [purge, setPurge] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof api.mediaLibraryRemovalPreview>> | null>(null);
  const dismiss = useNativeDialog(dialog, onClose, true, busy);
  useEffect(() => {
    let alive = true;
    api.mediaLibraryRemovalPreview(library.id).then(value => { if (alive) setPreview(value); }).catch(reason => { if (alive) setError(reason.message); });
    return () => { alive = false; };
  }, [library.id]);
  async function remove() {
    setBusy(true); setError("");
    try { await api.removeMediaLibrary(library.id, purge); onRemoved(purge); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); setBusy(false); }
  }
  return createPortal(<dialog ref={dialog} className="folio-media-editor folio-remove-library" aria-label="移除媒体库">
    <header><h2>移除“{library.name}”</h2><button type="button" className="folio-media-icon-button" disabled={busy} onClick={dismiss} aria-label="关闭移除媒体库"><X size={18} /></button></header>
    <div className="folio-directory-picker-body">
      <fieldset disabled={busy} className="folio-remove-options">
        <label><input type="radio" name="purge" checked={!purge} onChange={() => setPurge(false)} /><span><strong>保留作品信息</strong><small>保留收藏、阅读记录和元数据，作品暂时无法从此库读取。</small></span></label>
        <label><input type="radio" name="purge" checked={purge} disabled={!preview?.purge_allowed} onChange={() => setPurge(true)} /><span><strong>清理独有作品信息{preview ? ` · ${preview.exclusive_works} 部` : ""}</strong><small>同时清理阅读记录及缓存。其他媒体库的作品信息和所有源文件保留。</small></span></label>
      </fieldset>
      {preview?.shared_works ? <p className="folio-media-hint">{preview.shared_works} 部作品关联其他来源，将保留。</p> : null}
      {preview?.warnings.map(warning => <p key={warning} className="folio-media-error">{warning}</p>)}
      {error ? <p role="alert" className="folio-media-error">{error}</p> : null}
    </div>
    <footer><button type="button" className="folio-line-button" data-dialog-focus autoFocus disabled={busy} onClick={dismiss}>取消</button><button type="button" className="folio-line-button is-primary" disabled={busy || !preview || (purge && !preview.purge_allowed)} onClick={() => void remove()}>{busy ? "正在移除" : "确认移除"}</button></footer>
  </dialog>, document.querySelector(".folio") ?? document.body);
}
