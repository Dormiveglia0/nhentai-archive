import { Check, Download, Heart } from "lucide-react";
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
    {current ? <>
      <div className="popular-array" role="list">
        {visible.map((item, i) => <div className="popular-slot" role="listitem" key={item.gallery_id}>
          <m.a className={`popular-cover${i === index ? " is-selected" : ""}`} href={hrefFor(item.gallery_id)}
            aria-label={`打开作品详情：${title(item)}`}
            onFocus={() => setSelected(item.gallery_id)} onPointerEnter={event => { if (event.pointerType === "mouse") setSelected(item.gallery_id); }}
            onClick={event => { if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return; event.preventDefault(); onOpen(item.gallery_id); }}
            animate={{ y: reduce ? 0 : i === index ? -12 : Math.abs(i - index) === 1 ? -3 : 0 }}
            transition={reduce ? {duration: 0} : {type: "spring", stiffness: 220, damping: 27}}>
            {item.thumbnail.url ? <AmbientCover className="is-fill-portrait" src={item.thumbnail.url} alt="" privateBlur={blurCovers} loading="lazy" /> : <span className="folio-cover-fallback">暂无封面</span>}
          </m.a>
          <div className="popular-caption"><div><span>{String(i+1).padStart(2,"0")}</span><small><Heart size={12}/>{item.favorites.toLocaleString()}</small></div><a href={hrefFor(item.gallery_id)}>{title(item)}</a><footer><span>{item.page_count} 页</span>{item.imported?<span><Check size={14}/>已入库</span>:<button type="button" onClick={()=>onImport(item.gallery_id)} aria-label={`导入热门作品 ${i+1}`}><Download size={15}/>导入</button>}</footer></div>
        </div>)}
      </div>

    </> : <div className="popular-loading" role="status">正在读取热门作品…</div>}
  </section>;
}
