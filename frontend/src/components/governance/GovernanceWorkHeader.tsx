import type { GovernanceAggregate } from "../../lib/api";
import { NumberTicker } from "../effects/NumberTicker";
import { ShineBorder } from "../effects/ShineBorder";
import { formatBytes, workTitle } from "../library/libraryHelpers";

export function GovernanceWorkHeader({
  aggregate,
  blurCovers,
}: {
  aggregate: GovernanceAggregate;
  blurCovers: boolean;
}) {
  const sourceFile = aggregate.files.find((file) => file.kind === "source_cbz");
  const complete = aggregate.completeness_percent >= 100;
  const tone = complete ? "ok" : aggregate.tags.summary.conflicts > 0 ? "bad" : "warn";

  const cover = (
    <div className="governance-cover">
      {aggregate.work.cover_path ? (
        <img className={blurCovers ? "blurred" : ""} src={`/api/works/${aggregate.work.id}/cover`} alt="" />
      ) : (
        <span>无封面</span>
      )}
    </div>
  );

  return (
    <header className={`governance-work-header tone-${tone}`}>
      {complete ? cover : <ShineBorder>{cover}</ShineBorder>}
      <div className="governance-title-block">
        <h2>{workTitle(aggregate.work)}</h2>
        <p>{aggregate.work.title_japanese || aggregate.work.pretty_title || "本地最终标题待确认"}</p>

        <div className="governance-completeness">
          <span className="governance-completeness-label">完整度</span>
          <span className="governance-completeness-bar" aria-hidden="true">
            <span data-tone={tone} style={{ width: `${aggregate.completeness_percent}%` }} />
          </span>
          <strong>
            <NumberTicker value={aggregate.completeness_percent} format={(n) => `${Math.round(n)}%`} />
          </strong>
        </div>

        <dl className="governance-header-facts">
          <div>
            <dt>来源</dt>
            <dd>{aggregate.work.source === "remote" ? "远端入库" : "本地导入"}</dd>
          </div>
          <div>
            <dt>Gallery ID</dt>
            <dd>{aggregate.work.remote_gallery_id || "-"}</dd>
          </div>
          <div>
            <dt>页数</dt>
            <dd>{aggregate.work.page_count}P</dd>
          </div>
          <div>
            <dt>文件大小</dt>
            <dd>{formatBytes(sourceFile?.size_bytes)}</dd>
          </div>
        </dl>

        <div className="governance-stat-chips">
          <span className="governance-stat-chip">
            标签已确认 <NumberTicker value={aggregate.tags.summary.confirmed} />
          </span>
          <span className="governance-stat-chip" data-tone={aggregate.tags.summary.pending > 0 ? "warn" : undefined}>
            待确认 <NumberTicker value={aggregate.tags.summary.pending} />
          </span>
          <span className="governance-stat-chip" data-tone={aggregate.tags.summary.conflicts > 0 ? "bad" : undefined}>
            冲突 <NumberTicker value={aggregate.tags.summary.conflicts} />
          </span>
          <span className="governance-stat-chip">
            词典命中 <NumberTicker value={aggregate.dictionary.matched} />
          </span>
        </div>
      </div>
    </header>
  );
}
