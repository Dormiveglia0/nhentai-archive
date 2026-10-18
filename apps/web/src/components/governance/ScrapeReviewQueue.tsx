import { ArrowUpRight, PenLine, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, type GovernanceAggregate, type MediaLibrary, type ScrapeQueue, type ScrapeQueueItem } from "../../lib/api";
import { FolioSelect, FolioToggleRow } from "../folio/ui/FolioPrimitives";
import { IconPager } from "../folio/ui/IconPager";
import { MetadataScrapePanel } from "../library/MetadataScrapePanel";
import { GovernanceWorkHeader } from "./GovernanceWorkHeader";
import { MetadataCard } from "./MetadataEditor";
import { buildInitialEdits, normalize, type FieldEdit } from "./governanceHelpers";
import "../settings/StorageSection.css";
import "./ScrapeReviewQueue.css";

const STATES = { review: "待确认", error: "失败", pending: "等待", running: "处理中", completed: "已完成", ignored: "已跳过", all: "全部" };
function readFilters() {
  const p = new URLSearchParams(window.location.hash.split("?")[1]);
  return { status: Object.prototype.hasOwnProperty.call(STATES, p.get("status") ?? "") ? p.get("status")! : "review",
    libraryId: p.get("library_id") || "all", q: p.get("q") || "", page: Math.max(1, Number(p.get("page")) || 1) };
}

