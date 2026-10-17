import { Check, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api, type MediaLibrary } from "../../lib/api";
import { useNativeDialog } from "../../lib/useNativeDialog";
import { FolioSelect, FolioToggleRow } from "../folio/ui/FolioPrimitives";
import { MetadataScrapePanel } from "./MetadataScrapePanel";
import "../settings/StorageSection.css";
import "./UploadDialog.css";

const fields = [["title", "标题"], ["title_japanese", "原文标题"], ["artist", "作者"], ["group", "社团"], ["language", "语言"], ["tags", "标签"], ["summary", "简介"]] as const;
type Imported = Awaited<ReturnType<typeof api.uploadArchive>>;

export function UploadDialog({ blurCovers, onClose, onImported }: { blurCovers: boolean; onClose: () => void; onImported: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [libraries, setLibraries] = useState<MediaLibrary[]>([]);
  const [libraryId, setLibraryId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [autoScrape, setAutoScrape] = useState(true);
  const [bind, setBind] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [imported, setImported] = useState<Imported | null>(null);
  const [tab, setTab] = useState("remote");
  const [metadata, setMetadata] = useState<Record<string, string>>({});
  const dismiss = useNativeDialog(dialog, onClose, true, busy);

  useEffect(() => {
    let active = true;
    void api.mediaLibraries().then(result => {
      if (!active) return;
      const writable = result.result.filter(row => row.enabled && !row.read_only && row.health !== "offline");
      setLibraries(writable);
      setLibraryId(String(writable.find(row => row.id === result.default_download_library_id)?.id ?? writable[0]?.id ?? ""));
      if (!writable.length) setError("请先在文件 → 媒体库中启用一个可存入文件的目录。");
    }).catch(exc => { if (active) setError(String(exc.message || exc)); });
    return () => { active = false; };
  }, []);

  async function upload() {
    if (!file || !libraryId) return;
    setBusy(true); setError("");
    try {
      const result = await api.uploadArchive(file, libraryId);
      setImported(result); setMetadata(result.metadata); setTab(autoScrape ? "remote" : "manual");
      onImported();
    } catch (exc) { setError(exc instanceof Error ? exc.message : String(exc)); }
    finally { setBusy(false); }
  }

  async function applied() {
    onImported();
    if (!imported) return;
    try {
      const result = await api.workGovernance(imported.work_id);
      setMetadata(Object.fromEntries(result.metadata.fields.map(field => [field.field, field.working_value ?? field.current_value ?? ""])));
    } catch (exc) { setError(exc instanceof Error ? exc.message : String(exc)); }
  }

  async function save() {
    if (!imported) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await api.applyWorkGovernance(imported.work_id, { metadata: fields.map(([field]) => ({ field, value: metadata[field] || "", source: "manual" })) });
      setNotice("元数据已保存"); onImported();
    } catch (exc) { setError(exc instanceof Error ? exc.message : String(exc)); }
    finally { setBusy(false); }
  }

  return createPortal(<dialog ref={dialog} className="folio-media-editor folio-upload" aria-label="上传作品" aria-busy={busy}>
    <header><h2>{imported ? "整理作品" : "上传作品"}</h2><button className="folio-media-icon-button" type="button" aria-label="关闭上传" disabled={busy} onClick={dismiss}><X size={19} /></button></header>
    <div className="folio-upload-body">
      {!imported ? <fieldset disabled={busy}>
        <label className="folio-upload-file"><Upload size={24} /><strong>选择 ZIP 或 CBZ</strong><span>ZIP 会自动保存为 CBZ · 最大 2 GB</span><input type="file" accept=".zip,.cbz" data-dialog-focus aria-label="选择归档文件" onChange={event => { setFile(event.target.files?.[0] ?? null); setError(""); }} /></label>
        <FolioSelect label="存入媒体库" value={libraryId} onChange={setLibraryId} options={libraries.length ? libraries.map(row => ({ value: String(row.id), label: row.name })) : [{ value: "", label: "暂无可用媒体库" }]} />
        <div className="folio-toggle-list">
          <FolioToggleRow label="自动刮削" copy="上传后搜索匹配作品，确认后应用元数据。" checked={autoScrape} onChange={setAutoScrape} />
          <FolioToggleRow label="绑定远端作品" copy="确认匹配时建立关联；关闭时只应用元数据。" checked={bind} onChange={setBind} />
        </div>
      </fieldset> : <>
        <p className="folio-upload-success"><Check size={17} /><span>已导入 {imported.filename}<small>{imported.page_count} 页 · 关闭窗口后仍保留在我的库</small></span></p>
        {imported.warnings.map((warning, index) => <p key={index}>{warning}</p>)}
        <div className="folio-upload-tabs" role="group" aria-label="元数据填写方式">
          <button type="button" disabled={busy} aria-pressed={tab === "remote"} onClick={() => { setTab("remote"); setNotice(""); }}>远端匹配</button>
          <button type="button" disabled={busy} aria-pressed={tab === "manual"} onClick={() => { setTab("manual"); setNotice(""); }}>手动填写</button>
        </div>
        <div hidden={tab !== "remote"}>
          <fieldset disabled={busy}><FolioToggleRow label="绑定远端作品" copy="匹配不满意时，可更换关键词或输入作品 ID。" checked={bind} onChange={setBind} /></fieldset>
          <MetadataScrapePanel embedded workId={imported.work_id} title={imported.title} blurCovers={blurCovers} bind={bind} autoSearch={autoScrape} onBusyChange={setBusy} onApplied={() => void applied()} onClose={dismiss} />
        </div>
        {tab === "manual" ? <form id="upload-metadata" onSubmit={event => { event.preventDefault(); void save(); }}>
          <fieldset disabled={busy} className="folio-field-matrix">
            {fields.map(([field, label]) => <label key={field} className={`folio-field${field === "summary" ? " folio-field-wide" : ""}`}><span>{label}</span>{field === "summary" ? <textarea value={metadata[field] ?? ""} onChange={event => setMetadata(value => ({ ...value, [field]: event.target.value }))} maxLength={10000} /> : <><input value={metadata[field] ?? ""} required={field === "title"} maxLength={2000} onChange={event => setMetadata(value => ({ ...value, [field]: event.target.value }))} /><i /></>}</label>)}
          </fieldset>
        </form> : null}
      </>}
      {error ? <p className="folio-media-error" role="alert">{error}</p> : null}
      {notice ? <p role="status">{notice}</p> : null}
    </div>
    <footer>
      <button type="button" className="folio-line-button" disabled={busy} onClick={dismiss}>{imported ? "完成" : "取消"}</button>
      {!imported ? <button type="button" className="folio-line-button is-primary" disabled={busy || !file || !libraryId} onClick={() => void upload()}><Upload size={15} />{busy ? "上传中…" : "上传"}</button> : tab === "manual" ? <button type="submit" form="upload-metadata" className="folio-line-button is-primary" disabled={busy}>{busy ? "保存中…" : "保存元数据"}</button> : null}
    </footer>
  </dialog>, document.querySelector(".folio") ?? document.body);
}
