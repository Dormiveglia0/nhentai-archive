import { useState } from "react";

import type { GovernanceTag } from "../../lib/api";
import { navigate, tagSearchHref } from "../../lib/navigation";

type Props = {
  tag: GovernanceTag;
  busy: boolean;
  onApply: (tag: GovernanceTag, zhName: string) => Promise<void>;
  onReview: (tag: GovernanceTag) => Promise<void>;
};

export function GovernanceTagItem({ tag, busy, onApply, onReview }: Props) {
  const [editing, setEditing] = useState(false);
  const [zhName, setZhName] = useState("");

  return (
    <span className={`folio-governance-tag is-${tag.state}${editing ? " is-editing" : ""}`}>
      <a href={tagSearchHref({ id: tag.remote_tag_id, type: tag.type, name: tag.name, slug: tag.slug, display: tag.display })}>{tag.display}</a>
      {tag.state === "conflict" ? (
        <button type="button" onClick={() => navigate({ name: "dictionary" })}>解决冲突</button>
      ) : tag.state === "pending" && tag.dictionary_id ? (
        <button type="button" disabled={busy} onClick={() => void onReview(tag)}>{busy ? "确认中" : "确认译名"}</button>
      ) : tag.state === "unmapped" && tag.remote_tag_id ? (
        <button type="button" disabled={busy} onClick={() => setEditing((value) => !value)}>{editing ? "收起" : "设置译名"}</button>
      ) : null}
      {editing ? (
        <span className="folio-governance-tag-mapper">
          <input
            type="text"
            value={zhName}
            placeholder="本地显示名"
            aria-label={`为 ${tag.display} 设置本地显示名`}
            onChange={(event) => setZhName(event.target.value)}
          />
          <button type="button" disabled={busy || !zhName.trim()} onClick={() => void onApply(tag, zhName)}>
            {busy ? "保存中" : "保存映射"}
          </button>
        </span>
      ) : null}
    </span>
  );
}
