import type { LibraryWork } from "../../../lib/api";
import { NumberTicker } from "../../effects/NumberTicker";
import { ContinueReadingRow } from "./ContinueReadingRow";
import "./HomeHero.css";

export function HomeHero({ works = [], total, blurCovers = false }: {
  works?: LibraryWork[];
  total?: number;
  blurCovers?: boolean;
}) {
  return (
    <section className="folio-home-hero" aria-label="首页">
      <header className="folio-home-heading">
        <h1>首页</h1>
        <span className="folio-home-edition">{total === undefined ? "—" : <NumberTicker value={total} />} 部作品</span>
      </header>
      {works.length ? <ContinueReadingRow title="最近导入" works={works} blurCovers={blurCovers} /> :
        <div className="folio-home-empty">{total === undefined ? "" : "暂无导入作品"}</div>}
    </section>
  );
}
