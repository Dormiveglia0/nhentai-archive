import { Pause, Play, RotateCcw } from "lucide-react";
import { m, useMotionValue, useSpring } from "motion/react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { LibrarySummary, ReadingStatistics } from "../../../lib/api";
import { usePrefersReducedMotion } from "../../../lib/motion";
import { NumberTicker } from "../../effects/NumberTicker";
import "./HomeHero.css";

const forms = ["叠页", "回环", "流线"];
const leaves = Array.from({ length: 36 }, (_, i) => i);
export function HomeHero({ summary, statistics }: { summary?: LibrarySummary; statistics?: ReadingStatistics }) {
  const reduced = usePrefersReducedMotion();
  const [form, setForm] = useState(0);
  const [spread, setSpread] = useState(55);
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const [impression, setImpression] = useState(0);
  const [day, setDay] = useState<number | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const drag = useRef<{ x: number; rotation: number } | null>(null);
  const rotation = useMotionValue(0);
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
    <header className="folio-studio-mast"><span><i /> NH / ARCHIVE</span><span>紙 · 墨 · 頁</span><span>INTERACTIVE EDITION</span></header>
    <div className="folio-studio-body">
      <aside className="folio-studio-ledger">
        <div className="folio-studio-total"><span>作品</span><strong>{summary ? <NumberTicker value={summary.total} /> : "—"}</strong><small>{summary ? <NumberTicker value={summary.total_pages} /> : "—"} 页</small></div>
        <div className="folio-studio-status">{statuses.map(([label, value], index) => <div key={label} style={{ "--delay": `${index * 100}ms` } as CSSProperties}><span>{label}</span><strong>{value === undefined ? "—" : <NumberTicker value={value} />}</strong><i><b style={{ transform: `scaleX(${summary?.total ? (value ?? 0) / summary.total : 0})` }} /></i></div>)}</div>
        <div className="folio-studio-favorite"><span>收藏</span><strong>{summary ? <NumberTicker value={summary.favorites} /> : "—"}</strong><span className="folio-studio-star" aria-hidden="true">✳</span></div>
      </aside>
      <div className="folio-studio-artwork">
        <div className="folio-studio-art-label"><span>0{form + 1} / {forms[form]}</span><span>拖动旋转</span></div>
        <div ref={stageRef} className="folio-studio-stage" role="slider" tabIndex={0} aria-label="页片旋转" aria-valuemin={-180} aria-valuemax={180} aria-valuenow={Math.round(rotation.get())} onKeyDown={event => {
          if (["ArrowLeft", "ArrowRight", "Home"].includes(event.key)) { event.preventDefault(); rotation.set(event.key === "Home" ? 0 : Math.max(-180, Math.min(180, rotation.get() + (event.key === "ArrowLeft" ? -15 : 15)))); event.currentTarget.setAttribute("aria-valuenow", String(Math.round(rotation.get()))); }
        }} onPointerDown={event => { if (event.button !== 0) return; drag.current = { x: event.clientX, rotation: rotation.get() }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={event => {
          const rect = event.currentTarget.getBoundingClientRect();
          if (!reduced) { tiltY.set((event.clientX - rect.x - rect.width / 2) / rect.width * 16); tiltX.set(-(event.clientY - rect.y - rect.height / 2) / rect.height * 16); }
          if (drag.current) { rotation.set(Math.max(-180, Math.min(180, drag.current.rotation + (event.clientX - drag.current.x) * .5))); event.currentTarget.setAttribute("aria-valuenow", String(Math.round(rotation.get()))); }
        }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }} onPointerLeave={() => { tiltX.set(0); tiltY.set(0); }}>
          <div className="folio-studio-orbit" aria-hidden="true"><i /><i /><i /><i /></div>
          <m.div className="folio-studio-tilt" style={{ rotateX: reduced ? 0 : tiltX, rotateY: reduced ? 0 : tiltY, rotate: rotation }}>
            <div className="folio-studio-drift">
              <svg viewBox="0 0 640 640" fill="none" aria-hidden="true">
                {leaves.map(i => <m.rect key={i} x={170} y={120} width={300} height={400} rx={form === 1 ? 150 : 2}
                  stroke={i % 9 === 0 ? "var(--folio-red)" : "var(--folio-ink)"} strokeWidth={i % 9 === 0 ? 1.5 : .7} opacity={i % 9 === 0 ? .9 : .42}
                  initial={false} animate={{ rotate: form === 0 ? (i - 18) * spread / 22 + impression * 180 : form === 1 ? i * 10 + impression * 180 : (i - 18) * .5 + impression * 180, scaleX: form === 1 ? .48 + spread / 220 : 1 - i * .012, scaleY: form === 2 ? .22 + spread / 180 : 1 - i * .009, x: form === 2 ? Math.sin(i / 7) * spread * 1.5 : 0, y: form === 2 ? (i - 18) * 8 : 0 }}
                  style={{ transformOrigin: "320px 320px" }} transition={{ duration: reduced ? 0 : .95, delay: reduced ? 0 : i * .008, ease: [.22, 1, .36, 1] }} />)}
              </svg>
            </div>
          </m.div>
          <div className="folio-studio-crosshair" aria-hidden="true">+</div>
        </div>
        <div className="folio-studio-art-foot"><span>FORM / 0{form + 1}</span><button type="button" className="folio-studio-seal" aria-label="重新排印" onClick={() => { setImpression(value => value + 1); setForm(value => (value + 1) % forms.length); }}>印</button><span>INK / VERMILION</span></div>
      </div>
      <aside className="folio-studio-console">
        <div className="folio-studio-selector" role="group" aria-label="页片形态">{forms.map((label, index) => <button key={label} aria-pressed={form === index} onClick={() => setForm(index)}><small>0{index + 1}</small><span>{label}</span><i aria-hidden="true">↗</i></button>)}</div>
        <label className="folio-studio-range"><span>展开<output>{spread}°</output></span><input aria-label="展开" type="range" min="10" max="100" value={spread} onChange={event => setSpread(Number(event.target.value))} /></label>
        <div className="folio-studio-playback"><button aria-label={paused ? "播放动效" : "暂停动效"} aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? <Play size={16} /> : <Pause size={16} />}</button><button aria-label="重置画面" onClick={() => { setForm(0); setSpread(55); setImpression(0); rotation.set(0); stageRef.current?.setAttribute("aria-valuenow", "0"); tiltX.set(0); tiltY.set(0); }}><RotateCcw size={16} /></button><span>紙上運動</span></div>
        <div className="folio-studio-duration"><span>近 30 天阅读</span><strong>{statistics ? <NumberTicker value={Math.round(statistics.overview.total_seconds / 60)} /> : "—"}<small>分钟</small></strong><span>{statistics ? statistics.overview.active_days : "—"} 天有阅读记录</span></div>
      </aside>
    </div>
    <footer className="folio-studio-activity">
      <div><span>阅读节律</span><strong aria-live="polite">{selectedDay ? `${selectedDay.date.slice(5)} · ${Math.round(selectedDay.seconds / 60)} 分钟` : "30 DAYS"}</strong></div>
      <div className="folio-studio-bars" aria-label="每日阅读时长">{activity.map((item, index) => <button key={item.date} aria-label={`${item.date}，阅读 ${Math.round(item.seconds / 60)} 分钟`} aria-pressed={day === index} onMouseEnter={() => setDay(index)} onFocus={() => setDay(index)} onClick={() => setDay(index)} style={{ "--bar": `${Math.max(2, item.seconds / maxSeconds * 100)}%`, "--delay": `${index * 15}ms` } as CSSProperties}><i /><small>{index === 0 || index === activity.length - 1 ? item.date.slice(5) : ""}</small></button>)}</div>
      <span className="folio-studio-colophon" aria-hidden="true">NH<br />ARCHIVE</span>
    </footer>
  </section>;
}
