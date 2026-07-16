import { AlertTriangle, Trash2, X } from "lucide-react";
import { useEffect, useRef } from "react";

import type { FileDeletePreview } from "../../lib/api";
import { formatBytes } from "./fileHelpers";

const WARNING_LABELS: Record<string, string> = {
  has_progress: "含阅读进度",
  has_governance: "含治理元数据",
  already_gone: "目标已不存在",
  forbidden_path: "路径不在受管目录内",
};

type Props = {
  preview: FileDeletePreview | null;
  label: string | null;
  returnFocus: HTMLElement | null;
  error: string | null;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function FileDeleteDialog({ preview, label, returnFocus, error, busy, onConfirm, onCancel }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!preview || !dialog) return;
    dialog.showModal();
    cancelRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
      window.requestAnimationFrame(() => {
        if (
          returnFocus?.isConnected
          && (!(returnFocus instanceof HTMLButtonElement) || !returnFocus.disabled)
        ) {
          returnFocus.focus();
        }
      });
    };
  }, [preview, returnFocus]);

  if (!preview) return null;
  const hasHealthyWork = preview.items.some((item) => item.kind === "work" && item.exists);
  const warnings = preview.items.flatMap((item) =>
    item.warnings.map((warning) => ({ warning, title: item.kind === "work" ? item.title : undefined })),
  );
  const canDelete = preview.files_to_delete > 0 || preview.works_to_remove > 0;

  return (
    <dialog
      ref={dialogRef}
      className="folio-modal folio-files-delete-dialog"
      aria-labelledby="folio-files-delete-title"
      aria-describedby="folio-files-delete-summary"
      aria-busy={busy}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <header>
        <span>Deletion impact</span>
        <h2 id="folio-files-delete-title">确认删除</h2>
      </header>
      {label ? <strong className="folio-files-delete-label">{label}</strong> : null}
      <p id="folio-files-delete-summary">
        将删除 <strong>{preview.files_to_delete}</strong> 个文件
        {preview.works_to_remove > 0 ? <>，并移除 <strong>{preview.works_to_remove}</strong> 个作品</> : null}
        ，预计回收 <strong>{formatBytes(preview.reclaim_bytes)}</strong>。此操作不可恢复。
      </p>
      {warnings.length > 0 ? (
        <ul className="folio-files-warning-list">
          {warnings.map(({ warning, title }, index) => (
            <li key={`${index}-${warning}`}>
              <AlertTriangle size={13} />
              {WARNING_LABELS[warning] ?? warning}{title ? `：${title}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p className="folio-files-delete-error" role="alert">{error}</p> : null}
      <div className="folio-files-confirm">
        <button type="button" className="is-danger" onClick={onConfirm} disabled={busy || !canDelete}>
          <Trash2 size={14} />{hasHealthyWork ? "确认永久删除" : "确认删除"}
        </button>
        <button ref={cancelRef} type="button" onClick={onCancel} disabled={busy}>
          <X size={14} />取消
        </button>
      </div>
    </dialog>
  );
}
