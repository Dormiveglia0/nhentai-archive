import type { GovernanceAggregate, GovernanceTag } from "../../lib/api";
import { pageHref } from "../../lib/navigation";
import { GovernanceTagItem } from "./GovernanceTagItem";

export function GovernanceTagBoard({
  aggregate,
  onApplyDictionaryTag,
  onReviewDictionaryTag,
  applyingTagId,
}: {
  aggregate: GovernanceAggregate;
  onApplyDictionaryTag: (tag: GovernanceTag, zhName: string) => Promise<void>;
  onReviewDictionaryTag: (tag: GovernanceTag) => Promise<void>;
  applyingTagId: number | null;
}) {
  return (
    <section id="governance-tags" className="folio-governance-tags">
      <header className="folio-governance-section-head">
        <div>
          <span>Tags</span>
          <h2>标签</h2>
        </div>
        <a className="folio-line-button" href={pageHref({ name: "dictionary" })}>
          管理词典
        </a>
      </header>
      {aggregate.tags.groups.length ? (
        <div className="folio-governance-tag-groups">
          {aggregate.tags.groups.map((group) => (
            <article key={group.key}>
              <h3>{group.label}</h3>
              <div className="folio-governance-tag-list">
                {group.tags.map((tag) => (
                  <GovernanceTagItem
                    key={`${tag.id}-${tag.state}`}
                    tag={tag}
                    busy={applyingTagId === tag.id}
                    onApply={onApplyDictionaryTag}
                    onReview={onReviewDictionaryTag}
                  />
                ))}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="folio-governance-inline-empty">该作品暂无标签。可从词典或重新解析流程补充。</p>
      )}
    </section>
  );
}
