import { AlertTriangle, PenLine } from "lucide-react";

import { FadeIn } from "../../lib/motion";
import { FolioEmptyState } from "../folio/ui/FolioPrimitives";
import { GovernanceActionBar } from "./GovernanceActionBar";
import { GovernanceBulkBar } from "./GovernanceBulkBar";
import { GovernanceQueueRail } from "./GovernanceQueueRail";
import { GovernanceSourceRail } from "./GovernanceSourceRail";
import { GovernanceTagBoard } from "./GovernanceTagBoard";
import { GovernanceWorkHeader } from "./GovernanceWorkHeader";
import { MetadataEditor } from "./MetadataEditor";
import { useGovernanceState } from "./useGovernanceState";
import "./GovernancePage.css";
import "./GovernanceEditor.css";

type Props = {
  initialWorkId?: number;
  blurCovers: boolean;
};

export function GovernancePage({ initialWorkId, blurCovers }: Props) {
  const gov = useGovernanceState(initialWorkId);

  return (
    <section className="folio-page-body folio-governance-page">
      {gov.error ? (
        <FadeIn key={gov.error} className="folio-governance-message is-error" y={6}>
          <AlertTriangle size={16} />
          <span>{gov.error}</span>
        </FadeIn>
      ) : null}
      {gov.notice ? (
        <FadeIn key={gov.notice} className="folio-governance-message" y={6}>
          <span aria-hidden="true" />
          <p>{gov.notice}</p>
        </FadeIn>
      ) : null}

      {gov.loading ? <div className="folio-governance-loading" role="status">正在读取真实治理队列…</div> : null}

      {!gov.loading && gov.queue && gov.queue.result.length === 0 ? (
        <section className="folio-ruled-panel folio-governance-empty">
          <FolioEmptyState
            icon={PenLine}
            title="暂无待编辑作品"
            copy="当前本地库没有需要治理的真实作品；导入或重新索引 CBZ 后，队列会按实际缺失项自动生成。"
          />
        </section>
      ) : null}

      {!gov.loading && gov.queue && gov.queue.result.length ? (
        <div className={gov.bulkMode ? "folio-governance-workspace is-bulk" : "folio-governance-workspace"}>
          <GovernanceQueueRail
            queue={gov.queue}
            selectedId={gov.selectedId}
            onSelect={gov.selectWork}
            bulkMode={gov.bulkMode}
            selectedIds={gov.selectedIds}
            onToggleSelected={gov.toggleSelected}
          />

          <main className="folio-governance-editor">
            <header className="folio-governance-modebar">
              <div>
                <span>{gov.bulkMode ? "Batch workflow" : "Review workflow"}</span>
                <strong>{gov.bulkMode ? "批量治理" : "单部审核"}</strong>
              </div>
              <button
                className={gov.bulkMode ? "folio-filter-toggle is-active" : "folio-filter-toggle"}
                type="button"
                aria-pressed={gov.bulkMode}
                onClick={gov.toggleBulkMode}
              >
                {gov.bulkMode ? "退出批量" : "进入批量"}
              </button>
            </header>

            {gov.bulkMode ? (
              <GovernanceBulkBar
                selectedCount={gov.selectedIds.size}
                fill={gov.bulkFill}
                onFillChange={gov.setBulkFill}
                writeBack={gov.bulkWriteBack}
                onWriteBackChange={gov.setBulkWriteBack}
                confirmTerms={gov.bulkConfirmTerms}
                onConfirmTermsChange={gov.setBulkConfirmTerms}
                busy={gov.bulkBusy}
                preview={gov.bulkPreview}
                result={gov.bulkResult}
                onPreview={gov.runBulkPreview}
                onApply={gov.runBulkApply}
              />
            ) : (
              <>
                {gov.aggregateLoading ? <div className="folio-governance-loading" role="status">正在读取作品元数据…</div> : null}
                {!gov.aggregateLoading && gov.aggregate ? (
                  <FadeIn key={gov.aggregate.work.id} className="folio-governance-document" y={10}>
                    <GovernanceWorkHeader aggregate={gov.aggregate} blurCovers={blurCovers} />
                    <MetadataEditor
                      aggregate={gov.aggregate}
                      edits={gov.edits}
                      onChange={gov.changeField}
                      onlyDiff={gov.onlyDiff}
                      onToggleDiff={() => gov.setOnlyDiff((value) => !value)}
                      onTranslate={gov.translateMetadata}
                      translating={gov.translating}
                    />
                    <GovernanceTagBoard
                      aggregate={gov.aggregate}
                      onApplyDictionaryTag={gov.applyDictionaryTag}
                      applyingTagId={gov.dictionaryApplyingId}
                    />
                  </FadeIn>
                ) : null}
                {!gov.aggregateLoading && gov.aggregate ? (
                  <GovernanceActionBar
                    workId={gov.aggregate.work.id}
                    changedCount={gov.changedFields.length}
                    saving={gov.saving}
                    writeBack={gov.writeBack}
                    onWriteBackChange={gov.setWriteBack}
                    onSave={gov.saveMetadata}
                    onReload={gov.reload}
                  />
                ) : null}
                {!gov.aggregateLoading && !gov.aggregate ? (
                  <FolioEmptyState icon={PenLine} title="选择一部作品" copy="从队列选择作品后，在这里核对来源、字段与词典映射。" />
                ) : null}
              </>
            )}
          </main>

          <GovernanceSourceRail aggregate={gov.bulkMode ? null : gov.aggregate} bulkMode={gov.bulkMode} />
        </div>
      ) : null}
    </section>
  );
}
