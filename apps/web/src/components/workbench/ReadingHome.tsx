import { ArrowUpRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
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
  const reduced = usePrefersReducedMotion();
  const id = useId().replace(/:/g, "");
  const root = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [inactive, setInactive] = useState(() => document.hidden);
  const activity = statistics?.activity ?? [];
  const lastActive = activity.reduce((last, item, i) => item.seconds > 0 ? i : last, activity.length - 1);
  const index = Math.max(0, Math.min(hovered ?? selected ?? lastActive, activity.length - 1));
  const day = activity[index];
  const maximum = Math.max(1, ...activity.map(item => item.seconds));
  const still = paused || reduced || inactive;

  useEffect(() => {
    let visible = true;
    const update = () => setInactive(document.hidden || !visible);
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); });
    if (root.current) observer.observe(root.current);
    document.addEventListener("visibilitychange", update);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", update); };
  }, []);

  function select(next: number) { setHovered(null); setSelected(Math.max(0, Math.min(activity.length - 1, next))); }

  return <section className={`reading-home${still ? " is-still" : ""}`} aria-label="首页">
    <header className="reading-home-head">
      <div><span className="reading-eyebrow">READING / 30 DAYS</span><h1>阅读记录</h1></div>
      <div className="reading-period"><span>{statistics?.period.start_date ?? "—"}</span><i /><span>{statistics?.period.end_date ?? "—"}</span></div>
    </header>
    <div className="reading-overview">
      <div><span>近 30 天阅读</span><strong>{statistics ? <NumberTicker value={Math.round(statistics.overview.total_seconds / 60)} /> : "—"}<small>分钟</small></strong></div>
      <div><span>阅读作品</span><strong>{statistics ? <NumberTicker value={statistics.overview.works_read} /> : "—"}<small>部</small></strong></div>
      <div><span>活跃天数</span><strong>{statistics ? <NumberTicker value={statistics.overview.active_days} /> : "—"}<small>/ 30</small></strong></div>
      <div className="reading-overview-total"><span>我的库</span><strong>{summary ? <NumberTicker value={summary.total} /> : "—"}<small>部</small></strong></div>
    </div>
    <div className="reading-observatory">
      <div ref={root} className="reading-field" onPointerLeave={() => setHovered(null)}>
        <div className="reading-field-caption"><span><i /> 每日阅读时长</span><button type="button" aria-label={paused ? "播放动效" : "暂停动效"} aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? <Play size={14} /> : <Pause size={14} />}</button></div>
        <svg className="reading-sculpture" viewBox="0 0 1000 610" role="img" aria-label="每日阅读时长立体图；使用下方日期滑块选择日期">
          <defs>
            <linearGradient id={`${id}-face`} x1="0" y1="0" x2="1" y2=".4"><stop stopColor="#f9fbf7" /><stop offset="1" stopColor="#ced5cc" /></linearGradient>
            <linearGradient id={`${id}-selected`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f3d3a2" /><stop offset="1" stopColor="#b88950" /></linearGradient>
          </defs>
          <g className="reading-floor" aria-hidden="true">
            {Array.from({ length: 9 }, (_, i) => <path key={i} d={`M${40 + i * 100} 510l180-180 M60 ${340 + i * 21}h840`} />)}
            <path d="M50 535H890M90 520v30M840 520v30" />
            <text x="90" y="573">{activity[0]?.date.slice(5).replace("-", "/")}</text><text x="840" y="573">{activity[activity.length - 1]?.date.slice(5).replace("-", "/")}</text>
          </g>
          {activity.map((item, i) => {
            const x = 78 + i * (744 / Math.max(1, activity.length - 1));
            const y = 443 - Math.sin(i / Math.max(1, activity.length - 1) * Math.PI) * 42;
            const height = 42 + item.seconds / maximum * 178;
            const distance = Math.abs(i - index);
            return <m.g key={item.date} className={`reading-slice${i === index ? " is-selected" : ""}`} data-date={item.date}
              initial={reduced ? false : { opacity: 0, y: 32 }} animate={{ opacity: 1, y: distance === 0 ? -36 : distance < 4 ? -16 / distance : 0 }}
              transition={{ type: "spring", stiffness: 145, damping: 24 }}
              onPointerEnter={event => { if (event.pointerType === "mouse") setHovered(i); }} onClick={() => select(i)}>
              <g className="reading-slice-drift" style={{ "--slice-delay": `${-i * .24}s` } as CSSProperties}>
                <path className="reading-slice-shadow" d={`M${x} ${y + 3}h16l100-74h-16z`} />
                <path className="reading-slice-front" fill={i === index ? `url(#${id}-selected)` : `url(#${id}-face)`} d={`M${x} ${y}v-${height}l98-86v${height}z`} />
                <path className="reading-slice-edge" d={`M${x} ${y}h12v-${height}h-12z`} />
                <path className="reading-slice-top" d={`M${x} ${y-height}h12l98-86h-12z`} />
                <path className="reading-slice-score" d={`M${x+16} ${y-height+6}l66-58 M${x+16} ${y-height+14}l28-24`} />
                <circle className="reading-slice-dot" cx={x+81} cy={y-height-44} r="2.5" />
              </g>
            </m.g>;
          })}
          {!activity.length ? <text className="reading-empty-chart" x="500" y="300" textAnchor="middle">{statistics ? "暂无阅读记录" : "正在加载阅读记录"}</text> : null}
        </svg>
      </div>
      <aside className="reading-day" aria-live="polite" aria-atomic="true">
        <span className="reading-eyebrow">日期</span>
        <div className="reading-day-date"><span>{day?.date.slice(0,4) ?? "—"}</span><strong>{day?.date.slice(5).replace("-", " / ") ?? "—"}</strong></div>
        <div className="reading-day-duration"><strong>{day ? <NumberTicker value={Math.round(day.seconds / 60)} /> : "—"}</strong><span>分钟</span></div>
        <div className="reading-day-details"><span>阅读作品<strong>{day?.works ?? "—"}</strong></span><span>阅读次数<strong>{day?.sessions ?? "—"}</strong></span></div>
        <div className="reading-day-mark" aria-hidden="true"><span /><i /><span /></div>
        <div className="reading-day-controls"><button type="button" aria-label="前一天" disabled={!day || index === 0} onClick={() => select(index - 1)}><ChevronLeft size={18} /></button><span>{day ? `${String(index+1).padStart(2,"0")} / ${activity.length}` : "—"}</span><button type="button" aria-label="后一天" disabled={!day || index === activity.length - 1} onClick={() => select(index + 1)}><ChevronRight size={18} /></button></div>
      </aside>
    </div>
    <div className="reading-timeline">
      <label htmlFor={`${id}-date`}>选择日期<span>{day?.date ?? "—"}</span></label>
      <div className="reading-timeline-track"><div className="reading-timeline-ticks" aria-hidden="true">{activity.map((item,i) => <i key={item.date} className={i === index ? "is-active" : ""} style={{ "--activity": `${Math.max(2,item.seconds / maximum * 100)}%` } as CSSProperties} />)}</div><input id={`${id}-date`} type="range" min="0" max={Math.max(0,activity.length-1)} value={index} disabled={!day} aria-valuetext={day ? `${day.date}，阅读 ${Math.round(day.seconds/60)} 分钟` : "暂无记录"} onChange={event => select(Number(event.target.value))} /></div>
    </div>
    <footer className="reading-home-foot">
      <div className="reading-distribution"><span className="reading-eyebrow">作品状态</span><div>{[["未读",summary?.unread],["在读",summary?.reading],["读完",summary?.completed]].map(([label,count]) => <span key={label}>{label}<strong>{count ?? "—"}</strong></span>)}</div><div className="reading-distribution-bar" aria-hidden="true">{[summary?.unread,summary?.reading,summary?.completed].map((count,i) => <i key={i} style={{ flexGrow: count ?? 0 }} />)}</div></div>
      {works.length ? <div className="reading-recent"><span className="reading-eyebrow">最近添加</span><div>{works.slice(0,3).map(work => <a key={work.id} href={pageHref({ name: "reader", workId: work.id })}>{work.cover_path ? <AmbientCover src={`/api/works/${work.id}/cover?w=256`} alt="" className="is-fill-portrait" privateBlur={blurCovers} loading="lazy" /> : null}<span><strong>{workTitle(work)}</strong><small>{work.page_count} 页</small></span><ArrowUpRight size={16} /></a>)}</div></div> : null}
    </footer>
  </section>;
}
