import type { GovernanceAggregate, GovernanceTag } from "../../lib/api";
import { navigate } from "../../lib/navigation";

export function GovernanceTagBoard({
  aggregate,
  onApplyDictionaryTag,
}: {
  aggregate: GovernanceAggregate;
  onApplyDictionaryTag: (tag: GovernanceTag) => Promise<void>;
}) {
  return (
    <section className="governance-tags governance-panel">
      <div className="governance-panel-head">
        <div>
          <span className="eyebrow">Tags</span>
          <h2>标签</h2>
        </div>
        <button type="button" onClick={() => navigate({ name: "dictionary" })}>
          管理词典
        </button>
      </div>
      {aggregate.tags.groups.length ? (
        <div className="tag-governance-groups">
          {aggregate.tags.groups.map((group) => (
            <article key={group.key}>
              <h3>{group.label}</h3>
              <div className="governance-tag-wrap">
                {group.tags.map((tag) => (
                  <span key={tag.id} className={`governance-tag ${tag.state === "conflict" ? "conflict" : ""}`}>
                    {tag.display}
                    {tag.state === "conflict" ? (
                      <button type="button" onClick={() => navigate({ name: "dictionary" })}>
                        去词典
                      </button>
                    ) : tag.state === "pending" && tag.remote_tag_id ? (
                      <button type="button" onClick={() => void onApplyDictionaryTag(tag)}>
                        确认
                      </button>
                    ) : null}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-inline">该作品暂无标签。可从词典或重新解析流程补充。</p>
      )}
    </section>
  );
}
