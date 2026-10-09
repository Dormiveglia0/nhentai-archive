import { ArrowUpRight, Check, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type ReaderBridgeStatus } from "../../lib/api";
import { FolioToggleRow } from "../folio/ui/FolioPrimitives";

export function ReaderBridgeControl({ workId }: { workId: number }) {
  const [status, setStatus] = useState<ReaderBridgeStatus | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let alive = true, timer = 0;
    async function load() {
      if (!alive) return;
      if (document.hidden || document.querySelector<HTMLElement>(".app-route-archive")?.inert) { timer = window.setTimeout(load, 2000); return; }
      try {
        const value = await api.readerBridge(workId);
        if (!alive) return;
        setStatus(value); setError("");
        if (value.job && ["queued", "running", "paused", "cancelling"].includes(value.job.status)) timer = window.setTimeout(load, 2000);
      } catch (reason) { if (alive) setError(reason instanceof Error ? reason.message : String(reason)); }
    }
    void load();
    return () => { alive = false; window.clearTimeout(timer); };
  }, [workId, revision]);
  async function verify() {
    setBusy(true); setError("");
    try { await api.verifyReaderBridge(workId); setRevision(value => value + 1); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  }
  if (!status || status.status === "unavailable") return error ? <p className="folio-scrape-error" role="alert">{error}</p> : null;
  const active = status.job && ["queued", "running", "paused", "cancelling"].includes(status.job.status);
  return <details className="folio-reader-bridge">
    <summary>双来源阅读<span>{status.eligible ? "已核验" : active ? "核验中" : !status.enabled ? "已停用" : "仅本地"}</span></summary>
    <FolioToggleRow label="允许远端过渡" copy="本地文件准备期间，先读取已逐页核验一致的远端页面。" checked={status.enabled} onChange={enabled => {
      void api.enableReaderBridge(workId, enabled).then(setStatus).catch(reason => setError(reason.message));
    }} />
    <div className="folio-reader-bridge-actions">{status.eligible ? <p><Check size={16} />{status.pages.length} 页核验一致</p> : active ? <p>{status.job!.status === "paused" ? "核验已暂停" : "正在核验"} · {status.job!.progress.current}/{status.job!.progress.total}</p> : <button type="button" disabled={busy} onClick={() => void verify()}><RefreshCw size={15} />逐页核验</button>}
      <a href="#tasks">队列<ArrowUpRight size={14} /></a>
    </div>
    {status.reason ? <p>{status.reason}</p> : null}
    {error ? <p className="folio-scrape-error" role="alert">{error}</p> : null}
  </details>;
}
