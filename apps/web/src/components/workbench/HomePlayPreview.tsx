import { animate, m, useMotionValue, useTransform, type MotionValue } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "../../lib/motion";
import "./HomePlayPreview.css";

const arrangements = [
  [[32, 52, 510, 348], [558, 52, 370, 200], [944, 52, 224, 200], [32, 416, 260, 252], [308, 416, 234, 252], [558, 268, 610, 400]],
  [[32, 52, 350, 380], [398, 52, 320, 250], [734, 52, 434, 250], [32, 448, 350, 220], [398, 318, 320, 350], [734, 318, 434, 350]],
];
const compactArrangements = [
  [[24, 40, 552, 220], [24, 276, 322, 170], [362, 276, 214, 170], [24, 462, 260, 220], [300, 462, 276, 220], [24, 698, 552, 254]],
  [[24, 40, 552, 260], [24, 316, 260, 180], [300, 316, 276, 180], [24, 512, 200, 200], [240, 512, 336, 200], [24, 728, 552, 224]],
];
const names = ["展开分镜", "变换对白", "绽开墨花", "聚散网点", "翻动页角", "展开跨页"];
const dots = Array.from({ length: 64 }, (_, index) => index);
const rays = Array.from({ length: 16 }, (_, index) => index);

function PanelArt({ index, active, reduced }: { index: number; active: boolean; reduced: boolean }) {
  const transition = { duration: reduced ? 0 : .65, ease: [.22, 1, .36, 1] as [number, number, number, number] };
  if (index === 0) return <>
    <m.g animate={{ x: active ? -32 : 0 }} transition={transition}>
      {rays.map(i => <path key={i} d={`M${30 + i * 7} 38L${110 + i * 8} 262`} opacity={.12 + i * .025} />)}
    </m.g>
    <m.path className="home-play-ink" animate={{ d: active ? "M58 205L300 57L347 205L105 262Z" : "M105 57L300 90L300 243L105 210Z" }} transition={transition} />
    <m.path className="home-play-red" animate={{ d: active ? "M58 205L300 57M105 262L347 205" : "M105 57L300 90M105 210L300 243" }} transition={transition} />
    <m.path animate={{ d: active ? "M115 199L289 92M132 220L306 113M149 241L323 134" : "M135 106L268 125M135 130L268 149M135 154L229 168" }} transition={transition} />
  </>;
  if (index === 1) return <>
    <m.path className="home-play-ink" animate={{ d: active ? "M58 70Q200 15 342 70L325 197L236 209L209 260L189 213L75 197Z" : "M58 85Q200 28 342 85L330 188Q274 223 167 204L113 247L122 195Q76 182 58 85Z" }} transition={transition} />
    <m.g className="home-play-red" animate={{ rotate: active ? -8 : 0, y: active ? -4 : 0 }} style={{ transformOrigin: "200px 140px" }} transition={transition}>
      {active ? <><path d="M199 97v52" strokeWidth="3" /><circle cx="199" cy="173" r="3" fill="currentColor" /></> : <>{[162, 200, 238].map(x => <circle key={x} cx={x} cy="144" r="4" fill="currentColor" />)}</>}
    </m.g>
  </>;
  if (index === 2) return <m.g animate={{ rotate: active ? 90 : 0, scale: active ? 1.13 : .8 }} style={{ transformOrigin: "200px 150px" }} transition={transition}>
    {rays.map(i => <m.path key={i} className={i % 4 === 0 ? "home-play-red" : ""} d="M200 65L209 130L264 86L222 143L285 150L222 157L264 214L209 170L200 235" transform={`rotate(${i * 22.5} 200 150)`} opacity={i % 4 === 0 ? .8 : .12} />)}
    <circle cx="200" cy="150" r="9" className="home-play-red" fill="currentColor" />
  </m.g>;
  if (index === 3) return <>{dots.map(i => <m.circle key={i} fill="currentColor" stroke="none" className={i % 13 === 0 ? "home-play-red" : ""} animate={{ cx: active ? 200 + Math.cos(i * 2.4) * Math.sqrt(i) * 14 : 82 + i % 8 * 33, cy: active ? 150 + Math.sin(i * 2.4) * Math.sqrt(i) * 14 : 48 + Math.floor(i / 8) * 29, r: active ? 2 + i % 4 : 1.5 + i % 8 * .55, opacity: active ? .7 : .2 + i % 8 * .08 }} transition={transition} />)}</>;
  if (index === 4) return <>
    <path d="M94 47H267L310 92V253H94Z" />
    <m.path className="home-play-ink" animate={{ d: active ? "M94 47H204L310 159V253H94Z" : "M94 47H267L310 92V253H94Z" }} transition={transition} />
    <m.path className="home-play-red" animate={{ d: active ? "M204 47V159H310" : "M267 47V92H310" }} transition={transition} />
    {[140, 165, 190, 215].map((y, i) => <m.path key={y} d={`M125 ${y}H${i === 3 ? 209 : 274}`} animate={{ opacity: active && i < 1 ? 0 : .5, x: active ? -6 : 0 }} transition={transition} />)}
  </>;
  return <>
    <m.path className="home-play-ink" animate={{ d: active ? "M45 86Q118 49 200 85Q282 49 355 86V225Q282 188 200 224Q118 188 45 225ZM200 85V224" : "M97 56L300 83V248L97 221ZM122 60V224" }} transition={transition} />
    <m.path className="home-play-red" animate={{ d: active ? "M222 80V130L234 121L246 130V75" : "M237 74V134L249 125L261 138V77" }} transition={transition} />
    {[0, 1, 2, 3, 4].map(i => <m.path key={i} animate={{ d: active ? `M69 ${113 + i * 17}Q118 ${92 + i * 17} 174 ${112 + i * 17}M226 ${112 + i * 17}Q282 ${92 + i * 17} 330 ${113 + i * 17}` : `M148 ${117 + i * 20}L273 ${133 + i * 20}`, opacity: .4 }} transition={transition} />)}
  </>;
}

