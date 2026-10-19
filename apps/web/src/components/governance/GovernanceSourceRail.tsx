import { ArrowRight, CheckCircle2, Database, FileArchive, Tags } from "lucide-react";

import type { GovernanceAggregate } from "../../lib/api";
import { goBack, navigate, pageHref } from "../../lib/navigation";
import { SourceRenameControl } from "./SourceRenameControl";
import { formatBytes } from "../../lib/format";

export function GovernanceSourceRail({
  aggregate, onReload, disabled,
}: {
  aggregate: GovernanceAggregate;
  onReload: () => void;
  disabled: boolean;
}) {
  const sourceFile = aggregate.files.find((file) => file.kind === "source_cbz");

  return (
    <aside className="folio-governance-source" aria-label="当前作品整理清单">
      <header>
        <h2>处理清单</h2>
      </header>

      <>
          <section className="folio-governance-source-actions">
            <strong>下一步</strong>
            {aggregate.recommended_actions.length ? (
              <ul>
                {aggregate.recommended_actions.map((action) => (
                  <li key={action.code}>
                    {actionHref(action.code) ? (
                      <a href={actionHref(action.code)}><span>{action.label}</span><ArrowRight size={14} /></a>
                    ) : (
                      <button type="button" onClick={() => runAction(action.code)}><span>{action.label}</span><ArrowRight size={14} /></button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="folio-governance-source-complete">
                <CheckCircle2 size={18} />
                <p>当前作品没有系统待办，仍可人工复核字段。</p>
                <button type="button" onClick={goBack}>返回我的库</button>
              </div>
            )}
          </section>

          <dl className="folio-governance-source-facts">
            <div><dt><Database size={14} />来源</dt><dd>{aggregate.work.remote_gallery_id ? "远端绑定" : "本地作品"}</dd></div>
            <div><dt>Gallery ID</dt><dd>{aggregate.work.remote_gallery_id || "—"}</dd></div>
            <div><dt>页数</dt><dd>{aggregate.work.page_count}P</dd></div>
            <div><dt><FileArchive size={14} />源文件</dt><dd>{sourceFile?.exists ? formatBytes(sourceFile.size_bytes) : "不可用"}</dd></div>
          </dl>

          <SourceRenameControl key={aggregate.work.id} files={aggregate.files.filter(file => file.kind === "source_cbz")} workId={aggregate.work.id} disabled={disabled} onRenamed={onReload} />

          <section className="folio-governance-source-tags">
            <div><Tags size={15} /><strong>词典状态</strong></div>
            <span><em>已映射</em><b>{aggregate.dictionary.matched}</b></span>
            <span><em>保留原名</em><b>{aggregate.dictionary.preserved}</b></span>
            <span className={aggregate.dictionary.unmapped ? "is-alert" : ""}><em>未映射</em><b>{aggregate.dictionary.unmapped}</b></span>
            <span><em>待复核</em><b>{aggregate.dictionary.review}</b></span>
            <span className={aggregate.dictionary.conflicts ? "is-alert" : ""}><em>冲突</em><b>{aggregate.dictionary.conflicts}</b></span>
          </section>

      </>
    </aside>
  );
}

function runAction(code: string) {
  if (code === "missing_metadata") {
    scrollToSection("governance-metadata");
    return;
  }
  if (code === "dictionary_unmapped" || code === "dictionary_review") {
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
  if (code === "untagged" || code === "missing_source" || code === "missing_cover") {
    navigate({ name: "files" });
  }
}

function actionHref(code: string) {
  if (code === "dictionary_conflict") return pageHref({ name: "dictionary" });
  if (code === "untagged" || code === "missing_source" || code === "missing_cover") return pageHref({ name: "files" });
  return undefined;
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    block: "start",
  });
}
