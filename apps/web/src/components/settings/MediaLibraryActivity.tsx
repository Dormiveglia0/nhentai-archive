import { useEffect, useState } from "react";
import { api, type LibraryScanRun, type MediaLibrary } from "../../lib/api";
import { parseUtcTimestamp } from "../../lib/format";

const results: Record<string, string> = { indexed: "已导入", unchanged: "未变化", pending: "等待稳定", unsupported: "不支持", error: "读取失败", errors: "读取失败" };
const stages: Record<string, string> = { walking: "检查目录", reading: "读取归档", running: "扫描中", completed: "扫描完成", partial: "部分完成", failed: "扫描失败", cancelled: "扫描已取消", interrupted: "扫描已中断" };

export function MediaLibraryActivity({ library, onChange }: { library: MediaLibrary; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [runs, setRuns] = useState<LibraryScanRun[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    let alive = true, timer = 0;
    async function load() {
      if (!document.hidden) {
        try { const payload = await api.libraryScanRuns(library.id, 20); if (alive) { setRuns(payload.result); setError(""); } }
        catch (reason) { if (alive) setError(reason instanceof Error ? reason.message : String(reason)); }
      }
      if (alive) timer = window.setTimeout(load, 3000);
    }
    void load();
    return () => { alive = false; window.clearTimeout(timer); };
  }, [open, library.id]);

  async function control(action: "pause" | "resume" | "cancel") {
    if (!library.active_scan_job_id) return;
    setBusy(true); setError("");
    try {
      const operation = { pause: api.pauseJob, resume: api.resumeJob, cancel: api.cancelJob }[action];
      await operation(library.active_scan_job_id); onChange();
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  }
  const c = library.scan_counts;
  const active = library.scanning || !!library.active_scan_job_id;
  return <section className="folio-media-activity" aria-label={`${library.name}导入进度`}>
    <header><strong>{active ? library.active_scan_status === "paused" ? "扫描已暂停" : library.active_scan_status === "queued" ? "排队等待" : library.active_scan_status === "cancelling" ? "正在取消扫描" : stages[library.scan_progress.stage ?? ""] ?? "等待扫描" : stages[library.scan_status ?? ""] ?? "尚未扫描"}</strong>
      {library.scan_started_at ? <time>{parseUtcTimestamp(library.scan_started_at)?.toLocaleString()}</time> : null}
      <div>{library.active_scan_job_id ? <>
        <button type="button" className="folio-settings-mini-action" disabled={busy || library.active_scan_status === "cancelling"} onClick={() => void control(library.active_scan_status === "paused" ? "resume" : "pause")}>{library.active_scan_status === "paused" ? "继续扫描" : "暂停扫描"}</button>
        <button type="button" className="folio-settings-mini-action" disabled={busy || library.active_scan_status === "cancelling"} onClick={() => void control("cancel")}>取消扫描</button>
      </> : null}<button type="button" className="folio-settings-mini-action" aria-expanded={open} onClick={() => setOpen(value => !value)}>操作记录</button></div>
    </header>
    {active ? <div className={`folio-media-scan-progress${library.active_scan_status === 'paused' ? ' is-paused' : ''}`} role="progressbar" aria-label="目录扫描进行中" aria-valuetext={library.active_scan_status === 'paused' ? '扫描已暂停' : '正在检查文件'} /> : null}
    {library.scan_run_id ? <p className="folio-media-activity-counts"><span>已检查 <b>{c.files ?? 0}</b></span><span>导入 <b>{c.indexed ?? 0}</b></span><span>未变化 <b>{c.unchanged ?? 0}</b></span><span>待稳定 <b>{c.pending ?? 0}</b></span><span>失败 <b>{c.errors ?? 0}</b></span></p> : null}
    {active && library.scan_progress.path ? <p className="folio-media-current-file" title={library.scan_progress.path}>{library.scan_progress.path}</p> : null}
    <p className="folio-media-activity-counts"><strong>自动刮削{!library.enabled || !library.config.auto_scrape ? " · 未启用" : ""}</strong>
      {[['pending', '等待', library.scrape_pending_count], ['running', '处理中', library.scrape_running_count], ['review', '待确认', library.scrape_review_count], ['error', '失败', library.scrape_error_count], ['completed', '已完成', library.scrape_completed_count]].map(([state, label, count]) => <a key={state} href={`#governance?view=scrape&library_id=${library.id}&status=${state}`}>{label} <b>{count}</b></a>)}
    </p>
    {library.scrape_retry_at && library.scrape_retry_at * 1000 > Date.now() ? <p className="folio-media-hint">下次重试：{new Date(library.scrape_retry_at * 1000).toLocaleString()}</p> : null}
    {error ? <p className="folio-media-error" role="alert">{error}</p> : null}
    {open ? <div className="folio-media-activity-history">{runs.length ? runs.map(run => <details key={run.id} open={run.status === 'running'}>
      <summary><time>{parseUtcTimestamp(run.started_at)?.toLocaleString()}</time><span>{stages[run.status] ?? run.status}</span><span>导入 {run.counts.indexed ?? 0} · 失败 {run.counts.errors ?? 0}</span></summary>
      <ul>{run.progress.events?.map((event, i) => <li key={i}><time>{new Date(event.at * 1000).toLocaleTimeString()}</time><strong>{results[event.status] ?? event.status}</strong><span>{event.path}</span>{event.reason ? <p>{event.reason}</p> : null}</li>)}</ul>
      {run.errors.length ? <ul className="folio-media-error">{run.errors.map((row, i) => <li key={i}><span>{row.path}</span><p>{row.reason}</p></li>)}</ul> : null}
      {!run.progress.events?.length && !run.errors.length ? <p className="folio-media-hint">已检查 {run.counts.files ?? 0} 个文件 · 未变化 {run.counts.unchanged ?? 0} · 待稳定 {run.counts.pending ?? 0}</p> : null}
    </details>) : <p className="folio-media-hint">尚无扫描记录</p>}</div> : null}
  </section>;
}
