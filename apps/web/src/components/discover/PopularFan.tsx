import { Check, Download, Heart, ArrowUpRight } from "lucide-react";
import { m } from "motion/react";
import { useState } from "react";
import type { GallerySummary } from "../../lib/api";
import { usePrefersReducedMotion } from "../../lib/motion";
import { AmbientCover } from "../folio/ui/AmbientCover";
import "./PopularFan.css";

type Props = { loading: boolean; items: GallerySummary[]; blurCovers: boolean; onOpen: (id: number) => void; hrefFor: (id: number) => string; onImport: (id: number) => void };
export function PopularFan({ loading, items, blurCovers, onOpen, hrefFor, onImport }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const reduce = usePrefersReducedMotion();
  const visible = items.slice(0, 5);
  const index = Math.max(0, visible.findIndex(item => item.gallery_id === selected));
  const current = visible[index];
  if (!loading && !current) return null;
  const title = (item: GallerySummary) => item.title_japanese || item.pretty_title || item.title || `Gallery ${item.gallery_id}`;
  return <section className="popular-studio" aria-label="今日热门">
    <header><h2>今日热门</h2><span>{current ? `${String(index + 1).padStart(2, "0")} / ${String(visible.length).padStart(2, "0")}` : "读取中…"}</span></header>
    {current ? <div className="popular-composition">
      <div className="popular-array" role="list" onKeyDown={event => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const next = Math.max(0, Math.min(visible.length - 1, index + (event.key === "ArrowRight" ? 1 : -1)));
        setSelected(visible[next].gallery_id);
        event.currentTarget.querySelectorAll<HTMLButtonElement>(".popular-position")[next]?.focus({preventScroll:true});
      }}>
        {visible.map((item, i) => <div className={`popular-slot${i === index ? " is-selected" : ""}`} role="listitem" key={item.gallery_id}>
          <m.a className={`popular-cover${i === index ? " is-selected" : ""}`} href={hrefFor(item.gallery_id)}
            aria-label={`打开作品详情：${title(item)}`} onFocus={() => setSelected(item.gallery_id)}
            onClick={event => { if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return; event.preventDefault(); onOpen(item.gallery_id); }}
            animate={{ y: reduce ? 0 : i === index ? -8 : 0, rotate: 0 }}
            transition={reduce ? {duration: 0} : {type: "spring", stiffness: 150, damping: 23}}>
            {item.thumbnail.url ? <AmbientCover className="is-fill-portrait" src={item.thumbnail.url} alt="" privateBlur={blurCovers} loading="lazy" /> : <span className="folio-cover-fallback">暂无封面</span>}
          </m.a>
          <button type="button" className="popular-position" aria-label={`选择热门作品 ${i+1}`} aria-pressed={i===index} onClick={()=>setSelected(item.gallery_id)}><span>{String(i+1).padStart(2,"0")}</span><i/></button>
        </div>)}
      </div>
      <aside className="popular-caption" aria-live="polite"><div><span>{String(index+1).padStart(2,"0")}</span><small><Heart size={13}/>{current.favorites.toLocaleString()}</small></div><a href={hrefFor(current.gallery_id)}>{title(current)}</a><footer><span>{current.page_count} 页</span>{current.imported?<span><Check size={14}/>已入库</span>:<button type="button" onClick={()=>onImport(current.gallery_id)} aria-label={`导入热门作品 ${index+1}`}><Download size={15}/>导入</button>}</footer><a className="popular-detail-link" href={hrefFor(current.gallery_id)}>作品详情<ArrowUpRight size={18}/></a></aside>
    </div> : <div className="popular-loading" role="status">正在读取热门作品…</div>}
  </section>;
}
