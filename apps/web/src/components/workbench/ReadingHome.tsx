import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { m } from "motion/react";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
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
  const column = Math.floor(index / 10), row = index % 10;
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
      <div><h1>阅读记录</h1><span>{statistics?.period.start_date ?? "—"} — {statistics?.period.end_date ?? "—"}</span></div>
      <div className="reading-period-total"><span>近 30 天</span><strong>{statistics ? <NumberTicker value={Math.round(statistics.overview.total_seconds / 60)} /> : "—"}<small>分钟</small></strong><span>{statistics?.overview.active_days ?? "—"} 天有阅读</span></div>
      <button type="button" className="reading-motion-toggle" onClick={() => setPaused(!paused)} aria-label={paused ? "播放动效" : "暂停动效"} aria-pressed={paused}>{paused ? <Play size={15} /> : <Pause size={15} />}</button>
    </header>
    <div className="reading-spatial-field">
      <div className="reading-array-viewport"><div className="reading-array-scale">
        <m.div className="reading-array-camera" initial={false} animate={inspecting ? { rotateX: 0, rotateZ: 0, x: 220 - column * 236, y: 180 - row * 54, scale: 1.18 } : { rotateX: 52, rotateZ: -28, x: 0, y: 0, scale: 1 }} transition={spring}>
          {activity.map((item, i) => {
            const lane = Math.floor(i / 10), slot = i % 10, active = i === index;
            const distance = Math.abs(slot - row) + Math.abs(lane - column) * 2;
            const lift = active ? 100 : 40 * Math.exp(-distance * distance / 8);
            return <m.div key={item.date} className={`reading-leaf-slot${active ? " is-selected" : ""}`} style={{ left: lane * 236, top: slot * 54, zIndex: active ? 50 : slot }} initial={reduced ? false : { z: -120, opacity: 0 }} animate={{ z: inspecting ? active ? 160 : -340 : lift, opacity: inspecting && !active ? .12 : 1, rotateX: inspecting && active ? 0 : -64 }} transition={spring}>
              <div className="reading-leaf-drift" style={{ "--leaf-phase": `${-i * .37}s` } as CSSProperties}>
                <button type="button" className={`reading-slice${active ? " is-selected" : ""}`} data-date={item.date} aria-label={`${item.date}，阅读 ${Math.round(item.seconds / 60)} 分钟`} aria-pressed={active} tabIndex={active ? 0 : -1}
                  onClick={() => { if (active) setInspecting(value => !value); else select(i); }}
                  onKeyDown={event => {
                    if (event.key === "Escape") { setInspecting(false); return; }
                    const delta = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
                    if (delta) { event.preventDefault(); const next = Math.max(0, Math.min(activity.length - 1, index + delta)); select(next); root.current?.querySelectorAll<HTMLButtonElement>(".reading-slice")[next]?.focus({ preventScroll: true }); }
                  }}>
                  <span className="reading-leaf-label"><b>{item.date.slice(5).replace("-", " / ")}</b><small>{String(i + 1).padStart(2, "0")}</small></span>
                  <svg viewBox="0 0 200 200" aria-hidden="true"><circle className="reading-leaf-orbit" cx="100" cy="100" r="67" /><circle cx="100" cy="100" r="57" /><circle className="reading-leaf-reading" cx="100" cy="100" r="67" pathLength="100" strokeDasharray={`${item.seconds / maximum * 100} 100`} transform="rotate(-90 100 100)"/><path d="M100 18v15m0 134v15M18 100h15m134 0h15"/><text x="100" y="106" textAnchor="middle">{Math.round(item.seconds / 60)}</text><text className="reading-leaf-unit" x="100" y="126" textAnchor="middle">分钟</text></svg>
                  <span className="reading-leaf-foot"><span>{item.works} 部作品</span><span>{item.sessions} 次阅读</span></span>
                </button>
              </div>
            </m.div>;
          })}
        </m.div>
      </div></div>
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
