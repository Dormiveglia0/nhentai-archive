import { AlertTriangle, LoaderCircle, Trash2, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { api, type FileDeletePreview } from "../../../lib/api";
import { formatBytes } from "../../../lib/format";

type Props = {
  workId: number;
  title: string;
  onDeleted: () => void;
};

export function WorkDeleteAction({ workId, title, onDeleted }: Props) {
  const [preview, setPreview] = useState<FileDeletePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const summaryId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!preview || !dialog) return;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      window.requestAnimationFrame(() => {
        if (triggerRef.current?.isConnected) triggerRef.current.focus();
      });
    };
  }, [preview]);

  async function requestPreview() {
    setBusy(true);
    setError(null);
    try {
      setPreview(await api.previewFileDelete([{ kind: "work", work_id: workId }]));
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    setBusy(true);
    setError(null);
    let deleted = false;
    try {
      const result = await api.deleteFiles([{ kind: "work", work_id: workId }]);
      if (result.errors.length) {
        setError(result.errors.map((item) => item.message).join("；"));
      } else {
        deleted = true;
      }
    } catch (reason) {
      setError(errorMessage(reason));
    }
    setBusy(false);
    if (!deleted) return;
    setPreview(null);
    onDeleted();
  }

  const item = preview?.items[0];
  const canDelete = Boolean(item?.exists && preview?.works_to_remove);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="folio-work-delete-trigger"
        onClick={() => void requestPreview()}
        disabled={busy}
      >
        {busy && !preview ? <LoaderCircle className="spin" size={16} /> : <Trash2 size={16} />}
        删除本地作品
      </button>
      {!preview && error ? <span className="folio-work-delete-inline-error" role="alert">{error}</span> : null}

      {preview ? (
        <dialog
          ref={dialogRef}
          className="folio-modal folio-work-delete-dialog"
          aria-labelledby={titleId}
          aria-describedby={summaryId}
          aria-busy={busy}
          onCancel={(event) => {
            event.preventDefault();
            if (!busy) {
              setPreview(null);
              setError(null);
            }
          }}
        >
          <header>
            <span>Deletion impact</span>
            <h2 id={titleId}>确认删除本地作品</h2>
          </header>
          <strong className="folio-work-delete-title">{title}</strong>
          <p id={summaryId}>
            将永久删除 {preview.files_to_delete} 个受管文件并移除作品记录，预计释放 {formatBytes(preview.reclaim_bytes)}。
            标签关联、阅读进度和治理记录也会一并清除，此操作不可恢复。
          </p>
          {item?.has_progress || item?.has_governance ? (
            <ul className="folio-work-delete-warnings">
              {item.has_progress ? <li><AlertTriangle size={14} />含阅读进度</li> : null}
              {item.has_governance ? <li><AlertTriangle size={14} />含治理记录</li> : null}
            </ul>
          ) : null}
          {error ? <p className="folio-work-delete-error" role="alert">{error}</p> : null}
          <div className="folio-work-delete-actions">
            <button type="button" className="is-danger" onClick={() => void confirmDelete()} disabled={busy || !canDelete}>
              {busy ? <LoaderCircle className="spin" size={15} /> : <Trash2 size={15} />}
              确认永久删除
            </button>
            <button
              type="button"
              onClick={() => {
                setPreview(null);
                setError(null);
              }}
              disabled={busy}
            >
              <X size={15} />取消
            </button>
          </div>
        </dialog>
      ) : null}
    </>
  );
}

function errorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : String(reason);
}
