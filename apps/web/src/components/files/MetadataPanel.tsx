import { ArrowUpRight, Database, Download, FileSearch, FileWarning, Link2Off, RefreshCw, Trash2, WifiOff, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { api, type ArchiveMetadata, type MediaLibrary, type MetadataDeletePreview, type MetadataDetail, type MetadataEntry, type MetadataInventory, type MetadataStatus, type MetadataTarget } from "../../lib/api";
import { formatBytes, parseUtcTimestamp } from "../../lib/format";
import { useNativeDialog } from "../../lib/useNativeDialog";
import { pageHref } from "../../lib/navigation";
import { IconPager } from "../folio/ui/IconPager";
import { FolioMetricGrid } from "../folio/ui/FolioMetricGrid";
import { FolioSearchField, FolioSelect } from "../folio/ui/FolioPrimitives";
import "./MetadataPanel.css";

export const METADATA_STATUS: Record<MetadataStatus, string> = {
  ready: "正常关联", missing: "源文件缺失", offline: "媒体库离线", detached: "库已移除", pending: "待重新检查",
};
const STATUSES = [
  { value: "all", label: "全部状态" }, ...Object.entries(METADATA_STATUS).map(([value, label]) => ({ value, label })),
  { value: "unlinked", label: "未关联作品" }, { value: "partial_missing", label: "部分来源失效" },
];
const COUNT_LABELS: Record<string, string> = {
  work_pages: "页面记录", manifest_pages: "归档页面索引", work_tags: "标签关联", work_metadata: "保存字段",
  reading_history: "阅读历史", reading_sessions: "阅读会话", governance_reviews: "整理记录",
  library_items: "扫描索引", work_files: "文件关联",
};
const FIELD_LABELS: Record<string, string> = {
  id: "记录编号", library_id: "媒体库编号", work_id: "关联作品", relative_path: "原相对路径",
  size_bytes: "原文件大小", source_status: "扫描状态", last_error: "最近错误", missing_since: "首次发现缺失",
  indexed_at: "索引建立时间", updated_at: "更新时间", created_at: "创建时间", library_name: "媒体库",
  root_path: "媒体库根目录", health: "库可用状态", removed_at: "媒体库移除时间", manifest_bytes: "压缩页面目录大小",
  title: "原始标题", title_japanese: "日文标题", pretty_title: "显示标题", language: "语言", page_count: "页数",
  source: "作品来源", remote: "远端来源", remote_gallery_id: "远端作品编号", metadata_gallery_id: "元数据作品编号",
  metadata_match_source: "匹配来源", metadata_match_score: "匹配分数", favorite: "收藏", cover_path: "封面路径", media_id: "远端媒体编号",
};

export function MetadataPanel() {
  const readFilter = () => {
    const params = new URLSearchParams(window.location.hash.split("?")[1]);
    return { status: params.get("status") ?? "all", library: params.get("library_id") ?? "", work: params.get("work_id") ?? "" };
  };
  const [filter, setFilter] = useState(readFilter);
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [inventory, setInventory] = useState<MetadataInventory | null>(null);
  const [libraries, setLibraries] = useState<MediaLibrary[]>([]);
  const [focus, setFocus] = useState<MetadataEntry | null>(null);
  const [preview, setPreview] = useState<MetadataDeletePreview | null>(null);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const update = () => { setFilter(readFilter()); setPage(1); };
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => { setQ(query.trim()); setPage(1); }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    let alive = true;
    setLoading(true); setError("");
    Promise.all([api.localMetadata({ status: filter.status, library_id: filter.library, work_id: filter.work, q, page }), api.mediaLibraries(true)])
      .then(([data, media]) => { if (alive) {
        const lastPage = Math.max(1, Math.ceil(data.total / data.per_page));
        if (page > lastPage) { setPage(lastPage); return; }
        setInventory(data); setLibraries(media.result);
      } })
      .catch(exc => { if (alive) setError(exc.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [filter, q, page, revision]);
  function changeFilter(next: typeof filter) {
    setFilter(next); setPage(1);
    const params = new URLSearchParams({ view: "metadata" });
    if (next.status !== "all") params.set("status", next.status);
    if (next.library) params.set("library_id", next.library);
    if (next.work) params.set("work_id", next.work);
    window.history.replaceState(null, "", "#files?" + params);
  }
  async function prepare(target: MetadataTarget) {
    setBusy(true); setError("");
    try { setPreview(await api.previewMetadataDelete(target)); }
    catch (exc) { setError(exc instanceof Error ? exc.message : String(exc)); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!preview?.allowed) return;
    setBusy(true); setError("");
    try {
      const result = await api.deleteMetadata({ kind: preview.kind, id: preview.id });
      setNotice(`已清理本地元数据，回收 ${formatBytes(result.reclaimed_bytes)}。源文件和扫描日志未删除。`);
      if (preview.kind !== "source" && preview.kind === focus?.kind && preview.id === focus.id) setFocus(null);
      setPreview(null); setRevision(value => value + 1);
    } catch (exc) { setError(exc instanceof Error ? exc.message : String(exc)); }
    finally { setBusy(false); }
  }
  const summary = inventory?.summary;
  return <section className="folio-metadata" aria-label="本地元数据管理">
    <header className="folio-data-heading"><div><h2>本地元数据</h2><p>作品资料与扫描索引保存在应用数据库中；删除媒体文件不会自动删除这些资料。</p></div><button className="folio-line-button" aria-label="刷新元数据列表" type="button" disabled={loading || busy} onClick={() => setRevision(value => value + 1)}><RefreshCw size={16} />刷新</button></header>
    <FolioMetricGrid ariaLabel="元数据状态概览" className="folio-files-summary" items={[
      { label: "作品元数据", value: summary?.works ?? "—", icon: Database },
      { label: "未关联作品", value: summary?.unlinked ?? "—", icon: Link2Off, detail: <button type="button" onClick={() => changeFilter({ ...filter, status: "unlinked" })}>查看扫描元数据<ArrowUpRight size={12} /></button> },
      { label: "缺失来源", value: summary?.missing ?? "—", icon: FileWarning, tone: summary?.missing ? "danger" : "good", detail: <button type="button" onClick={() => changeFilter({ ...filter, status: "missing" })}>查看残留资料<ArrowUpRight size={12} /></button> },
      { label: "离线 / 已移除", value: summary ? summary.offline + summary.detached : "—", icon: WifiOff, detail: "离线不等于文件已删除" },
    ]} />
    <div className="folio-data-filters">
      <FolioSearchField value={query} onChange={setQuery} placeholder="搜索元数据标题、库名或原路径" />
      <FolioSelect label="元数据状态" value={filter.status} options={STATUSES} onChange={status => changeFilter({ ...filter, status })} />
      <FolioSelect label="来源媒体库" value={filter.library} options={[{ value: "", label: "全部媒体库" }, ...libraries.map(library => ({ value: String(library.id), label: library.name + (library.removed_at ? " · 已移除" : "") }))]} onChange={library => changeFilter({ ...filter, library })} />
    </div>
    {filter.work ? <p className="folio-data-footnote">正在查看作品 #{filter.work} 的资料。<button className="folio-line-button" type="button" onClick={() => changeFilter({ ...filter, work: "" })}>查看全部作品</button></p> : null}
    {error && !preview ? <p className="folio-media-error" role="alert">{error}</p> : null}
    {notice ? <p className="folio-data-notice" role="status">{notice}</p> : null}
    <div className="folio-data-list-head"><h3>元数据清单</h3><span>{loading ? "正在读取…" : `${inventory?.total ?? 0} 条资料`}</span></div>
    <ul className="folio-data-list" aria-busy={loading}>
      {inventory?.result.map(entry => <li key={`${entry.kind}-${entry.id}`} data-record={`${entry.kind}-${entry.id}`}>
        <div className="folio-data-record"><span className="folio-data-record-kind">{entry.kind === "work" ? "作品资料" : "扫描资料 · 无作品关联"}</span><strong className="folio-data-title">{entry.title}</strong><span className="folio-data-path">{entry.library_names.join(" / ") || "未关联媒体库"}</span><span className="folio-data-path">{entry.paths[0] || "没有源文件关联"}</span></div>
        <div className="folio-data-record-state"><span className={`folio-data-status is-${entry.status}`}>{METADATA_STATUS[entry.status]}</span>{entry.partial_missing ? <small>部分旧来源已失效</small> : null}<small>{entry.kind === "work" ? `${entry.field_count} 个保存字段 · ${entry.tag_count} 个标签 · ${entry.page_count} 页` : `${entry.field_count} 个归档字段`}</small></div>
        <div className="folio-data-row-actions"><button className="folio-line-button" type="button" disabled={busy} onClick={() => setFocus(entry)}><FileSearch size={15} />查看元数据</button></div>
      </li>)}
    </ul>
    {!loading && !inventory?.result.length ? <p className="folio-data-empty">没有符合筛选条件的元数据。可切换状态或媒体库查看其他资料。</p> : null}
    <IconPager className="folio-files-pager" page={page} totalPages={Math.max(1, Math.ceil((inventory?.total ?? 0) / (inventory?.per_page ?? 50)))} loading={loading} onPage={setPage} />
    <p className="folio-data-footnote">存储位置：<code>{inventory?.database_path ?? "正在读取…"}</code>。本页管理保存的数据，不会删除扫描日志。</p>
    {focus ? <MetadataDetailDialog key={`${focus.kind}-${focus.id}`} entry={focus} libraries={libraries} revision={revision} busy={busy} onClose={() => setFocus(null)} onCleanup={prepare} onNotice={setNotice} /> : null}
    {preview ? <MetadataCleanupDialog preview={preview} busy={busy} error={error} onClose={() => setPreview(null)} onConfirm={remove} /> : null}
  </section>;
}

function MetadataDetailDialog({ entry, libraries, revision, busy, onClose, onCleanup, onNotice }: {
  entry: MetadataEntry; libraries: MediaLibrary[]; revision: number; busy: boolean;
  onClose: () => void; onCleanup: (target: MetadataTarget) => Promise<void>; onNotice: (message: string) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [detail, setDetail] = useState<MetadataDetail | null>(null);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const dismiss = useNativeDialog(dialogRef, onClose, true, busy || scanning);
  useEffect(() => {
    let alive = true; setError("");
    api.localMetadataDetail(entry.kind, entry.id).then(data => { if (alive) setDetail(data); })
      .catch(exc => { if (alive) setError(exc.message); });
    return () => { alive = false; };
  }, [entry.kind, entry.id, revision]);
  async function scan(libraryId: number) {
    setScanning(true); setError("");
    try { await api.enqueueLibraryScan(undefined, libraryId); onNotice("重新扫描已加入队列；完成后刷新元数据列表可查看恢复结果。"); onClose(); }
    catch (exc) { setError(exc instanceof Error ? exc.message : String(exc)); }
    finally { setScanning(false); }
  }
  function download() {
    if (!detail) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(detail, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `metadata-${entry.kind}-${entry.id}.json`; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return createPortal(<dialog ref={dialogRef} className="folio-media-editor folio-metadata-dialog" aria-labelledby="folio-metadata-title" aria-busy={!detail || busy || scanning}>
    <header><div><span>{entry.kind === "work" ? "作品元数据" : "扫描元数据"} · #{entry.id}</span><h2 id="folio-metadata-title" className="folio-data-title">{entry.title}</h2></div><button className="folio-media-icon-button" type="button" aria-label="关闭元数据详情" onClick={dismiss} disabled={busy || scanning} data-dialog-focus><X size={18} /></button></header>
    <div className="folio-metadata-body">
      <div className="folio-metadata-detail-actions"><span className={`folio-data-status is-${entry.status}`}>{METADATA_STATUS[entry.status]}</span><button className="folio-line-button" type="button" disabled={!detail || busy} onClick={download}><Download size={15} />导出 JSON</button>{entry.work_id ? <a className="folio-line-button" href={pageHref({ name: "governance", workId: entry.work_id })}>编辑作品资料<ArrowUpRight size={15} /></a> : null}</div>
      {error ? <p className="folio-media-error" role="alert">{error}</p> : null}
      {!detail ? <p>正在读取已保存的元数据…</p> : <>
        <section><h3>数据库内容</h3><p className="folio-data-footnote">{detail.database_path} · {entry.kind === "work" ? "works / work_metadata / work_tags" : "library_items"}</p><MetadataValues values={detail.record} /></section>
        {detail.fields.length ? <section><h3>保存字段与来源</h3><dl className="folio-metadata-values">{detail.fields.map(field => <div key={field.field}><dt>{field.field}<small>{field.source}</small></dt><dd>{field.value ?? "未保存"}{field.source_value ? <small>原值：{field.source_value}</small> : null}</dd></div>)}</dl></section> : null}
        {detail.tags.length ? <section><h3>标签关联 · {detail.tags.length}</h3><ul className="folio-metadata-tags">{detail.tags.map((tag, index) => <li key={index}><small>{tag.tag_type}</small><span>{tag.zh_name || tag.remote_name || tag.remote_slug}</span>{tag.zh_name && tag.remote_name ? <small>{tag.remote_name}</small> : null}</li>)}</ul></section> : null}
        <section><h3>来源关联与归档元数据</h3>{entry.kind === "item" ? <><p className="folio-data-footnote">此索引没有关联作品，但仍保存从归档读取的资料和页面目录，不是日志。</p><ArchiveFields metadata={detail.archive_metadata} /></> : detail.sources.length ? detail.sources.map(source => <div className="folio-metadata-source" key={source.id}><div><strong>{source.library_name || "本地导入"}</strong><span className={`folio-data-status is-${source.status}`}>{METADATA_STATUS[source.status]}</span></div><code className="folio-data-path">{source.path}</code><ArchiveFields metadata={source.archive_metadata} />{source.status === "missing" || source.status === "detached" ? <button className="folio-line-button" type="button" disabled={busy} onClick={() => void onCleanup({ kind: source.library_item_id ? "item" : "source", id: source.library_item_id ?? source.id })}>清理此失效关联</button> : null}</div>) : <p>没有源文件关联。数据库资料仍保留。</p>}</section>
        {entry.kind === "work" ? <section><h3>阅读资料与页面索引</h3><p>{detail.progress ? `阅读进度 ${detail.progress.progress_percent}% · 第 ${detail.progress.page_index} 页` : "没有保存的阅读进度"}</p><MetadataValues values={Object.fromEntries(Object.entries(detail.counts).map(([key, value]) => [COUNT_LABELS[key] || key, value]))} />{detail.manifest_errors?.map(error => <p role="alert" className="folio-media-error" key={error}>{error}</p>)}</section> : null}
        {entry.kind === "work" ? <section><h3>派生文件 · {detail.assets_total ?? detail.assets.length}</h3>{detail.assets.length ? <ul className="folio-metadata-assets">{detail.assets.map(asset => <li key={asset.id}><span className="folio-data-path">{asset.path}</span><span>{formatBytes(asset.size_bytes)}</span></li>)}</ul> : <p>没有关联的本地派生文件。</p>}{(detail.assets_total ?? 0) > detail.assets.length ? <p>这里显示前 {detail.assets.length} 个，完整清单可在派生文件页分页查看。</p> : null}<a className="folio-line-button" href={`#files?view=derived&work_id=${entry.id}`}>查看派生文件<ArrowUpRight size={15} /></a></section> : null}
      </>}
      <section className="folio-metadata-recovery"><h3>恢复或清理</h3><p>文件仍需要保留时，先恢复原路径或在媒体库中修正目录，再重新扫描。缺失索引会重新关联，作品资料和阅读进度不会因扫描被删除。</p><div className="folio-metadata-library-actions">{entry.library_ids.map(id => { const library = libraries.find(library => library.id === id); return <div key={id}><span>{library?.name}</span>{library?.enabled && !library.removed_at ? <button className="folio-line-button" type="button" disabled={busy || scanning} onClick={() => void scan(id)}><RefreshCw size={15} />重新扫描</button> : <a className="folio-line-button" href="#files" onClick={dismiss}>管理媒体库<ArrowUpRight size={15} /></a>}</div>; })}</div><p>确认不再需要这些资料后可预览清理影响。整部作品清理会移除标签、阅读记录和派生文件；源文件与扫描日志始终保留。</p></section>
    </div>
    <footer><button type="button" className="folio-line-button" onClick={dismiss} disabled={busy || scanning}>关闭</button><button className="folio-line-button is-danger" type="button" disabled={busy || scanning || !detail} onClick={() => void onCleanup({ kind: entry.kind, id: entry.id })}><Trash2 size={15} />预览元数据清理</button></footer>
  </dialog>, document.querySelector(".folio") ?? document.body);
}

function ArchiveFields({ metadata }: { metadata?: ArchiveMetadata }) {
  return <div className="folio-archive-fields"><h4>ComicInfo</h4>{metadata && Object.keys(metadata.comicinfo).length ? <MetadataValues values={metadata.comicinfo} /> : <p>没有保存 ComicInfo 字段。</p>}<h4>归档 JSON</h4>{metadata?.json && Object.keys(metadata.json).length ? <MetadataValues values={metadata.json} /> : <p>没有保存归档 JSON。</p>}</div>;
}

function MetadataValues({ values }: { values: Record<string, unknown> }) {
  function display(key: string, value: unknown) {
    if (value === null || value === "") return "未保存";
    if (key === "source_status") return METADATA_STATUS[value as MetadataStatus] ?? String(value);
    if (key === "health") return ({ online: "正常", offline: "离线", partial: "部分检查失败", removed: "已移除", unknown: "尚未检查" } as Record<string, string>)[String(value)] ?? String(value);
    if (key === "missing_since" && typeof value === "number") return new Date(value * 1000).toLocaleString();
    if (key.endsWith("_at") && typeof value === "string") return parseUtcTimestamp(value)?.toLocaleString() ?? value;
    if ((key === "size_bytes" || key === "manifest_bytes") && typeof value === "number") return formatBytes(value);
    if (key === "favorite") return value ? "已收藏" : "未收藏";
    return typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
  }
  return <dl className="folio-metadata-values">{Object.entries(values).map(([key, value]) => <div key={key}><dt>{FIELD_LABELS[key] || key}</dt><dd>{display(key, value)}</dd></div>)}</dl>;
}

function MetadataCleanupDialog({ preview, busy, error, onClose, onConfirm }: {
  preview: MetadataDeletePreview; busy: boolean; error: string; onClose: () => void; onConfirm: () => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dismiss = useNativeDialog(dialogRef, onClose, true, busy);
  return createPortal(<dialog ref={dialogRef} className="folio-media-editor folio-metadata-cleanup" aria-labelledby="folio-metadata-cleanup-title" aria-busy={busy}>
    <header><h2 id="folio-metadata-cleanup-title">元数据清理预览</h2></header>
    <div className="folio-metadata-body"><p className="folio-data-title">{preview.title}</p>{preview.allowed ? <><p>{preview.kind === "work" ? "将永久删除整部作品的本地资料及下列派生文件。" : "仅删除此扫描索引或旧文件关联；已关联作品的元数据与阅读进度仍保留。"}</p><MetadataValues values={Object.fromEntries(Object.entries(preview.counts).map(([key, value]) => [COUNT_LABELS[key] || key, value]))} />{preview.progress ? <p className="folio-media-error">包含阅读进度：{preview.progress.progress_percent}%，清理后不可恢复。</p> : null}<p>派生文件 {preview.files.length} 个 · 预计回收 {formatBytes(preview.reclaim_bytes)}</p>{preview.files.length ? <ul className="folio-metadata-assets">{preview.files.map(path => <li key={path}><code>{path}</code></li>)}</ul> : null}</> : <p>暂不可清理此元数据。</p>}{preview.warnings.map(warning => <p className="folio-media-error" key={warning}>{warning}</p>)}<p className="folio-metadata-preserved">源文件不删除 · 扫描日志不删除 · 不写入媒体库</p>{error ? <p role="alert" className="folio-media-error">{error}</p> : null}</div>
    <footer><button className="folio-line-button" type="button" onClick={dismiss} disabled={busy} data-dialog-focus>取消</button><button className="folio-line-button is-danger" type="button" disabled={busy || !preview.allowed} onClick={() => void onConfirm()}><Trash2 size={15} />{busy ? "正在清理…" : "确认清理元数据"}</button></footer>
  </dialog>, document.querySelector(".folio") ?? document.body);
}
