import { useState } from "react";
import { Download, Trash2, Wand2, X } from "lucide-react";

import { api, EXPORT_SYNC_THRESHOLD, type FileDeletePreview, type FileDeleteTarget } from "../../lib/api";
import { formatBytes } from "./libraryHelpers";

type Props = {
  selectedIds: number[];
  onClear: () => void;
  onDone: () => void;
};

/**
 * Bulk action tray for the library multi-select mode. Reuses existing batch
 * endpoints only: export bundle download, governance bulk fill-missing (safe
 * default, no write-back), and the file-delete preview/confirm cascade.
 */
export function LibraryBatchTray({ selectedIds, onClear, onDone }: Props) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletePreview, setDeletePreview] = useState<FileDeletePreview | null>(null);
  const [deleteTargets, setDeleteTargets] = useState<FileDeleteTarget[]>([]);

  const count = selectedIds.length;

  async function exportSelected() {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      if (count > EXPORT_SYNC_THRESHOLD) {
        const job = await api.enqueueBulkExport(selectedIds.map((work_id) => ({ work_id })));
        setNotice(`已加入任务中心（任务 #${job.id}），完成后可在任务页下载合集`);
      } else {
        await api.downloadExportBundle(selectedIds.map((work_id) => ({ work_id })));
        setNotice(`已开始下载 ${count} 部作品的合集`);
      }
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc));
    } finally {
      setBusy(false);
    }
  }

  async function fillMissing() {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const result = await api.governanceBulkApply(selectedIds, { fill_missing_metadata: true });
      setNotice(`已补全 ${result.summary.filled_fields} 个缺失字段（${result.summary.works} 部作品）`);
      onDone();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc));
    } finally {
      setBusy(false);
    }
  }

  async function previewDelete() {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const targets = selectedIds.map((work_id) => ({ kind: "work" as const, work_id }));
      const preview = await api.previewFileDelete(targets);
      setDeletePreview(preview);
      setDeleteTargets(targets);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc));
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.deleteFiles(deleteTargets);
      if (result.errors.length > 0) {
        setError(`部分删除失败（${result.errors.length}）：${result.errors.map((e) => e.message).join("；")}`);
      } else {
        setNotice(`已删除 ${result.removed_works} 部作品，释放 ${formatBytes(result.reclaimed_bytes)}`);
      }
      setDeletePreview(null);
      setDeleteTargets([]);
      onDone();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="library-batch-tray">
      <div className="batch-tray-head">
        <span className="batch-count">已选 {count} 部</span>
        <button type="button" className="batch-clear" onClick={onClear} disabled={busy}>
          <X size={14} /> 清空
        </button>
      </div>

      {deletePreview ? (
        <div className="batch-delete-confirm">
          <p className="batch-warning">
            将永久删除 {deletePreview.works_to_remove} 部作品（共 {deletePreview.files_to_delete} 个文件，
            释放 {formatBytes(deletePreview.reclaim_bytes)}）。源 CBZ、封面与所有阅读进度/治理记录将被级联移除，且不可恢复。
          </p>
          <div className="batch-actions">
            <button type="button" className="batch-danger" onClick={confirmDelete} disabled={busy}>
              确认删除
            </button>
            <button type="button" className="batch-ghost" onClick={() => setDeletePreview(null)} disabled={busy}>
              取消
            </button>
          </div>
        </div>
      ) : (
        <div className="batch-actions">
          <button type="button" onClick={exportSelected} disabled={busy || count === 0}>
            <Download size={15} /> 导出下载
          </button>
          <button type="button" onClick={fillMissing} disabled={busy || count === 0}>
            <Wand2 size={15} /> 补全缺失元数据
          </button>
          <button type="button" className="batch-danger" onClick={previewDelete} disabled={busy || count === 0}>
            <Trash2 size={15} /> 删除所选
          </button>
        </div>
      )}

      {notice ? <div className="batch-notice">{notice}</div> : null}
      {error ? <div className="batch-notice error">{error}</div> : null}
    </div>
  );
}
