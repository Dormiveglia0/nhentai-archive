import { useEffect, useState } from "react";
import { api, type GovernanceFile } from "../../lib/api";
import { FolioSelect } from "../folio/ui/FolioPrimitives";

export function SourceRenameControl({ files, workId, disabled, onRenamed }: { files: GovernanceFile[]; workId: number; disabled: boolean; onRenamed: () => void }) {
  const [selectedId, setSelectedId] = useState(files[0]?.id);
  const file = files.find(value => value.id === selectedId) ?? files[0];
  const original = file?.path.split('/').pop() ?? '';
  const extension = original.includes('.') ? original.slice(original.lastIndexOf('.')) : '';
  const stem = extension ? original.slice(0, -extension.length) : original;
  const [editing, setEditing] = useState(false);
  const [filename, setFilename] = useState(stem);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setFilename(stem); setEditing(false); setError(''); }, [file?.id, file?.path, stem]);
  async function rename() {
    if (!file) return;
    setBusy(true); setError('');
    try { await api.renameWorkSource(workId, file.id, filename + extension, file.path); setEditing(false); onRenamed(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  }
  if (!file) return null;
  return <section className="folio-governance-rename" aria-label="源文件重命名">
    {files.length > 1 ? <FolioSelect label="源文件" value={String(file.id)} disabled={busy || disabled} onChange={value => setSelectedId(Number(value))} options={files.map(value => ({ value: String(value.id), label: `${value.library_name ?? '源文件'} · ${value.path}` }))} /> : <p title={file.path}>{original}</p>}
    {editing ? <form onSubmit={event => { event.preventDefault(); void rename(); }}>
      <label><span>文件名</span><span className="folio-governance-rename-name"><input aria-label="新文件名" value={filename} onChange={event => setFilename(event.target.value)} disabled={busy || disabled} autoFocus required maxLength={255} /><span aria-label="文件格式">{extension}</span></span></label>
      <div><button className="folio-settings-mini-action" type="button" disabled={busy} onClick={() => { setEditing(false); setFilename(stem); setError(''); }}>取消</button><button className="folio-settings-mini-action" type="submit" disabled={busy || disabled || !filename.trim() || filename === stem}>{busy ? '处理中…' : '保存文件名'}</button></div>
    </form> : <button className="folio-settings-mini-action" type="button" disabled={disabled || !file.exists || !file.rename_allowed} onClick={() => setEditing(true)}>重命名</button>}
    {error ? <p className="folio-media-error" role="alert">{error}</p> : null}
    {disabled ? <small>请先保存字段修改</small> : !file.rename_allowed ? <small>需要可写权限；挂载库还需允许回写和删除。</small> : null}
  </section>;
}
