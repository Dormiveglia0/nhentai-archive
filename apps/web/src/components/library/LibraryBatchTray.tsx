import { useEffect, useState } from "react";
import { Download, RefreshCw, Trash2, Wand2, X } from "lucide-react";

import {
  api,
  EXPORT_SYNC_THRESHOLD,
  type FileDeletePreview,
  type FileDeleteTarget,
  type MetadataRefreshMatch,
  type MetadataRefreshPreview,
} from "../../lib/api";
import { formatBytes } from "./libraryHelpers";

type Props = {
  selectedIds: number[];
  onClear: () => void;
  onDone: () => void;
};

/**
 * Bulk action tray for the library multi-select mode. Reuses existing batch
 * endpoints: export, governance fill-missing, remote metadata refresh, and
 * the file-delete preview/confirm cascade.
 */
export function LibraryBatchTray({ selectedIds, onClear, onDone }: Props) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletePreview, setDeletePreview] = useState<FileDeletePreview | null>(null);
  const [deleteTargets, setDeleteTargets] = useState<FileDeleteTarget[]>([]);
  const [refreshPreview, setRefreshPreview] = useState<MetadataRefreshPreview | null>(null);
  const [galleryIds, setGalleryIds] = useState<Record<number, string>>({});
  const [refreshDirty, setRefreshDirty] = useState(false);

  const count = selectedIds.length;
  const selectionKey = selectedIds.join(",");

  useEffect(() => {
    setRefreshPreview(null);
    setGalleryIds({});
    setRefreshDirty(false);
  }, [selectionKey]);

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

  async function previewMetadataRefresh() {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const overrides = Object.fromEntries(
        Object.entries(galleryIds)
          .map(([workId, galleryId]) => [Number(workId), Number(galleryId)] as const)
          .filter(([, galleryId]) => Number.isInteger(galleryId) && galleryId > 0)
      );
      setRefreshPreview(await api.metadataRefreshPreview(selectedIds, overrides));
      setRefreshDirty(false);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc));
    } finally {
      setBusy(false);
    }
  }

  async function applyMetadataRefresh() {
    const matches = refreshPreview?.result.flatMap((row) =>
      row.match?.eligible ? [{ work_id: row.work.id, ...row.match }] : []
    ) ?? [];
    if (!matches.length || refreshDirty) return;
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const result = await api.metadataRefreshApply(matches);
      setNotice(
        `已刷新 ${result.summary.updated} 部作品的远端元数据` +
        `${result.summary.skipped ? `，跳过 ${result.summary.skipped} 部` : ""}` +
        `${result.summary.errors ? `，失败 ${result.summary.errors} 部` : ""}`
      );
      setRefreshPreview(null);
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
    <div className="folio-library-batch" aria-busy={busy}>
      <div className="folio-library-batch-head">
        <span><strong>{count}</strong> 部已选</span>
        <button type="button" onClick={onClear} disabled={busy || count === 0}>
          <X size={14} /> 清空
        </button>
      </div>

      {deletePreview ? (
        <div className="folio-library-delete-confirm">
          <p>
            将永久删除 {deletePreview.works_to_remove} 部作品（共 {deletePreview.files_to_delete} 个文件，
            释放 {formatBytes(deletePreview.reclaim_bytes)}）。源 CBZ、封面与所有阅读进度/治理记录将被级联移除，且不可恢复。
          </p>
          <div className="folio-library-batch-actions">
            <button type="button" className="is-danger" onClick={confirmDelete} disabled={busy}>
              确认删除
            </button>
            <button type="button" onClick={() => setDeletePreview(null)} disabled={busy}>
              取消
            </button>
          </div>
        </div>
      ) : refreshPreview ? (
        <MetadataRefreshPanel
          preview={refreshPreview}
          galleryIds={galleryIds}
          dirty={refreshDirty}
          busy={busy}
          onGalleryIdChange={(workId, value) => {
            setGalleryIds((current) => ({ ...current, [workId]: value }));
            setRefreshDirty(true);
          }}
          onPreview={previewMetadataRefresh}
          onApply={applyMetadataRefresh}
          onCancel={() => setRefreshPreview(null)}
        />
      ) : (
        <div className="folio-library-batch-actions">
          <button type="button" onClick={exportSelected} disabled={busy || count === 0}>
            <Download size={15} /> 导出下载
          </button>
          <button type="button" onClick={fillMissing} disabled={busy || count === 0}>
            <Wand2 size={15} /> 补全缺失元数据
          </button>
          <button type="button" onClick={previewMetadataRefresh} disabled={busy || count === 0}>
            <RefreshCw size={15} /> 拉取远端元数据
          </button>
          <button type="button" className="is-danger" onClick={previewDelete} disabled={busy || count === 0}>
            <Trash2 size={15} /> 删除所选
          </button>
        </div>
      )}

      {notice ? <div className="folio-library-batch-notice" role="status">{notice}</div> : null}
      {error ? <div className="folio-library-batch-notice is-error" role="alert">{error}</div> : null}
    </div>
  );
}

const SOURCE_LABELS = {
  remote_id: "已有作品 ID",
  web: "ComicInfo Web",
  manual_id: "手动作品 ID",
  fuzzy: "标题模糊匹配",
} satisfies Record<MetadataRefreshMatch["source"], string>;

function MetadataRefreshPanel({
  preview,
  galleryIds,
  dirty,
  busy,
  onGalleryIdChange,
  onPreview,
  onApply,
  onCancel,
}: {
  preview: MetadataRefreshPreview;
  galleryIds: Record<number, string>;
  dirty: boolean;
  busy: boolean;
  onGalleryIdChange: (workId: number, value: string) => void;
  onPreview: () => void;
  onApply: () => void;
  onCancel: () => void;
}) {
  return (
    <section className="folio-library-refresh-preview" aria-label="远端元数据匹配预览">
      <p>
        可安全刷新 {preview.summary.ready}/{preview.summary.works} 部：精确匹配 {preview.summary.exact}，
        高置信度模糊匹配 {preview.summary.fuzzy}。低置信度或候选接近的项目不会自动写入。
      </p>
      <ul>
        {preview.result.map((row) => (
          <li key={row.work.id} className={row.match?.eligible ? "is-ready" : "is-review"}>
            <div>
              <strong>{row.work.title || `#${row.work.id}`}</strong>
              {row.match ? (
                <small>
                  {SOURCE_LABELS[row.match.source]} · #{row.match.gallery_id} · {row.match.title} · 置信度 {row.match.confidence}%
                </small>
              ) : <small>{row.reason || "未找到远端候选"}</small>}
              {row.match?.reason ? <em>{row.match.reason}</em> : null}
            </div>
            <label>
              <span>指定远端 ID</span>
              <input
                type="number"
                min="1"
                inputMode="numeric"
                value={galleryIds[row.work.id] ?? ""}
                placeholder={row.match ? String(row.match.gallery_id) : "例如 123456"}
                aria-label={`为 ${row.work.title || `作品 ${row.work.id}`} 指定远端作品 ID`}
                onChange={(event) => onGalleryIdChange(row.work.id, event.target.value)}
              />
            </label>
          </li>
        ))}
      </ul>
      <div className="folio-library-batch-actions">
        <button type="button" onClick={onPreview} disabled={busy}>{dirty ? "按指定 ID 重新预览" : "重新匹配"}</button>
        <button type="button" className="is-primary" onClick={onApply} disabled={busy || dirty || preview.summary.ready === 0}>
          确认刷新 {preview.summary.ready} 部
        </button>
        <button type="button" onClick={onCancel} disabled={busy}>取消</button>
      </div>
    </section>
  );
}
