import { ArrowUpRight, Check, Download, Heart } from "lucide-react";
import { m } from "motion/react";
import { useState } from "react";
import type { GallerySummary } from "../../lib/api";
import { SelectionStage, usePrefersReducedMotion } from "../../lib/motion";
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
            animate={{ y: reduce ? 0 : i === index ? -22 : Math.abs(i - index) === 1 ? -6 : 0 }}
            transition={reduce ? {duration: 0} : {type: "spring", stiffness: 220, damping: 27}}>
            {item.thumbnail.url ? <AmbientCover className="is-fill-portrait" src={item.thumbnail.url} alt="" privateBlur={blurCovers} loading="lazy" /> : <span className="folio-cover-fallback">暂无封面</span>}
            <span className="popular-rank">{String(i + 1).padStart(2, "0")}</span>
          </m.a>
          <button type="button" className="popular-selector" aria-pressed={index === i} onClick={() => setSelected(item.gallery_id)} aria-label={`预览热门作品 ${i + 1}`}><i /></button>
        </div>)}
      </div>
      <SelectionStage selection={current.gallery_id} className="popular-record">
        <span className="popular-id">#{current.gallery_id}</span>
        <a href={hrefFor(current.gallery_id)} className="popular-title">{title(current)}</a>
        <div className="popular-facts"><span>{current.page_count} 页</span><span><Heart size={14} />{current.favorites.toLocaleString()}</span></div>
        <div className="popular-actions"><a href={hrefFor(current.gallery_id)}>作品详情<ArrowUpRight size={16} /></a>{current.imported ? <span><Check size={15} />已入库</span> : <button type="button" onClick={() => onImport(current.gallery_id)}><Download size={15} />导入</button>}</div>
      </SelectionStage>
    </> : <div className="popular-loading" role="status">正在读取热门作品…</div>}
  </section>;
}
