import { ArrowRight, CheckCircle2, Database, FileArchive, Tags } from "lucide-react";

import type { GovernanceAggregate } from "../../lib/api";
import { navigate } from "../../lib/navigation";
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
    <aside className="folio-governance-source" aria-label="当前作品治理清单">
      <header>
        <span>Review checklist</span>
        <h2>处理清单</h2>
        <p>{bulkMode ? "先预览每部作品将发生的变化，再决定是否应用。" : "只列出仍需判断或明确执行的真实问题。"}</p>
      </header>

      {aggregate ? (
        <>
          <section className="folio-governance-source-actions">
            <strong>下一步</strong>
            {aggregate.recommended_actions.length ? (
              <ul>
                {aggregate.recommended_actions.map((action) => (
                  <li key={action.code}>
                    <button type="button" onClick={() => runAction(action.code)}>
                      <span>{action.label}</span>
                      <ArrowRight size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="folio-governance-source-complete">
                <CheckCircle2 size={18} />
                <p>当前作品没有系统待办，仍可人工复核字段。</p>
                <button type="button" onClick={() => navigate({ name: "library" })}>返回我的库</button>
              </div>
            )}
          </section>

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

        </>
      ) : (
        <div className="folio-governance-source-empty"><i /><i /><i /><i /></div>
      )}
    </aside>
  );
}

function runAction(code: string) {
  if (code === "missing_metadata") {
    scrollToSection("governance-metadata");
    return;
  }
  if (code === "dictionary_review") {
    scrollToSection("governance-tags");
    return;
  }
  if (code === "dictionary_conflict") {
    navigate({ name: "dictionary" });
    return;
  }
  if (code === "missing_comicinfo") {
    document.querySelector<HTMLInputElement>(".folio-governance-writeback input")?.focus();
    return;
  }
  if (code === "untagged" || code === "missing_cover") {
    navigate({ name: "files" });
  }
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    block: "start",
  });
}