function PlayPanel({ index, fold, reduced, compact }: { index: number; fold: MotionValue<number>; reduced: boolean; compact: boolean }) {
  const [active, setActive] = useState(false);
  const layouts = compact ? compactArrangements : arrangements;
  const start = layouts[0][index], end = layouts[1][index];
  const panel = useRef<SVGSVGElement>(null);
  const art = useRef<SVGSVGElement>(null);
  const number = useRef<SVGTextElement>(null);
  useEffect(() => {
    const update = (value: number) => {
      const rect = start.map((n, axis) => n + (end[axis] - n) * value);
      ["x", "y", "width", "height"].forEach((name, axis) => panel.current?.setAttribute(name, String(rect[axis])));
      art.current?.setAttribute("width", String(rect[2] - 24));
      art.current?.setAttribute("height", String(rect[3] - 36));
      number.current?.setAttribute("y", String(rect[3] - 12));
    };
    update(fold.get());
    return fold.on("change", update);
  }, [fold, start, end]);
  return <svg ref={panel} x={start[0]} y={start[1]} width={start[2]} height={start[3]} className={`home-play-panel${active ? " is-active" : ""}` } role="button" tabIndex={0} aria-label={names[index]} aria-pressed={active}
    onClick={() => setActive(value => !value)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setActive(value => !value); } }}
    >
    <rect className="home-play-panel-edge" x="1" y="1" width="99.5%" height="99.5%" />
    <svg ref={art} x="12" y="18" width={start[2] - 24} height={start[3] - 36} viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><PanelArt index={index} active={active} reduced={reduced} /></svg>

    <text ref={number} x="15" y={start[3] - 12} className="home-play-index" aria-hidden="true">0{index + 1}</text>
  </svg>;
}

