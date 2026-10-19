import { FolderOpen, Save, X } from "lucide-react";
import { useId, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";

import { api, type MediaLibrary, type MediaLibraryConfig, type MediaLibraryInput } from "../../lib/api";
import { FolioSelect, FolioToggleRow } from "../folio/ui/FolioPrimitives";
import { useNativeDialog } from "../../lib/useNativeDialog";
import { DirectoryPicker } from "./DirectoryPicker";

export function MediaLibraryEditor({ library, defaults, onClose, onSaved }: {
  library: MediaLibrary | null;
  defaults: MediaLibraryConfig;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [kind, setKind] = useState<MediaLibraryInput["kind"]>(library?.kind ?? "local");
  const [enabled, setEnabled] = useState(library?.enabled ?? true);
  const [readOnly, setReadOnly] = useState(library?.read_only ?? true);
  const [config, setConfig] = useState<MediaLibraryInput["config"]>(library?.config ?? defaults);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rootPath, setRootPath] = useState(library?.root_path ?? "");
  const [browsing, setBrowsing] = useState(false);
  const managed = kind === "managed";

  const dismiss = useNativeDialog(dialogRef, onClose, true, busy);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    const fields = new FormData(event.currentTarget);
    const payload: MediaLibraryInput = {
      name: String(fields.get("name")).trim(), root_path: String(fields.get("root_path")).trim(),
      kind, enabled, read_only: readOnly,
      config: { ...config,
        scan_interval_seconds: Number(fields.get("scan_interval_seconds")),
        stable_seconds: Number(fields.get("stable_seconds")), io_timeout_seconds: Number(fields.get("io_timeout_seconds")),
        exclude_patterns: String(fields.get("exclude_patterns")).split("\n").map(value => value.trim()).filter(Boolean),
      },
    };
    setBusy(true);
    setError("");
    try {
      if (library) await api.updateMediaLibrary(library.id, payload);
      else await api.addMediaLibrary(payload);
      onSaved();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc));
      setBusy(false);
    }
  }

  function toggle(key: "recursive" | "watch" | "auto_scrape" | "auto_bind" | "allow_writeback" | "allow_delete" | "include_hidden" | "follow_symlinks", checked: boolean) {
    setConfig(value => ({ ...value, [key]: checked }));
  }

  return createPortal(
    <dialog ref={dialogRef} className="folio-media-editor" aria-labelledby={titleId}>
      <form onSubmit={event => void save(event)} onInvalidCapture={event => {
        const details = (event.target as HTMLElement).closest("details");
        if (details) details.open = true;
      }}>
        <header>
          <h2 id={titleId}>{library ? "编辑媒体库" : "添加媒体库"}</h2>
          <button className="folio-media-icon-button" type="button" aria-label="关闭媒体库设置" disabled={busy} onClick={dismiss}><X size={19} /></button>
        </header>
        <fieldset disabled={busy}>
          <div className="folio-field-matrix">
            <label className="folio-field"><span>库名</span><input name="name" defaultValue={library?.name ?? ""} required maxLength={100} data-dialog-focus autoFocus /><i /></label>
            {managed ? <label className="folio-field"><span>访问方式</span><input value="本地导入" readOnly /><i /></label> :
              <FolioSelect label="访问方式" value={kind} options={[{ value: "local", label: "本地目录" }, { value: "mounted", label: "挂载目录（rclone / 网络存储）" }]} onChange={setKind} />}
            <div className="folio-field-wide folio-directory-path">
              <label className="folio-field"><span>目录路径</span><input name="root_path" value={rootPath} onChange={event => setRootPath(event.target.value)} placeholder="/media/comics" required readOnly={managed} maxLength={4096} /><i /></label>
              {!managed ? <button type="button" className="folio-line-button" onClick={() => setBrowsing(true)}><FolderOpen size={16} />浏览</button> : null}
            </div>
          </div>
          <div className="folio-toggle-list">
            <FolioToggleRow label="启用此库" copy="暂停后保留作品信息，停止自动扫描与刮削。" checked={enabled} onChange={setEnabled} />
            {kind === "mounted"
              ? <>
                  <FolioToggleRow label="允许存入下载作品" copy="将下载完成的 CBZ 存入此目录。" checked={!readOnly} onChange={allowed => setReadOnly(!allowed)} />
                  <FolioToggleRow label="允许回写 CBZ" copy="将整理后的元数据写入已有 CBZ，需要挂载目录可写。" checked={config.allow_writeback} onChange={value => toggle("allow_writeback", value)} />
                  <FolioToggleRow label="允许删除源文件" copy="允许确认删除时移除网盘中的原文件，不能通过清理缓存恢复。" checked={config.allow_delete} onChange={value => toggle("allow_delete", value)} />
                </>
              : <FolioToggleRow label="源文件只读" copy="关闭后允许文件管理删除与治理回写源文件。" checked={readOnly} onChange={setReadOnly} />}
          </div>
          <h3>扫描与监控</h3>
          <div className="folio-toggle-list">
            <FolioToggleRow label="扫描子文件夹" copy="包含当前目录下的所有层级。" checked={config.recursive} onChange={value => toggle("recursive", value)} />
            <FolioToggleRow label="自动检查文件变化" copy={kind === "mounted" ? "定时比较目录条目、文件大小与修改时间，变化后再扫描；远端变化需先更新 rclone 缓存。" : "监听文件变化，并定时比较目录条目、文件大小与修改时间；未变化时跳过扫描。"} checked={config.watch} onChange={value => toggle("watch", value)} />
          </div>
          <h3>元数据刮削</h3>
          <div className="folio-toggle-list">
            <FolioToggleRow label="扫描后自动刮削" copy="高置信度匹配自动应用，存在冲突时保留等待确认。" checked={config.auto_scrape} onChange={value => toggle("auto_scrape", value)} />
            <FolioToggleRow label="刮削时绑定远端作品" copy="绑定后可打开远端详情；关闭时只保存元数据。" checked={config.auto_bind} onChange={value => toggle("auto_bind", value)} />
          </div>
          <div className="folio-field-matrix">
            <FolioSelect label="语言策略" value={config.language_mode} options={[{ value: "any", label: "不限语言" }, { value: "strict", label: "只匹配指定语言" }, { value: "prefer", label: "优先指定语言" }]} onChange={language_mode => setConfig(value => ({ ...value, language_mode }))} />
            {config.language_mode !== "any" ? <FolioSelect label="目标语言" value={config.language} options={[{ value: "chinese", label: "中文" }, { value: "japanese", label: "日文" }, { value: "english", label: "英文" }]} onChange={language => setConfig(value => ({ ...value, language }))} /> : null}
            <FolioSelect label="阅读缓存" value={config.cache_mode} options={[{ value: "auto", label: "自动（挂载作品先缓存）" }, { value: "always", label: "所有作品先缓存" }, { value: "off", label: "直接读取源文件" }]} onChange={cache_mode => setConfig(value => ({ ...value, cache_mode }))} />
          </div>
          <details className="folio-media-advanced">
            <summary>扫描参数</summary>
            <div className="folio-field-matrix">
              {([{ key: "scan_interval_seconds", label: "定时检查间隔（秒）", min: 10, max: 86400 },
                { key: "stable_seconds", label: "文件稳定等待（秒）", min: 0, max: 600 },
                { key: "io_timeout_seconds", label: "挂载读取超时（秒）", min: 5, max: 600 }] as const).map(field => (
                <label key={field.key} className="folio-field"><span>{field.label}</span><input name={field.key} type="number" defaultValue={config[field.key]} min={field.min} max={field.max} step={1} required /><i /></label>
              ))}
              <label className="folio-field folio-field-wide"><span>排除规则（每行一项，支持 * 通配符）</span><textarea name="exclude_patterns" defaultValue={config.exclude_patterns.join("\n")} rows={4} maxLength={10280} /></label>
            </div>
            <div className="folio-toggle-list">
              <FolioToggleRow label="包含隐藏文件" copy="扫描以点开头的文件和文件夹。" checked={config.include_hidden} onChange={value => toggle("include_hidden", value)} />
              <FolioToggleRow label="跟随符号链接" copy="只接受库目录以内的目标，避免越界和循环。" checked={config.follow_symlinks} onChange={value => toggle("follow_symlinks", value)} />
            </div>
          </details>
        </fieldset>
        {error ? <p className="folio-media-error" role="alert">{error}</p> : null}
        <footer>
          <button type="button" className="folio-line-button" disabled={busy} onClick={dismiss}>取消</button>
          <button type="submit" className="folio-line-button is-primary" disabled={busy}><Save size={15} />{busy ? "正在保存" : library ? "保存媒体库" : "添加媒体库"}</button>
        </footer>
      </form>
      {browsing ? <DirectoryPicker initialPath={rootPath} onSelect={setRootPath} onClose={() => setBrowsing(false)} /> : null}
    </dialog>, document.querySelector(".folio") ?? document.body,
  );
}
