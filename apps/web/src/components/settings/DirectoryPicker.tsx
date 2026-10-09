import { ArrowUp, Folder, RefreshCw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../../lib/api";
import { useNativeDialog } from "../../lib/useNativeDialog";

export function DirectoryPicker({ initialPath, onSelect, onClose }: { initialPath: string; onSelect: (path: string) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const dismiss = useNativeDialog(dialog, onClose);
  const [path, setPath] = useState(initialPath || "/");
  const [input, setInput] = useState(path);
  const [data, setData] = useState<Awaited<ReturnType<typeof api.browseDirectories>> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true); setError(""); setData(null);
    api.browseDirectories(path).then(value => { if (alive) { setData(value); setInput(value.path); } })
      .catch(reason => { if (alive) setError(reason.message); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [path, revision]);
  return createPortal(<dialog ref={dialog} className="folio-media-editor folio-directory-picker" aria-label="选择目录">
    <header><h2>选择目录</h2><button type="button" className="folio-media-icon-button" aria-label="关闭目录浏览" onClick={dismiss}><X size={18} /></button></header>
    <div className="folio-directory-picker-body">
      <form onSubmit={event => { event.preventDefault(); event.stopPropagation(); setPath(input); setRevision(value => value + 1); }}>
        <button type="button" aria-label="上级目录" disabled={loading || !data || data.path === "/"} onClick={() => setPath(data!.parent)}><ArrowUp size={18} /></button>
        <input aria-label="浏览目录路径" value={input} onChange={event => setInput(event.target.value)} maxLength={4096} />
        <button type="submit" aria-label="读取目录" disabled={loading}><RefreshCw size={17} /></button>
      </form>
      {loading ? <p role="status" className="folio-media-hint">正在读取目录…</p> : null}
      {error ? <p role="alert" className="folio-media-error">{error}</p> : null}
      <div className="folio-directory-picker-list" aria-label="子目录">
        {data?.result.map(entry => <button key={entry.path} type="button" onClick={() => setPath(entry.path)}><Folder size={18} /><span>{entry.name}</span></button>)}
      </div>
      {data && !data.result.length ? <p className="folio-media-hint">此目录没有子目录</p> : null}
      {data?.truncated ? <p className="folio-media-hint">目录较大，请输入路径进入其他子目录</p> : null}
    </div>
    <footer><button type="button" className="folio-line-button" onClick={dismiss}>取消</button><button type="button" className="folio-line-button is-primary" disabled={loading || !data || data.path === "/"} onClick={() => { onSelect(data!.path); dismiss(); }}>选择此目录</button></footer>
  </dialog>, document.querySelector(".folio") ?? document.body);
}