export function HomePlayPreview() {
  const reduced = usePrefersReducedMotion();
  const stage = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(() => window.matchMedia("(max-width: 700px)").matches);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 700px)");
    const change = () => setCompact(query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  const fold = useMotionValue(0);
  const [arranged, setArranged] = useState(false);
  const drag = useRef<{ x: number; start: number; width: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const movement = useRef<ReturnType<typeof animate>>();
  const bookmarkX = useTransform(fold, value => `${compact ? (354 - value * 62) / 6 : (550 + value * 176) / 12}%`);
  const bookmarkY = useTransform(fold, value => `${compact ? (454 + value * 50) / 9.9 : (260 + value * 50) / 7.2}%`);
  const thread = useTransform(fold, value => compact ? `M12 20H${354 - value * 62}V${454 + value * 50}H588` : `M16 30H${550 + value * 176}V${260 + value * 50}H1184`);
  function settle(value: number) {
    movement.current?.stop();
    setArranged(value === 1);
    if (reduced) fold.set(value);
    else movement.current = animate(fold, value, { type: "spring", stiffness: 160, damping: 25 });
  }
  useEffect(() => () => movement.current?.stop(), []);
  useEffect(() => { if (reduced) { movement.current?.stop(); fold.set(arranged ? 1 : 0); } }, [reduced, arranged, fold]);
  return <section className="home-play" aria-label="互动扉页">
    <h1 className="home-play-sr">首页</h1>
    <div className="home-play-margin" aria-hidden="true"><span>NH / ARCHIVE</span><span>頁 · 間</span><span>01 — 06</span></div>
    <div ref={stage} className="home-play-stage">
      <svg viewBox={compact ? "0 0 600 990" : "0 0 1200 720"} className="home-play-sheet" aria-label="可编排分镜">
        <m.path className="home-play-thread" d={thread} initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduced ? 0 : 1.2, ease: "easeInOut" }} />
        {names.map((_, index) => <PlayPanel key={index} index={index} fold={fold} reduced={reduced} compact={compact} />)}
        <path className="home-play-registration" d={compact ? "M12 40V28H24M576 28H588V40M12 952V966H24M576 966H588V952" : "M16 52V36H32M1168 36H1184V52M16 668V684H32M1168 684H1184V668"} aria-hidden="true" />
      </svg>
      <m.button type="button" className="home-play-bookmark" style={{ left: bookmarkX, top: bookmarkY }} aria-label="拖动书签重新编排" aria-pressed={arranged}
        onPointerDown={event => { if (event.button !== 0) return; movement.current?.stop(); suppressClick.current = false; drag.current = { x: event.clientX, start: fold.get(), width: stage.current?.clientWidth ?? 1200, moved: false }; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={event => { const current = drag.current; if (!current) return; const delta = event.clientX - current.x; if (Math.abs(delta) > 5) current.moved = true; if (current.moved) fold.set(Math.max(0, Math.min(1, current.start + delta / Math.max(80, current.width * .22)))); }}
        onPointerUp={() => { const current = drag.current; if (!current) return; drag.current = null; suppressClick.current = current.moved; if (current.moved) settle(fold.get() >= .5 ? 1 : 0); }}
        onPointerCancel={() => { drag.current = null; suppressClick.current = true; settle(arranged ? 1 : 0); }}
        onLostPointerCapture={() => { if (drag.current) { drag.current = null; settle(arranged ? 1 : 0); } }}
        onClick={event => { if (event.detail !== 0 && suppressClick.current) { suppressClick.current = false; return; } settle(arranged ? 0 : 1); }}
        onKeyDown={event => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) { event.preventDefault(); settle(event.key === "ArrowRight" || event.key === "End" ? 1 : 0); } }}><span aria-hidden="true"><i /><i /></span></m.button>
    </div>
    <div className="home-play-foot"><span aria-hidden="true">— NH —</span><span className="home-play-sr" role="status">{arranged ? "分镜已重新编排" : "初始分镜布局"}</span><span aria-hidden="true">紙 / 墨</span></div>
  </section>;
}
