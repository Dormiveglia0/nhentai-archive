import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { m } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import type { LibrarySummary, LibraryWork, ReadingStatistics } from "../../lib/api";
import { workTitle } from "../../lib/format";
import { usePrefersReducedMotion } from "../../lib/motion";
import { pageHref } from "../../lib/navigation";
import { NumberTicker } from "../effects/NumberTicker";
import { AmbientCover } from "../folio/ui/AmbientCover";
import "./ReadingHome.css";

export function ReadingHome({ summary, statistics, works, blurCovers }: { summary?: LibrarySummary; statistics?: ReadingStatistics; works: LibraryWork[]; blurCovers: boolean }) {
  const reduced = usePrefersReducedMotion(), id = useId();
  const root = useRef<HTMLElement>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [paused, setPaused] = useState(false);
  const [inactive, setInactive] = useState(document.hidden);
  const activity = statistics?.activity ?? [];
  const last = activity.reduce((last, item, i) => item.seconds > 0 ? i : last, Math.max(0, activity.length - 1));
  const index = Math.max(0, Math.min(selected ?? last, activity.length - 1)), day = activity[index];
  const maximum = Math.max(1, ...activity.map(item => item.seconds));

  const spring = reduced ? { duration: 0 } : { type: "spring" as const, stiffness: 95, damping: 23, mass: 1.1 };
  useEffect(() => {
    let visible = true;
    const update = () => setInactive(document.hidden || !visible);
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); });
    if (root.current) observer.observe(root.current);
    document.addEventListener("visibilitychange", update);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", update); };
  }, []);
  const select = (value: number) => setSelected(Math.max(0, Math.min(activity.length - 1, value)));
  return <section ref={root} className={`reading-home${paused || inactive || reduced ? " is-still" : ""}${inspecting ? " is-inspecting" : ""}`} aria-label="首页">
    <header className="reading-home-head">
      <div><h1>首页</h1><span>{statistics?.period.start_date ?? "—"} — {statistics?.period.end_date ?? "—"}</span></div>
      <div className="reading-period-total"><span>近 30 天</span><strong>{statistics ? <NumberTicker value={Math.round(statistics.overview.total_seconds / 60)} /> : "—"}<small>分钟</small></strong></div>
      <button type="button" className="reading-motion-toggle" onClick={() => setPaused(!paused)} aria-label={paused ? "播放动效" : "暂停动效"} aria-pressed={paused}>{paused ? <Play size={15} /> : <Pause size={15} />}</button>
    </header>
    <div className="reading-spatial-field">
      <div className="reading-array-viewport">
        <div className="reading-chart-heading"><span>每日阅读时长</span><span>{Math.round(maximum / 60)} 分钟 / 峰值</span></div>
        <m.div className="reading-array-camera" initial={false} animate={{ rotateX: inspecting ? 0 : 16, rotateY: inspecting ? 0 : -12 }} transition={spring}>
          <div className="reading-chart-grid" aria-hidden="true"><span/><span/><span/><span/></div>
          {activity.map((item, i) => {
            const active = i === index;
            const height = 12 + item.seconds / maximum * 220;
            return <m.div key={item.date} className={`reading-leaf-slot${active ? " is-selected" : ""}`} initial={false} animate={{ y: active ? -22 : Math.abs(i-index) === 1 ? -8 : 0 }} transition={spring}>
              <button type="button" className={`reading-slice${active ? " is-selected" : ""}`} data-date={item.date} aria-label={`${item.date}，阅读 ${Math.round(item.seconds / 60)} 分钟`} aria-pressed={active} tabIndex={active ? 0 : -1}
                onClick={() => select(i)}
                onKeyDown={event => {
                  if (event.key === "Escape") { setInspecting(false); return; }
                  const delta = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
                  if (delta) { event.preventDefault(); const next = Math.max(0, Math.min(activity.length - 1, index + delta)); select(next); root.current?.querySelectorAll<HTMLButtonElement>(".reading-slice")[next]?.focus({ preventScroll: true }); }
                }}>
                <span className="reading-column-value">{Math.round(item.seconds / 60)}</span>
                <m.span className="reading-column" initial={false} animate={{ height }} transition={spring}><i/><i/><i/></m.span>
                <span className="reading-column-date">{item.date.slice(8)}</span>
              </button>
            </m.div>;
          })}
        </m.div>
        <div className="reading-chart-range"><span>{activity[0]?.date ?? "—"}</span><span>{activity[activity.length - 1]?.date ?? "—"}</span></div>
        <div className="reading-activity-caption"><span>近 30 天</span><strong>{statistics?.overview.active_days ?? "—"}<small>天有阅读</small></strong><div className="reading-day-marks" aria-hidden="true">{activity.map(item=><i key={item.date} className={item.seconds ? "is-active" : ""}/>)}</div></div>
      </div>
      {!day && <p className="reading-array-empty">{statistics ? "暂无阅读记录" : "正在读取阅读记录…"}</p>}
      <aside className="reading-day-document">
        <div className="reading-day-eyebrow"><span>{day?.date.slice(0, 4) ?? "—"}</span><span>{String(index + 1).padStart(2, "0")} / {activity.length || "—"}</span></div>
        <div className="reading-dial-center" aria-live="polite" aria-atomic="true"><strong>{day?.date.slice(5).replace("-", " / ") ?? "—"}</strong><div><b>{day ? <NumberTicker value={Math.round(day.seconds / 60)} /> : "—"}</b><span>分钟</span></div><dl><div><dt>阅读作品</dt><dd>{day?.works ?? "—"}</dd></div><div><dt>阅读次数</dt><dd>{day?.sessions ?? "—"}</dd></div></dl></div>
        <button className="reading-inspect" type="button" disabled={!day} onClick={() => setInspecting(value => !value)} aria-expanded={inspecting}>{inspecting ? <><ArrowDownLeft size={20} />返回总览</> : <>展开记录<ArrowUpRight size={20} /></>}</button>
        <div className="reading-date-control"><button type="button" aria-label="前一天" disabled={!day || index === 0} onClick={() => select(index - 1)}><ChevronLeft size={20} /></button><label htmlFor={`${id}-date`}>选择日期<input id={`${id}-date`} type="range" min="0" max={Math.max(0, activity.length - 1)} value={index} disabled={!day} aria-valuetext={day ? `${day.date}，阅读 ${Math.round(day.seconds / 60)} 分钟` : "暂无记录"} onChange={event => select(Number(event.target.value))} /></label><button type="button" aria-label="后一天" disabled={!day || index === activity.length - 1} onClick={() => select(index + 1)}><ChevronRight size={20} /></button></div>
      </aside>
    </div>
    <footer className="reading-home-foot">
      <div className="reading-library-count"><span>我的库</span><strong>{summary?.total ?? "—"}<small>部作品</small></strong><span>在读 {summary?.reading ?? "—"} / 已读 {summary?.completed ?? "—"}</span></div>
      {works.length > 0 && <section className="reading-latest"><h2>最近添加</h2>{works.slice(0, 3).map(work => <a key={work.id} href={pageHref({ name: "reader", workId: work.id })}>{work.cover_path ? <AmbientCover src={`/api/works/${work.id}/cover?w=256`} alt="" className="is-fill-portrait" privateBlur={blurCovers} loading="lazy" /> : null}<span><strong>{workTitle(work)}</strong><small>{work.page_count} 页</small></span><ArrowUpRight size={16} /></a>)}</section>}
    </footer>
  </section>;
}
