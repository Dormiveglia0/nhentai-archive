import { ArrowRight, ArrowUpRight, Check, RefreshCw, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { api, type Job, type MediaLibrary, type MigrationOptions, type MigrationPreview } from "../../lib/api";
import { formatBytes } from "../../lib/format";
import { pageHref } from "../../lib/navigation";
import { useNativeDialog } from "../../lib/useNativeDialog";
import { FolioSelect } from "../folio/ui/FolioPrimitives";
import { IconPager } from "../folio/ui/IconPager";

export function MigrationPanel({ onLibraries }: { onLibraries: () => void }) {
  const [libraries, setLibraries] = useState<MediaLibrary[]>([]);
  const [candidates, setCandidates] = useState<Awaited<ReturnType<typeof api.migrationCandidates>> | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [target, setTarget] = useState("");
  const [move, setMove] = useState(false);
  const [conflict, setConflict] = useState<"rename" | "skip">("rename");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [preview, setPreview] = useState<MigrationOptions | null>(null);
  const [started, setStarted] = useState<Job | null>(null);
  useEffect(() => {
    let alive = true;
    setLoading(true); setError("");
    Promise.all([api.mediaLibraries(), api.migrationCandidates(page, q)]).then(([media, works]) => {
      if (!alive) return;
      const writable = media.result.filter(library => library.kind === "local" && library.enabled && !library.read_only);
      setLibraries(writable); setCandidates(works);
      setTarget(value => writable.some(library => String(library.id) === value) ? value : String(writable[0]?.id ?? ""));
    }).catch(reason => { if (alive) setError(reason.message); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [page, q, revision]);
  const rows = candidates?.result ?? [];
  const allSelected = rows.length > 0 && rows.every(row => selected.has(row.id));
  function toggle(id: number) {
    setSelected(value => { const next = new Set(value); if (next.has(id)) next.delete(id); else if (next.size < 500) next.add(id); return next; });
  }
  return <section className="folio-migration" aria-label="媒体库迁移">
    <header className="folio-settings-subhead"><h3>归并本地导入</h3><button type="button" className="folio-settings-mini-action" aria-label="刷新迁移列表" onClick={() => setRevision(value => value + 1)}><RefreshCw size={16} /></button></header>
    {error ? <p className="folio-media-error" role="alert">{error}</p> : null}
    {started ? <div className="folio-migration-started" role="status"><Check size={18} /><span>迁移已加入队列</span><a className="folio-line-button" href={pageHref({ name: "tasks" })}>查看进度<ArrowUpRight size={16} /></a></div> : null}
    <div className="folio-migration-options">
      <div>{libraries.length ? <FolioSelect label="目标媒体库" value={target} options={libraries.map(library => ({ value: String(library.id), label: library.name }))} onChange={setTarget} /> : <button type="button" className="folio-line-button" disabled={loading} onClick={onLibraries}>添加可写目录<ArrowUpRight size={15} /></button>}</div>
      <div><FolioSelect label="迁移方式" value={move ? "move" : "copy"} onChange={value => setMove(value === "move")} options={[{ value: "copy", label: "复制 · 保留导入源文件" }, { value: "move", label: "移动 · 验证后移除导入源文件" }]} /></div>
      <div><FolioSelect label="同名文件" value={conflict} onChange={value => setConflict(value as "rename" | "skip")} options={[{ value: "rename", label: "保留现有文件，自动重命名" }, { value: "skip", label: "跳过" }]} /></div>
    </div>
    <div className="folio-migration-list-head">
      <label className="folio-migration-check"><input type="checkbox" aria-label="选择当前页作品" checked={allSelected} disabled={!rows.length || loading} onChange={() => setSelected(value => {
        const next = new Set(value); rows.forEach(row => { if (allSelected) next.delete(row.id); else if (next.size < 500) next.add(row.id); }); return next;
      })} />{selected.size ? `${selected.size} 部已选` : candidates ? `${candidates.total} 部可迁移` : "正在读取…"}</label>
      <form onSubmit={event => { event.preventDefault(); setQ(query.trim()); setPage(1); }}><input aria-label="搜索可迁移作品" placeholder="搜索作品" value={query} onChange={event => setQuery(event.target.value)} /><button type="submit" aria-label="搜索可迁移作品"><Search size={17} /></button></form>
    </div>
    <div className="folio-migration-list" aria-busy={loading}>
      {!rows.length ? <p className="folio-empty-copy">{loading ? "正在读取本地导入…" : "没有待归并的本地导入作品"}</p> : rows.map(row => <label key={row.id} className="folio-migration-row" data-work-id={row.id}>
        <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)} aria-label={"选择 " + (row.pretty_title || row.title)} disabled={!selected.has(row.id) && selected.size >= 500} />
        <span title={row.pretty_title || row.title}>{row.pretty_title || row.title}</span><small>{row.page_count} 页</small><strong>{formatBytes(row.size_bytes)}</strong>
      </label>)}
    </div>
    <IconPager className="folio-files-pager" page={page} totalPages={Math.max(1, Math.ceil((candidates?.total ?? 0) / 50))} loading={loading} onPage={setPage} />
    {candidates ? <footer className="folio-migration-footer"><button className="folio-settings-mini-action" type="button" disabled={!selected.size} onClick={() => setSelected(new Set())}>清空选择</button><button type="button" className="folio-line-button is-primary" disabled={!selected.size || !target || loading} onClick={() => setPreview({ work_ids: [...selected], library_id: Number(target), move, conflict })}>预览迁移<ArrowRight size={16} /></button></footer> : null}
    {preview ? <MigrationDialog options={preview} onClose={() => setPreview(null)} onStarted={job => { setStarted(job); setPreview(null); setSelected(new Set()); }} /> : null}
  </section>;
}

function MigrationDialog({ options, onClose, onStarted }: { options: MigrationOptions; onClose: () => void; onStarted: (job: Job) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [preview, setPreview] = useState<MigrationPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dismiss = useNativeDialog(dialog, onClose, true, busy);
  useEffect(() => {
    let alive = true;
    api.migrationPreview(options).then(value => { if (alive) setPreview(value); }).catch(reason => { if (alive) setError(reason.message); });
    return () => { alive = false; };
  }, [options]);
  async function start() {
    setBusy(true); setError("");
    try { onStarted(await api.migrateLibrary(options)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); setBusy(false); }
  }
  return createPortal(<dialog ref={dialog} className="folio-media-editor folio-migration-dialog" aria-label="迁移预览">
    <header><h2>迁移预览</h2><button type="button" className="folio-media-icon-button" aria-label="关闭迁移预览" disabled={busy} onClick={dismiss}><X size={18} /></button></header>
    <div className="folio-directory-picker-body">
      {preview ? <><div className="folio-migration-destination"><strong>{preview.library_name}</strong><span title={preview.root_path}>{preview.root_path}</span></div><dl className="folio-migration-summary"><div><dt>可迁移</dt><dd>{preview.ready} 部</dd></div><div><dt>文件大小</dt><dd>{formatBytes(preview.total_bytes)}</dd></div><div><dt>目标剩余</dt><dd>{formatBytes(preview.free_bytes)}</dd></div></dl>
        <p className="folio-migration-explanation">{options.move ? "目标副本通过校验并登记后，移除本地导入源文件。" : "复制到目标媒体库，保留本地导入源文件。"}收藏、阅读进度和人工信息保留。</p>
        <ul className="folio-migration-preview-list">{preview.plan.map(entry => <li key={entry.work_id}><span title={entry.title}>{entry.title}</span><small className={entry.status === "blocked" ? "folio-media-error" : ""}>{entry.reason || entry.name}</small></li>)}</ul>
      </> : !error ? <p>正在核对文件与目标…</p> : null}
      {error ? <p role="alert" className="folio-media-error">{error}</p> : null}
    </div>
    <footer><button type="button" className="folio-line-button" data-dialog-focus autoFocus disabled={busy} onClick={dismiss}>返回</button><button type="button" className="folio-line-button is-primary" disabled={busy || !preview?.ready || !!preview?.blocked} onClick={() => void start()}>{busy ? "正在加入队列" : options.move ? "确认移动" : "确认复制"}</button></footer>
  </dialog>, document.querySelector(".folio") ?? document.body);
}
