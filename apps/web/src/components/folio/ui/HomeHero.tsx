import { ArrowRight, ArrowUpRight, BookOpen, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { LibraryWork } from "../../../lib/api";
import { usePrefersReducedMotion } from "../../../lib/motion";
import { workTitle, workCoverHref } from "../../../lib/format";
import { pageHref } from "../../../lib/navigation";
import "./HomeHero.css";

export function HomeHero({ works = [], blurCovers = true, loading = false }: {
  works?: LibraryWork[]; blurCovers?: boolean; loading?: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  const stage = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [direction, setDirection] = useState(1);
  const [paused, setPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const [failedCovers, setFailedCovers] = useState<number[]>([]);
  const swiped = useRef(false);
  const index = Math.max(0, works.findIndex(work => work.id === selectedId));
  const featured = works[index];
  const progress = Math.min(100, Math.max(0, featured?.progress_percent ?? 0));
  const readHref = featured ? pageHref({ name: "reader", workId: featured.id }) : "#library";
  function change(step: number) {
    if (works.length < 2) return;
    setDirection(step); setSelectedId(works[(index + step + works.length) % works.length].id);
  }
  useEffect(() => {
    if (works.length < 2 || reduced || paused || interacting) return;
    const timer = window.setInterval(() => {
      const current = stage.current?.closest(".folio-home-current");
      if (document.hidden || stage.current?.closest("[inert]") || current?.contains(document.activeElement) || current?.matches(":hover")) return;
      const bounds = stage.current?.getBoundingClientRect();
      if (!bounds || Math.min(bounds.bottom, innerHeight) - Math.max(bounds.top, 0) < bounds.height * .6) return;
      setDirection(1); setSelectedId(value => works[(Math.max(0, works.findIndex(work => work.id === value)) + 1) % works.length].id);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [works, reduced, paused, interacting]);
  return <section className={"folio-home" + (featured ? "" : " is-empty")} aria-label="阅读与最近作品" aria-busy={loading}>
    <div className="folio-home-hero">
      {featured ? <section className="folio-home-current" aria-label="阅读作品轮播">
        <m.div ref={stage} className="folio-home-carousel" onHoverStart={() => setInteracting(true)} onHoverEnd={() => setInteracting(false)}
          onFocusCapture={() => setInteracting(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setInteracting(false); }}
          onPointerDown={() => { swiped.current = false; }} onPointerCancel={() => { swiped.current = false; setInteracting(false); }}
          onPanStart={() => { swiped.current = false; setInteracting(true); }}
          onPanEnd={(_, info) => { if (works.length > 1 && Math.abs(info.offset.x) > 45) { swiped.current = true; change(info.offset.x < 0 ? 1 : -1); } setInteracting(false); }}
          onClickCapture={event => { if (swiped.current && event.detail !== 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); event.stopPropagation(); swiped.current = false; } }}>
          <AnimatePresence initial={false} custom={direction} mode="popLayout">
            <m.article key={featured.id} custom={direction} className="folio-home-book folio-home-featured" data-work-id={featured.id}
              variants={{ enter: (step: number) => ({ opacity: 0, x: step * 80, scale: .97 }), visible: { opacity: 1, x: 0, scale: 1 }, leave: (step: number) => ({ opacity: 0, x: step * -80, scale: .97 }) }}
              initial={reduced || document.documentElement.dataset.folioSlide ? false : "enter"} animate="visible" exit="leave" transition={{ duration: reduced ? 0 : .38, ease: [.22, .8, .25, 1] }}>
              <div className="folio-home-cover-slot">
                <a className="folio-home-cover" href={readHref} aria-label={"阅读 " + workTitle(featured)}>
                  {featured.cover_path && !failedCovers.includes(featured.id) ? <img src={workCoverHref(featured, 768)} alt="作品封面" className={blurCovers ? "is-private" : ""} decoding="async" draggable={false}
                    onLoad={event => { event.currentTarget.dataset.ready = "true"; }}
                    onError={() => setFailedCovers(value => [...value, featured.id])} /> : <span className="folio-home-cover-empty">{failedCovers.includes(featured.id) ? "封面读取失败" : "暂无封面"}</span>}
                </a>
                {failedCovers.includes(featured.id) ? <button className="folio-home-cover-retry" type="button" onClick={() => setFailedCovers(value => value.filter(id => id !== featured.id))}>重新加载封面</button> : null}
              </div>
            </m.article>
          </AnimatePresence>
        </m.div>
        <div className="folio-home-featured-copy">
          <a className="folio-home-book-title" href={readHref} title={workTitle(featured)}>{workTitle(featured)}</a>
          <div className="folio-home-reading-progress"><span>{featured.completed ? "已读完" : progress > 0 ? "第 " + (featured.reader_page_index || 1) + " 页" : "尚未阅读"}</span><span>{featured.page_count} 页</span>
            <svg viewBox="0 0 100 2" preserveAspectRatio="none" fill="none" role="progressbar" aria-label="阅读进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
              <path className="folio-home-progress-track" d="M0 1H100" /><m.path d="M0 1H100" pathLength="1" initial={false} animate={{ pathLength: progress / 100 }} transition={{ duration: reduced ? 0 : .25 }} />
            </svg>
          </div>
        </div>
        <nav className="folio-home-carousel-controls" aria-label="作品轮播控制">
          <button type="button" aria-label="上一部作品" disabled={works.length < 2} onClick={() => change(-1)}><ChevronLeft size={18} /></button>
          <span aria-live={paused || interacting || reduced ? "polite" : "off"}>{index % works.length + 1} / {works.length}</span>
          <button type="button" aria-label="下一部作品" disabled={works.length < 2} onClick={() => change(1)}><ChevronRight size={18} /></button>
          {!reduced && works.length > 1 ? <button type="button" aria-label={paused ? "播放轮播" : "暂停轮播"} aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? <Play size={15} /> : <Pause size={15} />}</button> : null}
          <a href="#history">阅读历史<ArrowUpRight size={15} /></a>
        </nav>
      </section> : loading ? <section className="folio-home-current" aria-label="正在读取阅读作品">
        <div className="folio-home-cover-slot" role="status"><BookOpen size={42} strokeWidth={1} /><span>正在读取作品…</span></div>
        <div className="folio-home-featured-copy" aria-hidden="true"><span className="folio-home-book-title" /><div className="folio-home-reading-progress" /></div>
        <div className="folio-home-carousel-placeholder" aria-hidden="true" />
      </section> : <div ref={stage} className="folio-home-empty"><BookOpen size={42} strokeWidth={1} aria-hidden="true" /><h1>库里还没有作品</h1><div className="folio-home-entry"><a href="#discover">发现作品<ArrowRight size={18} /></a><a href="#files">扫描本地文件<ArrowUpRight size={16} /></a></div></div>}
    </div>
  </section>;
}
