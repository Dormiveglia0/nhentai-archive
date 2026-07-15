import type { GovernanceAggregate, GovernanceTag } from "../../lib/api";
import { navigate, tagSearchHref } from "../../lib/navigation";

export function GovernanceTagBoard({
  aggregate,
  onApplyDictionaryTag,
  applyingTagId,
}: {
  aggregate: GovernanceAggregate;
  onApplyDictionaryTag: (tag: GovernanceTag) => Promise<void>;
  applyingTagId: number | null;
}) {
  return (
    <section id="governance-tags" className="folio-governance-tags">
      <header className="folio-governance-section-head">
        <div>
          <span>Tags</span>
          <h2>标签</h2>
        </div>
        <button className="folio-line-button" type="button" onClick={() => navigate({ name: "dictionary" })}>
          管理词典
        </button>
      </header>
      {aggregate.tags.groups.length ? (
        <div className="folio-governance-tag-groups">
          {aggregate.tags.groups.map((group) => (
            <article key={group.key}>
              <h3>{group.label}</h3>
              <div className="folio-governance-tag-list">
                {group.tags.map((tag) => (
                  <span key={tag.id} className={`folio-governance-tag is-${tag.state}`}>
                    <a href={tagSearchHref({ id: tag.remote_tag_id, type: tag.type, name: tag.name, slug: tag.slug, display: tag.display })}>{tag.display}</a>
                    {tag.state === "conflict" ? (
                      <button type="button" onClick={() => navigate({ name: "dictionary" })}>
                        去词典
                      </button>
                    ) : tag.state === "pending" && tag.remote_tag_id ? (
                      <button type="button" disabled={applyingTagId === tag.id} onClick={() => void onApplyDictionaryTag(tag)}>
                        {applyingTagId === tag.id ? "确认中" : "确认"}
                      </button>
                    ) : null}
                  </span>
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
