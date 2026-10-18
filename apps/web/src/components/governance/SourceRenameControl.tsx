import { useState } from "react";
import { api, type GovernanceFile } from "../../lib/api";

export function SourceRenameControl({ file, workId, disabled, onRenamed }: { file: GovernanceFile; workId: number; disabled: boolean; onRenamed: () => void }) {
  const [editing, setEditing] = useState(false);
  const [filename, setFilename] = useState(file.path.split('/').pop() ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function rename() {
    setBusy(true); setError('');
    try { await api.renameWorkSource(workId, file.id, filename, file.path); setEditing(false); onRenamed(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  }
  return <section className="folio-governance-rename" aria-label="源文件重命名">
    <p title={file.path}>{file.path.split('/').pop()}</p>
    {editing ? <form onSubmit={event => { event.preventDefault(); void rename(); }}>
      <label><span>文件名（保留扩展名）</span><input aria-label="新文件名" value={filename} onChange={event => setFilename(event.target.value)} disabled={busy || disabled} required maxLength={255} /></label>
      <div><button className="folio-settings-mini-action" type="button" disabled={busy} onClick={() => setEditing(false)}>取消</button><button className="folio-settings-mini-action" type="submit" disabled={busy || disabled || !filename.trim()}>{busy ? '处理中…' : '保存文件名'}</button></div>
    </form> : <button className="folio-settings-mini-action" type="button" disabled={disabled || !file.exists || !file.rename_allowed} onClick={() => setEditing(true)}>重命名</button>}
    {error ? <p className="folio-media-error" role="alert">{error}</p> : null}
    {disabled ? <small>请先保存字段修改</small> : !file.rename_allowed ? <small>需要可写权限；挂载库还需允许回写和删除。</small> : null}
  </section>;
}
