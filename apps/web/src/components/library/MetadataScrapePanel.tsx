import { Check, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api, type MetadataRefreshMatch, type MetadataRefreshPreview } from "../../lib/api";
import { useNativeDialog } from "../../lib/useNativeDialog";
import "./MetadataScrapePanel.css";

type Props = { workId: number; title: string; blurCovers: boolean; onApplied: () => void; onClose: () => void };

export function MetadataScrapePanel({ workId, title, blurCovers, onApplied, onClose }: Props) {
  const [query, setQuery] = useState(title);
  const [preview, setPreview] = useState<MetadataRefreshPreview["result"][number] | null>(null);
  const [chosen, setChosen] = useState<MetadataRefreshMatch | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const revision = useRef(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => { revision.current++; };
  }, []);
  const dismiss = useNativeDialog(dialog, onClose, true, busy);

  async function search() {
    const current = ++revision.current;
    setBusy(true); setError(""); setNotice(""); setPreview(null); setChosen(null);
    try {
      const payload = await api.metadataRefreshPreview([workId], {}, { [workId]: query.trim() });
      if (current !== revision.current) return;
      const row = payload.result[0];
      setPreview(row); setChosen(row.match);
    } catch (exception) {
      if (current === revision.current) setError(exception instanceof Error ? exception.message : String(exception));
    } finally { if (current === revision.current) setBusy(false); }
  }

  async function apply() {
    if (!chosen || !preview || chosen.selectable === false) return;
    const current = ++revision.current;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await api.metadataRefreshApply([{ ...chosen, source: "manual_id", work_id: workId, version: preview.version }]);
      if (current !== revision.current) return;
      const row = result.result[0];
      if (row?.status !== "updated") throw new Error(row?.reason || "更新失败，请重新搜索");
      setNotice("元数据已更新"); setPreview(null); setChosen(null); onApplied();
    } catch (exception) {
      if (current === revision.current) setError(exception instanceof Error ? exception.message : String(exception));
    } finally { if (current === revision.current) setBusy(false); }
  }

  return createPortal(<dialog ref={dialog} className="folio-scrape" aria-label="刮削元数据" aria-busy={busy}>
    <header><h3>刮削元数据</h3><button type="button" aria-label="关闭刮削" disabled={busy} onClick={dismiss}><X size={18} /></button></header>
    <form onSubmit={event => { event.preventDefault(); void search(); }}>
      <input ref={input} autoFocus aria-label="作品名称或 ID" placeholder="作品名称或 ID" maxLength={240} value={query} disabled={busy}
        onChange={event => { revision.current++; setQuery(event.target.value); setPreview(null); setChosen(null); setError(""); setNotice(""); }} />
      <button type="submit" disabled={busy || !query.trim()}><Search size={16} />{busy ? "处理中" : "搜索"}</button>
    </form>
    {error ? <p className="folio-scrape-error" role="alert">{error}</p> : null}
    {notice ? <p role="status"><Check size={16} />{notice}</p> : null}
    {preview ? <>
      {preview.candidates.length ? <div className="folio-scrape-results">
        <div className="folio-scrape-candidates" aria-label="匹配候选">
          {preview.candidates.map(candidate => <button type="button" key={candidate.gallery_id} aria-pressed={chosen?.gallery_id === candidate.gallery_id}
            disabled={busy} onClick={() => { setChosen(candidate); setError(""); }}>
            {candidate.thumbnail_url ? <img src={candidate.thumbnail_url} alt="" loading="lazy" decoding="async" style={blurCovers ? { filter: "blur(12px)" } : undefined} /> : null}
            <span><strong>{candidate.title_japanese || candidate.title}</strong><span>#{candidate.gallery_id} · {candidate.page_count} 页 · {candidate.confidence}%</span></span>
            {chosen?.gallery_id === candidate.gallery_id ? <Check size={15} /> : null}
          </button>)}
        </div>
        {chosen ? <div className="folio-scrape-comparison">
          {chosen.diffs?.some(diff => diff.changed) ? <DiffTable diffs={chosen.diffs.filter(diff => diff.changed)} />
            : <p>字段已一致</p>}
          {chosen.diffs?.some(diff => !diff.changed) ? <details key={chosen.gallery_id}>
            <summary>一致字段 · {chosen.diffs.filter(diff => !diff.changed).length}</summary>
            <DiffTable diffs={chosen.diffs.filter(diff => !diff.changed)} />
          </details> : null}
          {chosen.reason ? <p>{chosen.reason}</p> : null}
          <button className="is-primary" type="button" disabled={busy || chosen.selectable === false} onClick={() => void apply()}>
            <Check size={16} />{preview.config.auto_bind ? "确认应用并绑定" : "确认应用元数据"}
          </button>
        </div> : null}
      </div> : <p role="status">{preview.reason || "没有匹配的作品"}</p>}
    </> : null}
  </dialog>, document.querySelector(".folio") ?? document.body);
}

function DiffTable({ diffs }: { diffs: NonNullable<MetadataRefreshMatch["diffs"]> }) {
  return <table><thead><tr><th>字段</th><th>本地</th><th>远端</th></tr></thead><tbody>
    {diffs.map(diff => <tr key={diff.field} data-changed={diff.changed || undefined}>
      <th>{diff.label}{diff.protected ? <span>保留</span> : null}</th>
      <td data-label="本地">{diff.local || "—"}</td><td data-label="远端">{diff.remote || "—"}</td>
    </tr>)}
  </tbody></table>;
}
