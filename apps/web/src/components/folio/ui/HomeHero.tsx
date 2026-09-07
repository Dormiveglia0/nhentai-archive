import { ArrowUpRight } from "lucide-react";
import type { LibraryWork } from "../../../lib/api";
import { workTitle } from "../../../lib/format";
import { pageHref } from "../../../lib/navigation";
import { NumberTicker } from "../../effects/NumberTicker";
import type { FolioPageId } from "../config";
import { AmbientCover } from "./AmbientCover";
import "./HomeHero.css";

export function HomeHero({ works = [], total, blurCovers = false, onNavigate }: {
  works?: LibraryWork[];
  total?: number;
  blurCovers?: boolean;
  onNavigate?: (page: FolioPageId) => void;
}) {
  return (
    <section className="folio-home-hero" aria-label="首页">
      <div className="folio-home-intro">
        <img className="folio-home-mark" src="/icon.svg" alt="" width="44" height="44" />
        <h1><span>NH</span>Archive<span className="folio-home-period">.</span></h1>
        <div className="folio-home-edition"><span>私人馆藏</span><span>{total === undefined ? "—" : <NumberTicker value={total} />} 部作品</span></div>
        <nav aria-label="首页入口">
          {([{ id: "library", label: "我的库" }, { id: "discover", label: "发现作品" }] as const).map(item => (
            <a key={item.id} href={`#${item.id}`} onClick={event => {
              if (onNavigate && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onNavigate(item.id); }
            }}>{item.label}<ArrowUpRight size={20} /></a>
          ))}
        </nav>
      </div>
      <div className="folio-home-exhibit" aria-label="最近入藏作品">
        <svg className="folio-home-orbit" viewBox="0 0 640 460" aria-hidden="true"><ellipse cx="320" cy="240" rx="290" ry="170" /><path d="M24 402h592M320 25v18M604 232h18M18 232h18" /></svg>
        {works.length ? <div className={`folio-home-covers count-${Math.min(works.length, 3)}`}>
          {works.slice(0, 3).map(work => <a key={work.id} href={pageHref({ name: "reader", workId: work.id })} aria-label={workTitle(work)}>
            <AmbientCover className="is-fill-portrait" src={`/api/works/${work.id}/cover?w=512`} alt="" privateBlur={blurCovers} />
          </a>)}
        </div> : <svg className="folio-home-empty-art" viewBox="0 0 200 200" aria-hidden="true"><path d="M35 44q35-12 65 8 30-20 65-8v118q-35-12-65 8-30-20-65-8ZM100 52v118M48 65q21-5 38 5M114 70q17-10 38-5" /></svg>}
      </div>
    </section>
  );
}
