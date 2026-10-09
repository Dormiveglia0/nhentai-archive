import { ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight, Folder, Pause, Pencil, Play, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { api, type LibraryItem, type LibraryScanRun, type MediaLibrary, type MediaLibraryConfig } from "../../lib/api";
import { parseUtcTimestamp } from "../../lib/format";
import { statusLabel } from "../../lib/jobs";
import { pageHref } from "../../lib/navigation";
import { FolioSelect } from "../folio/ui/FolioPrimitives";
import { MediaLibraryEditor } from "./MediaLibraryEditor";

const KINDS = { managed: "本地导入", local: "本地目录", mounted: "挂载目录" };
const HEALTH: Record<string, string> = { unknown: "尚未检查", online: "正常", offline: "不可用", partial: "部分失败" };
const ITEM_STATUS = { error: "读取失败", pending: "待稳定", missing: "源文件缺失", all: "全部文件" } as const;

function LibraryChecks({ library }: { library: MediaLibrary }) {
  const [status, setStatus] = useState<keyof typeof ITEM_STATUS>("error");
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
    {runs.length ? <div className="folio-library-runs">
      {runs.map(run => <div key={run.id}>
        <time>{parseUtcTimestamp(run.started_at)?.toLocaleString() ?? "—"}</time>
        <span>{({ running: "正在扫描", completed: "已完成", cancelled: "已取消", failed: "失败", partial: "部分失败" } as Record<string, string>)[run.status] ?? run.status}</span>
        <span>{run.counts.indexed ?? 0} 新增或更新 · {run.counts.errors ?? 0} 失败</span>
        {run.errors[0] ? <p className="folio-media-error">{run.errors[0].path}：{run.errors[0].reason}</p> : null}
      </div>)}
    </div> : <p className="folio-media-hint">{loading ? "正在读取扫描记录…" : "尚无扫描记录"}</p>}
    <FolioSelect label="文件状态" value={status} options={Object.entries(ITEM_STATUS).map(([value, label]) => ({ value: value as keyof typeof ITEM_STATUS, label }))} onChange={value => { setStatus(value); setPage(1); }} />
    {error ? <p className="folio-media-error" role="alert">{error}</p> : null}
    <ul className="folio-library-issues">
      {items?.result.map(item => <li key={item.id}><strong>{item.relative_path}</strong><span>{item.last_error ?? ({ pending: "文件尚未稳定", missing: "源文件不可见，元数据已保留", ready: "已索引", unsupported: "不支持的文件格式", ignored: "已排除", detached: "库已移除" } as Record<string, string>)[item.status] ?? item.status}</span></li>)}
    </ul>
    {!loading && items?.total === 0 ? <p className="folio-media-hint">没有{ITEM_STATUS[status]}记录</p> : null}
    {items && items.total > items.per_page ? <div className="folio-media-pager">
      <button type="button" aria-label="上一页文件" disabled={loading || page === 1} onClick={() => setPage(value => value - 1)}><ChevronLeft size={17} /></button>
      <span>{page} / {Math.ceil(items.total / items.per_page)}</span>
      <button type="button" aria-label="下一页文件" disabled={loading || page * items.per_page >= items.total} onClick={() => setPage(value => value + 1)}><ChevronRight size={17} /></button>
    </div> : null}
  </div>;
}

export function MediaLibrariesSection() {
  const [libraries, setLibraries] = useState<MediaLibrary[]>([]);
  const [defaults, setDefaults] = useState<MediaLibraryConfig | null>(null);
  const [editing, setEditing] = useState<MediaLibrary | "new" | null>(null);
  const [checking, setChecking] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
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
      if (!document.hidden) {
        try {
          const payload = await api.mediaLibraries();
          if (!alive) return;
          setLibraries(payload.result);
          setDefaults(payload.defaults);
          setLoadError("");
        } catch (exc) { if (alive) setLoadError(exc instanceof Error ? exc.message : String(exc)); }
      }
      if (alive) timer = window.setTimeout(load, 5000);
    }
    void load();
    return () => { alive = false; window.clearTimeout(timer); };
  }, [revision]);

  async function act(library: MediaLibrary, action: "scan" | "toggle" | "remove") {
    if (action === "remove" && !window.confirm(`移除“${library.name}”？源文件和已保存的作品信息都会保留。`)) return;
    setBusy(library.id);
    setError("");
    setMessage("");
    try {
      if (action === "scan") { await api.enqueueLibraryScan(undefined, library.id); setMessage("扫描已加入队列"); }
      if (action === "toggle") await api.updateMediaLibrary(library.id, { enabled: !library.enabled });
      if (action === "remove") { await api.removeMediaLibrary(library.id); if (checking === library.id) setChecking(null); setMessage("媒体库已移除，源文件与作品信息已保留"); }
      reload();
    } catch (exc) { setError(exc instanceof Error ? exc.message : String(exc)); }
    finally { setBusy(null); }
  }

  return <section className="folio-media-libraries" aria-label="媒体库">
    <div className="folio-settings-subhead">
      <h3><Folder size={16} />媒体库</h3>
      <div className="folio-media-actions">
        <button type="button" className="folio-settings-mini-action" onClick={reload} aria-label="刷新媒体库"><RefreshCw size={15} /></button>
        <button type="button" className="folio-line-button" disabled={!defaults} onClick={() => setEditing("new")}><Plus size={15} />添加库</button>
      </div>
    </div>
    {error || loadError ? <p className="folio-media-error" role="alert">{error || loadError}</p> : null}
    {message ? <p className="folio-media-feedback" role="status">{message}{message === "扫描已加入队列" ? <a href={pageHref({ name: "tasks" })}>打开队列<ArrowUpRight size={13} /></a> : null}</p> : null}
    {!defaults && !loadError ? <p className="folio-media-hint">正在读取媒体库…</p> : null}
    <div className="folio-library-directory-list">
      {libraries.map(library => <article className="folio-library-directory" key={library.id}>
        <div className="folio-library-directory-main">
          <div><h4>{library.name}</h4><span className={library.health === "offline" || library.health === "partial" ? "folio-media-error" : ""}>{library.active_scan_status ? statusLabel(library.active_scan_status) : library.scanning ? "正在扫描" : !library.enabled ? "已暂停" : HEALTH[library.health] ?? library.health}</span></div>
          <p className="folio-library-directory-path" title={library.root_path}>{library.root_path}</p>
          <p className="folio-library-directory-stats"><span>{KINDS[library.kind]} · {library.read_only ? "只读" : "可写"}</span><span>{library.work_count} 部作品</span>{library.pending_count ? <span>{library.pending_count} 待稳定</span> : null}{library.error_count ? <span className="folio-media-error">{library.error_count} 读取失败</span> : null}{library.missing_count ? <span>{library.missing_count} 缺失</span> : null}{library.scrape_review_count ? <span>{library.scrape_review_count} 刮削待确认</span> : null}</p>
          {library.last_error || library.watch_error ? <p className="folio-media-error">{library.last_error ?? library.watch_error}</p> : null}
        </div>
        <div className="folio-media-actions">
          <button type="button" className="folio-line-button" disabled={busy !== null || !library.enabled || library.scanning || !!library.active_scan_job_id} onClick={() => void act(library, "scan")}><RefreshCw size={14} />扫描</button>
          <button type="button" className="folio-settings-mini-action" disabled={busy !== null} onClick={() => void act(library, "toggle")}>{library.enabled ? <Pause size={14} /> : <Play size={14} />}{library.enabled ? "暂停" : "启用"}</button>
          <button type="button" className="folio-settings-mini-action" disabled={busy !== null} onClick={() => setEditing(library)}><Pencil size={14} />设置</button>
          <button type="button" className="folio-settings-mini-action" aria-expanded={checking === library.id} onClick={() => setChecking(value => value === library.id ? null : library.id)}><ChevronDown size={14} />记录</button>
          {library.kind !== "managed" ? <button type="button" className="folio-settings-mini-action is-danger" aria-label={"移除媒体库 " + library.name} disabled={busy !== null || library.scanning || !!library.active_scan_job_id} onClick={() => void act(library, "remove")}><Trash2 size={14} /></button> : null}
        </div>
        {checking === library.id ? <LibraryChecks library={library} /> : null}
      </article>)}
    </div>
    {editing && defaults ? <MediaLibraryEditor library={editing === "new" ? null : editing} defaults={defaults} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setMessage("媒体库设置已保存"); reload(); }} /> : null}
  </section>;
}
