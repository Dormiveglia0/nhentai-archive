import { Database, FileArchive, Tags } from "lucide-react";

import type { GovernanceAggregate } from "../../lib/api";
import { formatBytes } from "../library/libraryHelpers";

export function GovernanceSourceRail({
  aggregate,
  bulkMode,
}: {
  aggregate: GovernanceAggregate | null;
  bulkMode: boolean;
}) {
  const sourceFile = aggregate?.files.find((file) => file.kind === "source_cbz");

  return (
    <aside className="folio-governance-source" aria-label="来源对照摘要">
      <header>
        <span>Source check</span>
        <h2>来源对照</h2>
        <p>{bulkMode ? "批量模式只显示预览结果，不会在确认前写入。" : "核对当前作品的真实来源、文件与词典状态。"}</p>
      </header>

      {aggregate ? (
        <>
          <dl className="folio-governance-source-facts">
            <div><dt><Database size={14} />来源</dt><dd>{aggregate.work.source === "remote" ? "远端入库" : "本地导入"}</dd></div>
            <div><dt>Gallery ID</dt><dd>{aggregate.work.remote_gallery_id || "—"}</dd></div>
            <div><dt>页数</dt><dd>{aggregate.work.page_count}P</dd></div>
            <div><dt><FileArchive size={14} />源文件</dt><dd>{sourceFile?.exists ? formatBytes(sourceFile.size_bytes) : "不可用"}</dd></div>
          </dl>

          <section className="folio-governance-source-tags">
            <div><Tags size={15} /><strong>词典状态</strong></div>
            <span><em>已确认</em><b>{aggregate.tags.summary.confirmed}</b></span>
            <span><em>待确认</em><b>{aggregate.tags.summary.pending}</b></span>
            <span className={aggregate.tags.summary.conflicts ? "is-alert" : ""}><em>冲突</em><b>{aggregate.tags.summary.conflicts}</b></span>
            <span><em>词典命中</em><b>{aggregate.dictionary.matched}</b></span>
          </section>

          <section className="folio-governance-source-actions">
            <strong>当前建议</strong>
            {aggregate.recommended_actions.length ? (
              <ul>{aggregate.recommended_actions.map((action) => <li key={action.code}>{action.label}</li>)}</ul>
            ) : (
              <p>当前没有额外治理建议。</p>
            )}
          </section>
        </>
      ) : (
        <div className="folio-governance-source-empty"><i /><i /><i /><i /></div>
      )}
    </aside>
  );
}
