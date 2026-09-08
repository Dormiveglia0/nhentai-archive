import { Pause, Play, ChevronLeft, ChevronRight } from "lucide-react";
import { m, useSpring } from "motion/react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { LibrarySummary, ReadingStatistics, LibraryWork } from "../../../lib/api";
import { usePrefersReducedMotion } from "../../../lib/motion";
import { workTitle } from "../../../lib/format";
import { pageHref } from "../../../lib/navigation";
import { NumberTicker } from "../../effects/NumberTicker";
import "./HomeHero.css";

export function HomeHero({ summary, statistics, works = [] }: { summary?: LibrarySummary; statistics?: ReadingStatistics; works?: LibraryWork[] }) {
  const reduced = usePrefersReducedMotion();
  const [active, setActive] = useState(0);
  const selected = Math.min(active, Math.max(0, works.length - 1));
  const work = works[selected];
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const [day, setDay] = useState<number | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const drag = useRef<{ x: number; index: number } | null>(null);
  const tiltX = useSpring(0, { stiffness: 80, damping: 22 });
  const tiltY = useSpring(0, { stiffness: 80, damping: 22 });
  const activity = statistics?.activity ?? [];
  const selectedDay = day === null ? undefined : activity[day];
  const maxSeconds = Math.max(1, ...activity.map(item => item.seconds));
  const still = reduced || paused || hidden || !visible;
  useEffect(() => {
    const update = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  useEffect(() => {
    if (!stageRef.current) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, []);
  const statuses = [["未读", summary?.unread], ["在读", summary?.reading], ["读完", summary?.completed]] as const;
  return <section className={`folio-home-studio${still ? " is-still" : ""}`} aria-label="首页">
    <h1 className="folio-home-sr">首页</h1>
    <header className="folio-studio-mast"><span><i /> NH / ARCHIVE</span><span>阅读轨迹</span><span>{statistics ? `${statistics.period.start_date} — ${statistics.period.end_date}` : "—"}</span></header>
    <div className="folio-studio-body">
      <aside className="folio-studio-ledger">
        <div className="folio-studio-total"><span>作品</span><strong>{summary ? <NumberTicker value={summary.total} /> : "—"}</strong><small>{summary ? <NumberTicker value={summary.total_pages} /> : "—"} 页</small></div>
        <div className="folio-studio-status">{statuses.map(([label, value], index) => <div key={label} style={{ "--delay": `${index * 100}ms` } as CSSProperties}><span>{label}</span><strong>{value === undefined ? "—" : <NumberTicker value={value} />}</strong><i><b style={{ transform: `scaleX(${summary?.total ? (value ?? 0) / summary.total : 0})` }} /></i></div>)}</div>
        <div className="folio-studio-favorite"><span>收藏</span><strong>{summary ? <NumberTicker value={summary.favorites} /> : "—"}</strong><span className="folio-studio-star" aria-hidden="true">✳</span></div>
      </aside>
      <div className="folio-studio-artwork">
        <div className="folio-studio-art-label"><span>最近添加 · {works.length} 部作品</span><span>拖动翻阅</span></div>
        <div ref={stageRef} className="folio-studio-stage" role="slider" tabIndex={works.length ? 0 : -1} aria-label="翻阅最近作品" aria-disabled={!works.length} aria-valuemin={works.length ? 1 : 0} aria-valuemax={works.length} aria-valuenow={works.length ? selected + 1 : 0} aria-valuetext={work ? workTitle(work) : "暂无作品"} onKeyDown={event => {
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) { event.preventDefault(); setActive(event.key === "Home" ? 0 : event.key === "End" ? works.length - 1 : Math.max(0, Math.min(works.length - 1, selected + (event.key === "ArrowLeft" ? -1 : 1)))); }
        }} onPointerDown={event => { if (event.button !== 0) return; drag.current = { x: event.clientX, index: selected }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={event => {
          const rect = event.currentTarget.getBoundingClientRect();
          if (!reduced) { tiltY.set((event.clientX - rect.x - rect.width / 2) / rect.width * 12); tiltX.set(-(event.clientY - rect.y - rect.height / 2) / rect.height * 12); }
          if (drag.current) setActive(Math.max(0, Math.min(works.length - 1, drag.current.index + Math.round((drag.current.x - event.clientX) / 24))));
        }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }} onPointerLeave={() => { tiltX.set(0); tiltY.set(0); }}>
          <div className="folio-studio-orbit" aria-hidden="true"><i /><i /><i /><i /></div>
          <m.div className="folio-studio-tilt" style={{ rotateX: reduced ? 0 : tiltX, rotateY: reduced ? 0 : tiltY }}>
            <div className="folio-studio-drift">
              <svg viewBox="0 0 640 640" fill="none" aria-hidden="true">
                {works.map((item, i) => <m.g key={item.id} initial={false}
                  animate={{ rotate: (i - (works.length - 1) / 2) * 3 - selected * 1.4, scale: i === selected ? 1.08 : 1 - i * .008, x: i === selected ? 12 : 0 }}
                  style={{ transformOrigin: "320px 320px" }} transition={{ duration: reduced ? 0 : .7, ease: [.22, 1, .36, 1] }}>
                  <rect x="170" y="120" width="300" height="400" stroke="var(--folio-ink)" strokeWidth={i === selected ? 2 : .7} opacity={i === selected ? 1 : .3} />
                  <rect x="170" y="120" width="300" height="400" pathLength="100" stroke="var(--folio-red)" strokeWidth="1.3" strokeDasharray={`${item.completed ? 100 : Math.max(0, Math.min(100, item.progress_percent ?? 0))} 100`} />
                </m.g>)}
                {!works.length ? <path d="M100 170Q210 130 320 190Q430 130 540 170V470Q430 430 320 490Q210 430 100 470ZM320 190V490" stroke="var(--folio-line-strong)" /> : null}
              </svg>
            </div>
          </m.div>
          <div className="folio-studio-crosshair" aria-hidden="true">+</div>
        </div>
        <div className="folio-studio-art-foot"><span>墨线 · 作品</span><div className="folio-studio-playback"><button aria-label={paused ? "播放动效" : "暂停动效"} aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? <Play size={16} /> : <Pause size={16} />}</button></div><span>朱红 · 已读进度</span></div>
      </div>
      <aside className="folio-studio-console">
        <div className="folio-studio-book-index"><span>最近添加</span><span>{works.length ? String(selected + 1).padStart(2, "0") : "—"} / {works.length}</span></div>
        {work ? <div className="folio-studio-current" key={work.id}>
          <a className="folio-studio-work-title" href={pageHref({ name: "reader", workId: work.id })}>{workTitle(work)}</a>
          <div className="folio-studio-work-meta"><span>{work.page_count} 页</span><span>{work.completed ? "已读完" : (work.progress_percent ?? 0) > 0 ? `已读 ${Math.round(work.progress_percent ?? 0)}%` : "未读"}</span></div>
          <div className="folio-studio-book-progress"><i style={{ transform: `scaleX(${work.completed ? 1 : Math.max(0, Math.min(1, (work.progress_percent ?? 0) / 100))})` }} /></div>
        </div> : <p className="folio-studio-no-work">暂无作品</p>}
        <div className="folio-studio-book-turn"><button aria-label="上一本" disabled={!works.length || selected === 0} onClick={() => setActive(selected - 1)}><ChevronLeft size={18} /></button><button aria-label="下一本" disabled={!works.length || selected === works.length - 1} onClick={() => setActive(selected + 1)}><ChevronRight size={18} /></button></div>
        <div className="folio-studio-duration"><span>{selectedDay ? selectedDay.date : "近 30 天阅读"}</span><strong>{statistics ? <NumberTicker value={Math.round((selectedDay?.seconds ?? statistics.overview.total_seconds) / 60)} /> : "—"}<small>分钟</small></strong><span>{selectedDay ? `${selectedDay.works} 部作品 · ${selectedDay.sessions} 次阅读` : `${statistics ? statistics.overview.active_days : "—"} 天有阅读记录`}</span></div>
      </aside>
    </div>
    <footer className="folio-studio-activity">
      <div><button className="folio-studio-period-reset" aria-label="查看30天阅读汇总" onClick={() => setDay(null)}>阅读节律</button><strong aria-live="polite">{selectedDay ? `${selectedDay.date.slice(5)} · ${Math.round(selectedDay.seconds / 60)} 分钟` : "30 DAYS"}</strong></div>
      <div className="folio-studio-bars" aria-label="每日阅读时长">{activity.map((item, index) => <button key={item.date} aria-label={`${item.date}，阅读 ${Math.round(item.seconds / 60)} 分钟`} aria-pressed={day === index} onMouseEnter={() => setDay(index)} onFocus={() => setDay(index)} onClick={() => setDay(index)} style={{ "--bar": `${Math.max(2, item.seconds / maxSeconds * 100)}%`, "--delay": `${index * 15}ms` } as CSSProperties}><i /><small>{index === 0 || index === activity.length - 1 ? item.date.slice(5) : ""}</small></button>)}</div>
      <span className="folio-studio-colophon" aria-hidden="true">NH<br />ARCHIVE</span>
    </footer>
  </section>;
}
