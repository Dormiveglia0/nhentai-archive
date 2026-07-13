import type { GovernanceAggregate } from "../../lib/api";
import { NumberTicker } from "../effects/NumberTicker";
import { workTitle } from "../library/libraryHelpers";

export function GovernanceWorkHeader({
  aggregate,
  blurCovers,
}: {
  aggregate: GovernanceAggregate;
  blurCovers: boolean;
}) {
  const complete = aggregate.completeness_percent >= 100;
  const tone = complete ? "ok" : aggregate.tags.summary.conflicts > 0 ? "bad" : "warn";

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
      <div className={complete ? "folio-governance-cover-frame" : "folio-governance-cover-frame is-active"}>{cover}</div>
      <div className="folio-governance-work-copy">
        <h2>{workTitle(aggregate.work)}</h2>
        <p>{aggregate.work.title_japanese || aggregate.work.pretty_title || "本地最终标题待确认"}</p>

        <div className="folio-governance-completeness">
          <span>完整度</span>
          <span
            className="folio-governance-completeness-track"
            role="progressbar"
            aria-label="当前作品元数据完整度"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={aggregate.completeness_percent}
          >
            <span data-tone={tone} style={{ width: `${aggregate.completeness_percent}%` }} />
          </span>
          <strong>
            <NumberTicker value={aggregate.completeness_percent} format={(n) => `${Math.round(n)}%`} />
          </strong>
        </div>
      </div>
    </header>
  );
}