export function ScrapeReviewQueue({ blurCovers }: { blurCovers: boolean }) {
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
    const sync = () => { if (!/^#(?:scrape|governance)(?:\?|$)/.test(window.location.hash)) return; const next = readFilters(); setFilters(next); setDraft(next.q); setSelected(null); };
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
    const p = new URLSearchParams({ view: 'scrape', status: value.status, page: String(value.page) });
    if (value.libraryId !== 'all') p.set('library_id', value.libraryId);
    if (value.q) p.set('q', value.q);
    window.location.hash = `governance?${p}`;
  }
  return <section className="folio-scrape-review-page" aria-label="刮削审批">
    <header className="folio-scrape-review-head"><p>核对匹配结果，或手动整理作品信息。</p><div><a className="folio-line-button" href="#files?view=libraries">媒体库<ArrowUpRight size={15} /></a><button type="button" className="folio-line-button" aria-label="刷新刮削列表" disabled={busy} onClick={reload}><RefreshCw size={15} /></button></div></header>
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
        {selected ? <ReviewEditor key={selected.id} item={selected} blurCovers={blurCovers} onBusy={setBusy} onSaved={() => setRevision(value => value + 1)} onDecided={reload} />
          : <p className="folio-media-hint">选择作品，查看匹配候选或手动填写元数据。</p>}
      </section>
    </div>
  </section>;
}

function ReviewEditor({ item, blurCovers, onBusy, onSaved, onDecided }: { item: ScrapeQueueItem; blurCovers: boolean; onBusy: (busy: boolean) => void; onSaved: () => void; onDecided: () => void }) {
  const [mode, setMode] = useState('remote');
  const [bind, setBind] = useState(item.auto_bind);
  const [busy, setBusy] = useState(false);
  const [scrapeBusy, setScrapeBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [aggregate, setAggregate] = useState<GovernanceAggregate | null>(null);
  const [edits, setEdits] = useState<Record<string, FieldEdit>>({});
  const [version, setVersion] = useState(item.version);
  const [status, setStatus] = useState(item.scrape_status);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const locked = busy || scrapeBusy || loading;
  const changed = aggregate?.metadata.fields.filter(field => edits[field.field] &&
    (normalize(edits[field.field].value) !== normalize(field.working_value) || edits[field.field].source !== field.working_source)) ?? [];
  useEffect(() => { onBusy(locked); return () => onBusy(false); }, [locked, onBusy]);
  useEffect(() => {
    let alive = true;
    api.workGovernance(item.work_id).then(result => {
      if (alive) { setAggregate(result); setEdits(buildInitialEdits(result.metadata.fields)); }
    }).catch(reason => { if (alive) setError(reason.message); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [item.work_id]);
  async function saved() {
    setBusy(true); setError(''); setNotice('已保存，审批完成。');
    try {
      // 先读版本，避免给较旧的字段套上并发修改后的新版本。
      const context = await api.scrapeContext(item.id);
      const result = await api.workGovernance(item.work_id);
      setAggregate(result); setEdits(buildInitialEdits(result.metadata.fields)); setVersion(context.version); setStatus('completed'); onSaved();
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!aggregate || locked) return;
    if (!edits.title?.value.trim()) { setError('请填写作品标题'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      await api.applyWorkGovernance(item.work_id, { review_item_id: item.id, review_version: version,
        metadata: changed.map(field => ({ field: field.field, ...edits[field.field] })) });
      await saved();
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  }
  async function decide(action: 'retry' | 'dismiss') {
    if (locked) return;
    setBusy(true); setError('');
    try { await api.scrapeDecision(item.id, action, version); onDecided(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  }
  return <>
    {loading ? <p className="folio-governance-loading" role="status">正在读取作品信息…</p> : null}
    {aggregate ? <><GovernanceWorkHeader aggregate={aggregate} blurCovers={blurCovers} />
      <p className="folio-scrape-review-location">{item.library_name} · {aggregate.work.page_count} 页<span>{item.relative_path}</span></p>
      {aggregate.remote ? <section className="folio-scrape-review-remote" aria-label="已绑定的远端信息">
        <header><strong>远端绑定 #{aggregate.remote.gallery_id}</strong><a href={`#gallery/${aggregate.remote.gallery_id}`} className="folio-settings-mini-action">远端详情<ArrowUpRight size={14} /></a></header>
        {aggregate.remote.fields.some(field => field.value) ? <dl>{aggregate.remote.fields.filter(field => field.value).map(field => <div key={field.field} className={['title', 'title_japanese', 'tags', 'summary'].includes(field.field) ? 'is-wide' : undefined}><dt>{field.label}</dt><dd title={field.value ?? undefined}>{field.value}</dd></div>)}</dl>
          : <p className="folio-media-hint">暂无保存的远端资料，可打开远端详情查看。</p>}
      </section> : null}
    </> : null}
    <div className="folio-governance-metadata-modes folio-scrape-review-modes" role="group" aria-label="审批方式"><button type="button" aria-pressed={mode === 'remote'} disabled={locked} onClick={() => setMode('remote')}><Search size={15} />远端匹配</button><button type="button" aria-pressed={mode === 'manual'} disabled={locked} onClick={() => setMode('manual')}><PenLine size={15} />手动编辑</button></div>
    {error ? <p className="folio-media-error" role="alert">{error}</p> : null}
    {notice ? <p className="folio-scrape-review-notice" role="status">{notice}</p> : null}
    <div hidden={mode !== 'remote'}>
      {changed.length ? <p className="folio-governance-scrape-lock">请先保存或还原字段修改，再应用远端元数据。</p> : aggregate ? <>
        <fieldset disabled={locked} className="folio-scrape-review-bind"><FolioToggleRow label="绑定远端作品" copy="关闭时只应用元数据。" checked={bind} onChange={setBind} /></fieldset>
        <MetadataScrapePanel key={version} embedded itemId={item.id} workId={item.work_id} title={aggregate.work.title} blurCovers={blurCovers} bind={bind} onBusyChange={setScrapeBusy} onClose={() => {}} onApplied={() => void saved()} initialPreview={status === 'completed' ? undefined : { work: { id: item.work_id, title: item.title, source: item.source, remote_gallery_id: item.remote_gallery_id ?? undefined, page_count: item.page_count }, version, query: item.title, config: item.config, match: item.result.candidates?.[0] ?? null, candidates: item.result.candidates ?? [], reason: item.result.reason }} />
      </> : null}
    </div>
    {mode === 'manual' && aggregate ? <form onSubmit={event => { event.preventDefault(); void save(); }}>
      <fieldset disabled={locked} className="folio-governance-field-grid folio-scrape-review-fields">{aggregate.metadata.fields.map(field => <div key={field.field} className="folio-governance-field-cell"><MetadataCard field={field} edit={edits[field.field]} onChange={edit => setEdits(current => ({ ...current, [field.field]: edit }))} /></div>)}</fieldset>
      <button type="submit" className="folio-line-button is-primary" disabled={locked}>{busy ? '保存中…' : '保存并完成'}</button>
    </form> : null}
    <footer><button type="button" className="folio-line-button" disabled={locked || status === 'running'} onClick={() => void decide('dismiss')}>跳过</button><button type="button" className="folio-line-button" disabled={locked || !item.enabled || !item.auto_scrape || status === 'running'} onClick={() => void decide('retry')}>重试</button><a className="folio-settings-mini-action" href={`#governance/${item.work_id}`}>完整编辑<ArrowUpRight size={14} /></a></footer>
  </>;
}
