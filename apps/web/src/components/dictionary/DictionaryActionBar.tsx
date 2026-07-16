import { Ban, RotateCcw, Save, SearchCheck, Trash2 } from "lucide-react";

export function DictionaryActionBar({
  hasOriginal,
  hasTranslation,
  hasDictionaryId,
  ignored,
  previewReady,
  loading,
  onPreview,
  onApply,
  onIgnore,
  onReview,
  onDelete,
}: {
  hasOriginal: boolean;
  hasTranslation: boolean;
  hasDictionaryId: boolean;
  ignored: boolean;
  previewReady: boolean;
  loading: boolean;
  onPreview: () => void;
  onApply: () => void;
  onIgnore: () => void;
  onReview: () => void;
  onDelete: () => void;
}) {
  return (
    <footer className="folio-dictionary-actions">
      <div className="folio-dictionary-action-state">
        <span className={previewReady ? "is-ready" : ""} aria-hidden="true" />
        <p><strong>{previewReady ? "影响范围已预览" : "写入前需要预览"}</strong><small>预览不会修改词典或作品</small></p>
      </div>
      <button className="folio-dictionary-action" type="button" onClick={onPreview} disabled={loading || !hasOriginal || !hasTranslation}>
        <SearchCheck size={16} />
        <span className="folio-dictionary-action-label" data-short="预览">预览影响</span>
      </button>
      <button className="folio-dictionary-action is-primary" type="button" onClick={onApply} disabled={loading || !previewReady}>
        <Save size={16} />
        <span className="folio-dictionary-action-label" data-short={hasDictionaryId ? "保存" : "写入"}>
          {loading ? "处理中…" : hasDictionaryId ? "保存修改" : "写入词典"}
        </span>
      </button>
      <button className="folio-dictionary-action is-compact" type="button" onClick={onIgnore} disabled={loading || !hasOriginal || ignored} title="忽略并保留原文">
        <Ban size={16} /><span>忽略</span>
      </button>
      <button className="folio-dictionary-action is-compact" type="button" onClick={onReview} disabled={loading || !hasDictionaryId} title="加入复核">
        <RotateCcw size={16} /><span>复核</span>
      </button>
      <button className="folio-dictionary-action is-compact is-danger" type="button" onClick={onDelete} disabled={loading || !hasDictionaryId} title="删除词条">
        <Trash2 size={16} /><span>删除</span>
      </button>
    </footer>
  );
}
