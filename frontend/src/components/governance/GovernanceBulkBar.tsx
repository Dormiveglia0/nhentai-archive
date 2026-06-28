import type { GovernanceBulkPreview, GovernanceBulkResult } from "../../lib/api";

type Props = {
  selectedCount: number;
  fill: boolean;
  onFillChange: (value: boolean) => void;
  writeBack: boolean;
  onWriteBackChange: (value: boolean) => void;
  confirmTerms: boolean;
  onConfirmTermsChange: (value: boolean) => void;
  busy: boolean;
  preview: GovernanceBulkPreview | null;
  result: GovernanceBulkResult | null;
  onPreview: () => void;
  onApply: () => void;
};

export function GovernanceBulkBar({
  selectedCount,
  fill,
  onFillChange,
  writeBack,
  onWriteBackChange,
  confirmTerms,
  onConfirmTermsChange,
  busy,
  preview,
  result,
  onPreview,
  onApply,
}: Props) {
  return (
    <div className="governance-bulk-bar">
      <div className="governance-bulk-head">
        <strong>已选 {selectedCount} 部</strong>
        <label>
          <input type="checkbox" checked={fill} onChange={(e) => onFillChange(e.target.checked)} />
          补全缺失元数据
        </label>
        <label>
          <input type="checkbox" checked={writeBack} onChange={(e) => onWriteBackChange(e.target.checked)} />
          回写源文件（ComicInfo）
        </label>
        <label>
          <input type="checkbox" checked={confirmTerms} onChange={(e) => onConfirmTermsChange(e.target.checked)} />
          确认现有词典译名
        </label>
        <button type="button" disabled={busy || !selectedCount} onClick={onPreview}>
          预览
        </button>
        <button type="button" className="primary" disabled={busy || !selectedCount} onClick={onApply}>
          应用
        </button>
      </div>
      {writeBack ? (
        <p className="governance-bulk-hint">回写会就地改写所选作品源 CBZ 的 ComicInfo，不可撤销；单个失败不影响其余。</p>
      ) : null}

      {preview ? (
        <div className="governance-bulk-preview">
          <p>
            将补全 {preview.summary.fields_to_fill} 个字段
            {confirmTerms ? `，确认 ${preview.summary.dictionary_terms_to_confirm} 个词条` : ""}
            {writeBack ? `，可回写 ${preview.summary.write_back_ready}/${preview.summary.works} 个文件` : ""}。
            {confirmTerms && preview.summary.dictionary_terms_skipped ? ` 跳过 ${preview.summary.dictionary_terms_skipped} 个词条。` : ""}
          </p>
          <ul>
            {preview.result.map((row) => (
              <li key={row.work.id}>
                <span>{row.work.title || `#${row.work.id}`}</span>
                <small>
                  {row.fill_fields.length ? `补全 ${row.fill_fields.map((f) => f.label).join("、")}` : "无可补全字段"}
                  {confirmTerms ? ` · 确认词条 ${row.dictionary_terms.length}` : ""}
                  {confirmTerms && row.skipped_dictionary_terms.length ? ` · 跳过 ${row.skipped_dictionary_terms.length}` : ""}
                  {writeBack ? (row.write_back_ready ? " · 可回写" : ` · 不可回写（${row.blockers.join("；")}）`) : ""}
                </small>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result ? (
        <div className="governance-bulk-result">
          <p>
            完成：补全 {result.summary.filled_fields} 字段、确认 {result.summary.dictionary_terms_confirmed} 个词条、回写 {result.summary.written} 个
            {result.summary.errors ? `、失败 ${result.summary.errors} 个` : ""}。
            {result.summary.dictionary_terms_skipped ? ` 跳过 ${result.summary.dictionary_terms_skipped} 个词条。` : ""}
          </p>
          <ul>
            {result.result.map((row) => (
              <li key={row.work_id}>
                <span>#{row.work_id}</span>
                <small>
                  {row.filled.length ? `补全 ${row.filled.length} 字段` : "未补全"}
                  {row.dictionary_terms.length ? ` · 确认词条 ${row.dictionary_terms.length}` : ""}
                  {row.write_back
                    ? row.write_back.error
                      ? ` · 回写失败：${row.write_back.error}`
                      : " · 已回写"
                    : ""}
                </small>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
