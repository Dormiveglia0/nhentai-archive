import { AlertTriangle, CheckCircle2 } from "lucide-react";

import type { GovernanceAggregate } from "../../lib/api";
import { workTitle } from "../../lib/format";

export function GovernanceWorkHeader({
  aggregate,
  blurCovers,
}: {
  aggregate: GovernanceAggregate;
  blurCovers: boolean;
}) {
  const issueCount = aggregate.recommended_actions.length;
  const tone = !issueCount ? "ok" : aggregate.tags.summary.conflicts > 0 ? "bad" : "warn";

  const cover = (
    <div className="folio-governance-work-cover">
      {aggregate.work.cover_path ? (
        <img className={blurCovers ? "folio-media-blurred" : ""} src={`/api/works/${aggregate.work.id}/cover`} alt="" />
      ) : (
        <span className="folio-cover-fallback">NO COVER</span>
      )}
    </div>
  );

  return (
    <header className={`folio-governance-work tone-${tone}`}>
      <div className={issueCount ? "folio-governance-cover-frame is-active" : "folio-governance-cover-frame"}>{cover}</div>
      <div className="folio-governance-work-copy">
        <h2>{workTitle(aggregate.work)}</h2>
        <p>{aggregate.work.title_japanese || aggregate.work.pretty_title || "本地最终标题待确认"}</p>

        <div className="folio-governance-review-state" data-tone={tone}>
          {issueCount ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          <span>系统检查</span>
          <strong>{issueCount ? `${issueCount} 项提示` : "未发现规则问题"}</strong>
        </div>
      </div>
    </header>
  );
}
