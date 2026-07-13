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
    <section className="folio-governance-bulk">
      <div className="folio-governance-bulk-head">
        <strong>已选 {selectedCount} 部</strong>
        <BulkOption label="补全缺失元数据" checked={fill} onChange={onFillChange} />
        <BulkOption label="回写源文件（ComicInfo）" checked={writeBack} onChange={onWriteBackChange} />
        <BulkOption label="确认现有词典译名" checked={confirmTerms} onChange={onConfirmTermsChange} />
        <button className="folio-line-button" type="button" disabled={busy || !selectedCount} onClick={onPreview}>
          预览
        </button>
        <button type="button" className="folio-ink-button" disabled={busy || !selectedCount} onClick={onApply}>
          应用
        </button>
      </div>
      {writeBack ? (
        <p className="folio-governance-bulk-hint">回写会就地改写所选作品源 CBZ 的 ComicInfo，不可撤销；单个失败不影响其余。</p>
      ) : null}

      {preview ? (
        <div className="folio-governance-bulk-report">
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
        <div className="folio-governance-bulk-report is-result">
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
    </section>
  );
}

function BulkOption({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="folio-governance-bulk-option">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <i aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
}
