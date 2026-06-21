import { FadeIn } from "../../lib/motion";
import { GovernanceActionBar } from "./GovernanceActionBar";
import { GovernanceQueueRail } from "./GovernanceQueueRail";
import { GovernanceTagBoard } from "./GovernanceTagBoard";
import { GovernanceWorkHeader } from "./GovernanceWorkHeader";
import { MetadataEditor } from "./MetadataEditor";
import { useGovernanceState } from "./useGovernanceState";

type Props = {
  initialWorkId?: number;
  blurCovers: boolean;
};

export function GovernancePage({ initialWorkId, blurCovers }: Props) {
  const gov = useGovernanceState(initialWorkId);

  return (
    <section className="page governance-page">
      <header className="governance-topbar">
        <div>
          <span className="eyebrow">Metadata</span>
          <h1>元数据编辑</h1>
        </div>
        <p>从队列选一部作品，对照来源核对并写入本地最终元数据。</p>
      </header>

      {gov.error ? <FadeIn key={gov.error} className="notice error" y={6}>{gov.error}</FadeIn> : null}
      {gov.notice ? <FadeIn key={gov.notice} className="notice success" y={6}>{gov.notice}</FadeIn> : null}

      {gov.loading ? <div className="page-panel">正在读取作品队列...</div> : null}

      {!gov.loading && gov.queue && gov.queue.result.length === 0 ? (
        <div className="page-panel boundary-panel">
          <strong>暂无待编辑作品</strong>
          <p>当前本地库没有可编辑元数据的真实作品。导入 CBZ 后这里会显示真实队列。</p>
        </div>
      ) : null}

      {!gov.loading && gov.queue && gov.queue.result.length ? (
        <div className="governance-shell">
          <GovernanceQueueRail queue={gov.queue} selectedId={gov.selectedId} onSelect={gov.selectWork} />

          <div className="governance-editor">
            {gov.aggregateLoading ? <div className="page-panel">正在读取作品元数据...</div> : null}
            {!gov.aggregateLoading && gov.aggregate ? (
              <FadeIn key={gov.aggregate.work.id} y={10}>
                <GovernanceWorkHeader aggregate={gov.aggregate} blurCovers={blurCovers} />

                <MetadataEditor
                  aggregate={gov.aggregate}
                  edits={gov.edits}
                  onChange={gov.changeField}
                  onlyDiff={gov.onlyDiff}
                  onToggleDiff={() => gov.setOnlyDiff((value) => !value)}
                />

                <GovernanceTagBoard aggregate={gov.aggregate} onApplyDictionaryTag={gov.applyDictionaryTag} />

                <GovernanceActionBar
                  workId={gov.aggregate.work.id}
                  changedCount={gov.changedFields.length}
                  saving={gov.saving}
                  onSave={gov.saveMetadata}
                  onReload={gov.reload}
                />
              </FadeIn>
            ) : null}
            {!gov.aggregateLoading && !gov.aggregate ? (
              <div className="governance-editor-empty">从左侧队列选择一部作品开始编辑。</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
