import { AlertTriangle, Check, Image, Search, SearchX, Shuffle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api, type MetadataRefreshMatch, type MetadataRefreshPreview } from "../../lib/api";
import { useNativeDialog } from "../../lib/useNativeDialog";
import { ReaderBridgeControl } from "./ReaderBridgeControl";
import "./MetadataScrapePanel.css";

type Props = { workId: number; itemId?: number; title: string; blurCovers: boolean; onApplied: () => void; onClose: () => void; embedded?: boolean; showBridge?: boolean; autoSearch?: boolean; bind?: boolean; onBusyChange?: (busy: boolean) => void; initialPreview?: MetadataRefreshPreview["result"][number] };

export function MetadataScrapePanel({ workId, itemId, title, blurCovers, onApplied, onClose, embedded = false, showBridge = !embedded, autoSearch = false, bind, onBusyChange, initialPreview }: Props) {
  const [query, setQuery] = useState(title);
  const [preview, setPreview] = useState<MetadataRefreshPreview["result"][number] | null>(initialPreview ?? null);
  const [chosen, setChosen] = useState<MetadataRefreshMatch | null>(initialPreview?.match ?? null);
  const [busy, setBusy] = useState(false);
  const [searchMode, setSearchMode] = useState<"cover" | "page" | undefined>();
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const revision = useRef(0);
  const busyCallback = useRef(onBusyChange);
  busyCallback.current = onBusyChange;
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => { revision.current++; busyCallback.current?.(false); };
  }, []);
  const dismiss = useNativeDialog(dialog, onClose, !embedded, applying);

  async function search(mode?: "cover" | "page") {
    if (busy || (!mode && !query.trim())) return;
    const current = ++revision.current;
    onBusyChange?.(true);
    setBusy(true); setSearchMode(mode); setError(""); setNotice(""); setPreview(null); setChosen(null);
    try {
      const payload = await api.metadataRefreshPreview([workId], {}, mode ? {} : { [workId]: query.trim() }, bind, itemId ? { [workId]: itemId } : {}, mode);
      if (current !== revision.current) return;
      const row = payload.result[0];
      setPreview(row); setChosen(row.match);
    } catch (exception) {
      if (current === revision.current) setError(exception instanceof Error ? exception.message : String(exception));
    } finally { if (current === revision.current) { setBusy(false); onBusyChange?.(false); } }
  }

  useEffect(() => { if (autoSearch) void search(); }, [autoSearch, workId, bind]);

  async function apply() {
    if (!chosen || !preview || chosen.selectable === false) return;
    const current = ++revision.current;
    onBusyChange?.(true); setBusy(true); setApplying(true); setError(""); setNotice("");
    try {
      const result = await api.metadataRefreshApply([{ ...chosen, source: "manual_id", work_id: workId, item_id: itemId, version: preview.version, bind }]);
      if (current !== revision.current) return;
      const row = result.result[0];
      if (row?.status !== "updated") throw new Error(row?.reason || "更新失败，请重新搜索");
      setNotice("元数据已更新"); setPreview(null); setChosen(null); onApplied();
    } catch (exception) {
      if (current === revision.current) setError(exception instanceof Error ? exception.message : String(exception));
    } finally { if (current === revision.current) { setBusy(false); setApplying(false); onBusyChange?.(false); } }
  }

  const content = <>
    <header className="folio-scrape-heading">
      <div><h3>{embedded ? "匹配远端作品" : "刮削元数据"}</h3><p>查找作品后核对字段差异，确认后再应用。</p></div>
      {!embedded ? <button type="button" aria-label="关闭刮削" disabled={applying} onClick={dismiss}><X size={18} /></button> : null}
    </header>
    <form className="folio-scrape-search" onSubmit={event => { event.preventDefault(); event.stopPropagation(); void search(); }}>
      <label><span>作品名称或 ID</span><input ref={input} data-dialog-focus={!embedded || undefined} autoFocus={!embedded} placeholder="输入标题、作者关键词或远端 ID" maxLength={240} value={query} disabled={busy}
        onChange={event => { revision.current++; setQuery(event.target.value); setPreview(null); setChosen(null); setError(""); setNotice(""); }} /></label>
      <button type="submit" disabled={busy || !query.trim()}><Search size={16} />{busy && !applying ? "搜索中" : "搜索"}</button>
    </form>
    <div className="folio-scrape-image-search">
      <div className="folio-scrape-image-actions">
        <button type="button" disabled={busy} onClick={() => void search("cover")}><Image size={16} />封面搜图</button>
        <button type="button" disabled={busy} onClick={() => void search("page")}><Shuffle size={16} />随机内页</button>
      </div>
      <p>搜图会将一张压缩图片发送至 soutubot.moe，用于查找 nhentai 作品。</p>
    </div>
    {error ? <p className="folio-scrape-message folio-scrape-error" role="alert"><AlertTriangle size={16} />{error}</p> : null}
    <div className="folio-scrape-status" role="status" aria-live="polite">
      {notice ? <p className="folio-scrape-message"><Check size={16} />{notice}</p> : busy ? <p className="folio-scrape-message is-loading">{applying ? "正在应用元数据…" : searchMode ? "正在搜图并核对作品…" : "正在查找远端作品…"}</p> : null}
    </div>
    {preview ? <>
      {preview.candidates.length ? <div className="folio-scrape-results">
        <section className="folio-scrape-matches" aria-label="匹配候选">
          <div className="folio-scrape-section-head"><h4>候选作品</h4><span>{preview.candidates.length} 部</span></div>
          <div className="folio-scrape-candidates">
          {preview.candidates.map(candidate => <button type="button" key={candidate.gallery_id} aria-pressed={chosen?.gallery_id === candidate.gallery_id}
            disabled={busy} onClick={() => { setChosen(candidate); setError(""); }}>
            <span className="folio-scrape-candidate-cover">{candidate.thumbnail_url ? <img src={candidate.thumbnail_url} alt="" loading="lazy" decoding="async" className={blurCovers ? "folio-media-blurred" : undefined} /> : <Search size={18} />}</span>
            <span className="folio-scrape-candidate-copy"><strong title={candidate.title_japanese || candidate.title}>{candidate.title_japanese || candidate.title}</strong><span>#{candidate.gallery_id} · {candidate.page_count} 页</span><small>标题 {candidate.evidence?.title_score ?? candidate.confidence}% · 封面{candidate.cover?.score != null ? ` ${candidate.cover.score}%` : "未检测"}</small></span>
            <span className="folio-scrape-candidate-check" aria-hidden="true">{chosen?.gallery_id === candidate.gallery_id ? <Check size={15} /> : null}</span>
          </button>)}
          </div>
        </section>
        {chosen ? <section className="folio-scrape-comparison" aria-label="元数据对比">
          <div className="folio-scrape-section-head"><h4>核对字段</h4><span>{chosen.diffs?.filter(diff => diff.changed).length ?? 0} 项差异</span></div>
          <p className="folio-scrape-note">{chosen.cover?.score != null ? `封面相似度 ${chosen.cover.score}%${chosen.cover.ratio_match === false ? " · 图片比例不同" : ""}，请结合标题、语言和页数核对版本。` : chosen.cover?.reason || "尚未进行封面比对，可重新搜索。"}</p>
          {chosen.image_search ? <p className="folio-scrape-note">SoutuBot 得分 {chosen.image_search.score} · {chosen.image_search.sample_page ? `抽取第 ${chosen.image_search.sample_page} 页` : "封面搜图"} · {chosen.image_search.verified ? "两张内页核对通过" : "内页核对未通过，请人工确认"}</p> : null}
          {chosen.diffs?.some(diff => diff.changed) ? <DiffTable diffs={chosen.diffs.filter(diff => diff.changed)} />
            : <p className="folio-scrape-message"><Check size={16} />字段已一致</p>}
          {chosen.diffs?.some(diff => !diff.changed) ? <details key={chosen.gallery_id}>
            <summary>一致字段 · {chosen.diffs.filter(diff => !diff.changed).length}</summary>
            <DiffTable diffs={chosen.diffs.filter(diff => !diff.changed)} />
          </details> : null}
          {chosen.reason ? <p className="folio-scrape-note">{chosen.reason}</p> : null}
          {chosen.diffs?.some(diff => diff.field === "pages" && diff.changed) ? <p className="folio-scrape-note">页数不一致，将保留本地阅读并停用远端过渡。</p> : null}
          <footer className="folio-scrape-confirm">
            <p>{(bind ?? preview.config.auto_bind) ? `应用后绑定远端 #${chosen.gallery_id}` : "仅更新元数据"}</p>
            <button className="is-primary" type="button" disabled={busy || chosen.selectable === false} onClick={() => void apply()}>
              <Check size={16} />{applying ? "应用中" : (bind ?? preview.config.auto_bind) ? "确认应用并绑定" : "确认应用元数据"}
            </button>
          </footer>
        </section> : null}
      </div> : <div className="folio-scrape-empty" role="status"><SearchX size={25} /><div><strong>没有匹配的作品</strong><p>{preview.reason || "尝试缩短标题、调整关键词，或直接输入远端 ID。"}</p></div></div>}
    </> : null}
    {showBridge ? <ReaderBridgeControl key={notice} workId={workId} /> : null}
  </>;
  return embedded ? <section className="folio-scrape folio-scrape-embedded" aria-busy={busy}>{content}</section> : createPortal(<dialog ref={dialog} className="folio-scrape" aria-label="刮削元数据" aria-busy={busy}>{content}</dialog>, document.querySelector(".folio") ?? document.body);
}

function DiffTable({ diffs }: { diffs: NonNullable<MetadataRefreshMatch["diffs"]> }) {
  return <table><thead><tr><th>字段</th><th>本地</th><th>远端</th></tr></thead><tbody>
    {diffs.map(diff => <tr key={diff.field} data-changed={diff.changed || undefined} data-protected={diff.protected || undefined}>
      <th>{diff.label}{diff.protected ? <span title="保留本地人工配置">保留</span> : null}</th>
      <td data-label="本地">{diff.local || "—"}</td><td data-label="远端">{diff.remote || "—"}</td>
    </tr>)}
  </tbody></table>;
}
