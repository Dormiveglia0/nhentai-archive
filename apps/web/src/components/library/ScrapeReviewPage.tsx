import { ArrowLeft, ArrowUpRight, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, type MediaLibrary, type ScrapeQueue, type ScrapeQueueItem } from "../../lib/api";
import { FolioSelect, FolioToggleRow } from "../folio/ui/FolioPrimitives";
import { IconPager } from "../folio/ui/IconPager";
import { ManualMetadataFields, METADATA_FIELDS } from "./ManualMetadataFields";
import { MetadataScrapePanel } from "./MetadataScrapePanel";
import "../settings/StorageSection.css";
import "./ScrapeReviewPage.css";

const STATES = { review: "待确认", error: "失败", pending: "等待", running: "处理中", completed: "已完成", ignored: "已跳过", all: "全部" };
function readFilters() {
  const p = new URLSearchParams(window.location.hash.split("?")[1]);
  return { status: Object.prototype.hasOwnProperty.call(STATES, p.get("status") ?? "") ? p.get("status")! : "review",
    libraryId: p.get("library_id") || "all", q: p.get("q") || "", page: Math.max(1, Number(p.get("page")) || 1) };
}

export function ScrapeReviewPage({ blurCovers }: { blurCovers: boolean }) {
  const [filters, setFilters] = useState(readFilters);
  const [draft, setDraft] = useState(filters.q);
  const [data, setData] = useState<ScrapeQueue | null>(null);
  const [libraries, setLibraries] = useState<MediaLibrary[]>([]);
  const [selected, setSelected] = useState<ScrapeQueueItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  busyRef.current = busy;
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => { setSelected(null); setRevision(value => value + 1); }, []);
  useEffect(() => {
    const sync = () => { if (!/^#scrape(?:\?|$)/.test(window.location.hash)) return; const next = readFilters(); setFilters(next); setDraft(next.q); setSelected(null); };
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  useEffect(() => {
    let alive = true;
    api.mediaLibraries().then(payload => { if (alive) setLibraries(payload.result); }).catch(reason => { if (alive) setError(reason.message); });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    let alive = true, timer = 0;
    setLoading(true);
    async function load() {
      if (!document.hidden && !busyRef.current) {
        try {
          const result = await api.scrapeQueue(filters.status, filters.libraryId, filters.q, filters.page);
          if (alive) { setData(result); setError(""); setLoading(false); }
        } catch (reason) { if (alive) { setError(reason instanceof Error ? reason.message : String(reason)); setLoading(false); } }
      }
      if (alive) timer = window.setTimeout(load, 3000);
    }
    void load();
    return () => { alive = false; window.clearTimeout(timer); };
  }, [filters.status, filters.libraryId, filters.q, filters.page, revision]);

  function change(next: Partial<typeof filters>) {
    const value = { ...filters, page: 1, ...next };
    const p = new URLSearchParams({ status: value.status, page: String(value.page) });
    if (value.libraryId !== 'all') p.set('library_id', value.libraryId);
    if (value.q) p.set('q', value.q);
    window.location.hash = `scrape?${p}`;
  }
  async function decide(action: 'retry' | 'dismiss') {
    if (!selected) return;
    setBusy(true); setError("");
    try { await api.scrapeDecision(selected.id, action, selected.version); reload(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  }
  return <section className="folio-page-body folio-scrape-review-page">
    <header className="folio-scrape-review-head"><h1>刮削审批</h1><div><a className="folio-line-button" href="#library"><ArrowLeft size={15} />我的库</a><a className="folio-line-button" href="#files?view=libraries">媒体库<ArrowUpRight size={15} /></a><button type="button" className="folio-line-button" aria-label="刷新刮削列表" disabled={busy} onClick={reload}><RefreshCw size={15} /></button></div></header>
    <div className="folio-scrape-review-filters">
      <form onSubmit={event => { event.preventDefault(); change({ q: draft.trim() }); }}><input aria-label="搜索待刮削作品" placeholder="搜索作品或文件名" value={draft} onChange={event => setDraft(event.target.value)} maxLength={240} /><button className="folio-line-button" type="submit" disabled={busy}><Search size={15} />搜索</button></form>
      <FolioSelect label="媒体库" value={filters.libraryId} disabled={busy} onChange={libraryId => change({ libraryId })} options={[{ value: 'all', label: '全部媒体库' }, ...libraries.map(library => ({ value: String(library.id), label: library.name }))]} />
      <FolioSelect label="状态" value={filters.status} disabled={busy} onChange={status => change({ status })} options={Object.entries(STATES).map(([value, label]) => ({ value, label }))} />
    </div>
    <div className="folio-scrape-review-counts" aria-label="刮削统计">{Object.entries(STATES).filter(([state]) => state !== 'all').map(([state, label]) => <button key={state} type="button" className={filters.status === state ? 'is-active' : ''} disabled={busy} onClick={() => change({ status: state })}><span>{label}</span><strong>{data?.counts[state] ?? 0}</strong></button>)}</div>
    {data?.remote.cooldown_active ? <p className="folio-media-hint" role="status">远端请求冷却中，约 {data.remote.cooldown_remaining_seconds} 秒后继续。等待中的自动刮削会让出请求额度。</p> : null}
    {error ? <p className="folio-media-error" role="alert">{error}</p> : null}
    <div className="folio-scrape-review-layout">
      <section className="folio-scrape-review-list" aria-label="刮削作品清单" aria-busy={loading}>
        <header><h2>{STATES[filters.status as keyof typeof STATES]}</h2><span>{loading ? '读取中…' : `${data?.total ?? 0} 条`}</span></header>
        {data?.result.map(row => <button key={row.id} type="button" className={selected?.id === row.id ? 'is-selected' : ''} aria-pressed={selected?.id === row.id} disabled={busy} onClick={() => {
          setSelected(row);
          if (window.matchMedia('(max-width: 760px)').matches) requestAnimationFrame(() => document.querySelector('.folio-scrape-review-detail')?.scrollIntoView({ block: 'start' }));
        }}><strong>{row.pretty_title || row.title_japanese || row.title}</strong><span>{row.library_name} · {row.page_count} 页 · {STATES[row.scrape_status as keyof typeof STATES] ?? row.scrape_status}</span><small>{row.relative_path}</small>{row.result.reason ? <p>{row.result.reason}</p> : null}{row.scrape_retry_at * 1000 > Date.now() ? <small>下次重试 {new Date(row.scrape_retry_at * 1000).toLocaleString()}</small> : null}</button>)}
        {!loading && !data?.result.length ? <p className="folio-media-hint">没有{STATES[filters.status as keyof typeof STATES]}记录</p> : null}
        <IconPager className="folio-files-pager" page={filters.page} totalPages={Math.max(1, Math.ceil((data?.total ?? 0) / (data?.per_page ?? 20)))} loading={loading || busy} onPage={page => change({ page })} />
      </section>
      <section className="folio-scrape-review-detail" aria-label="刮削审批详情">
        {selected ? <><ReviewEditor key={selected.id} item={selected} blurCovers={blurCovers} onBusy={setBusy} onSaved={reload} />
          <footer><button type="button" className="folio-line-button" disabled={busy || selected.scrape_status === 'running'} onClick={() => void decide('dismiss')}>跳过</button><button type="button" className="folio-line-button" disabled={busy || !selected.enabled || !selected.auto_scrape || selected.scrape_status === 'running'} onClick={() => void decide('retry')}>重试</button><a className="folio-settings-mini-action" href={`#governance/${selected.work_id}`}>完整编辑<ArrowUpRight size={14} /></a></footer>
        </> : <p className="folio-media-hint">选择作品，查看匹配候选或手动填写元数据。</p>}
      </section>
    </div>
  </section>;
}

function ReviewEditor({ item, blurCovers, onBusy, onSaved }: { item: ScrapeQueueItem; blurCovers: boolean; onBusy: (busy: boolean) => void; onSaved: () => void }) {
  const [mode, setMode] = useState('remote');
  const [bind, setBind] = useState(item.auto_bind);
  const [busy, setBusy] = useState(false);
  const [metadata, setMetadata] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (mode !== 'manual' || metadata) return;
    let alive = true;
    api.workGovernance(item.work_id).then(result => { if (alive) setMetadata(Object.fromEntries(result.metadata.fields.map(field => [field.field, field.working_value ?? field.current_value ?? '']))); }).catch(reason => { if (alive) setError(reason.message); });
    return () => { alive = false; };
  }, [mode, item.work_id, metadata]);
  function changeBusy(value: boolean) { setBusy(value); onBusy(value); }
  async function save() {
    if (!metadata) return;
    changeBusy(true); setError('');
    try {
      await api.applyWorkGovernance(item.work_id, { review_item_id: item.id, review_version: item.version,
        metadata: METADATA_FIELDS.map(([field]) => ({ field, value: metadata[field] || '', source: 'manual' })) });
      onSaved();
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { changeBusy(false); }
  }
  return <><header><h2>{item.pretty_title || item.title_japanese || item.title}</h2><p>{item.library_name} · {item.relative_path}</p></header>
    <div className="folio-choice-row" role="group" aria-label="审批方式"><button type="button" className={mode === 'remote' ? 'is-selected' : ''} aria-pressed={mode === 'remote'} disabled={busy} onClick={() => setMode('remote')}>远端匹配</button><button type="button" className={mode === 'manual' ? 'is-selected' : ''} aria-pressed={mode === 'manual'} disabled={busy} onClick={() => setMode('manual')}>手动编辑</button></div>
    {error ? <p className="folio-media-error" role="alert">{error}</p> : null}
    <div hidden={mode !== 'remote'}>
      <fieldset disabled={busy} className="folio-scrape-review-bind"><FolioToggleRow label="绑定远端作品" copy="关闭时只应用元数据。" checked={bind} onChange={setBind} /></fieldset>
      <MetadataScrapePanel embedded itemId={item.id} workId={item.work_id} title={item.title} blurCovers={blurCovers} bind={bind} onBusyChange={changeBusy} onClose={() => {}} onApplied={onSaved} initialPreview={{ work: { id: item.work_id, title: item.title, source: item.source, remote_gallery_id: item.remote_gallery_id ?? undefined, page_count: item.page_count }, version: item.version, query: item.title, config: item.config, match: item.result.candidates?.[0] ?? null, candidates: item.result.candidates ?? [], reason: item.result.reason }} />
    </div>
    {mode === 'manual' ? metadata ? <form onSubmit={event => { event.preventDefault(); void save(); }}><ManualMetadataFields values={metadata} onChange={setMetadata} disabled={busy} /><button type="submit" className="folio-line-button is-primary" disabled={busy}>{busy ? '保存中…' : '保存并完成'}</button></form> : <p className="folio-media-hint">正在读取元数据…</p> : null}
  </>;
}
