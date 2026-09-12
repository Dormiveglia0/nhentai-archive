import { Download, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, type ReadingStatistics } from "../../../lib/api";

type Point = { x: number; y: number };
const initialPoints: Point[] = [{ x: 155, y: 665 }, { x: 390, y: 470 }, { x: 660, y: 275 }, { x: 780, y: 75 }];
const ink = "#171815", red = "#ad382e", paper = "#f3efe5";
function ribbonPath(points: Point[]) {
  return points.reduce((path, point, index) => {
    if (!index) return `M${point.x} ${point.y}`;
    const previous = points[index - 1], middle = (previous.y + point.y) / 2;
    return `${path}C${previous.x + 15} ${middle} ${point.x - 15} ${middle} ${point.x} ${point.y}`;
  }, "");
}
function tracePath(index: number, lane: number, seconds: number, max: number, points: Point[]) {
  const group = Math.floor(index / 10), row = index % 10;
  const anchor = points[group + 1], origin = initialPoints[group + 1];
  const dx = anchor.x - origin.x + (group === 0 ? (points[0].x - initialPoints[0].x) * .5 : 0), dy = anchor.y - origin.y + (group === 0 ? (points[0].y - initialPoints[0].y) * .5 : 0);
  const strength = Math.sqrt(seconds / max), wave = Math.sin(row * .63 + group);
  const x = [190, 270, 495][group] + wave * 70 + dx * .6;
  const y = [515, 285, 65][group] + row * 17 + lane * 2 + dy * .6;
  const length = 125 + strength * 210 + (Math.cos(row * .77) + 1) * 55 + lane * 11;
  const end = Math.min(1040, x + length), lift = dy * .08 + wave * (lane - 2) * 1.5;
  return `M${x} ${y}C${x + length * .35} ${y + lift} ${end - 30} ${y - lift} ${end} ${y}`;
}
export function ImprintPreview() {
  const [statistics, setStatistics] = useState<ReadingStatistics>();
  const [error, setError] = useState(""), [saving, setSaving] = useState(false), [notice, setNotice] = useState(""), [revision, setRevision] = useState(0);
  const [narrow, setNarrow] = useState(() => window.matchMedia("(max-width: 760px)").matches);
  const viewX = narrow ? 100 : 0, viewWidth = narrow ? 840 : 1200;
  const [selected, setSelected] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null), points = useRef(initialPoints.map(point => ({ ...point })));
  const handles = useRef<(HTMLButtonElement | null)[]>([]);
  const gesture = useRef<{ index: number; pointer: number; x: number; y: number; point: Point; width: number; height: number } | null>(null);
  const frame = useRef(0);
  const activity = statistics?.activity ?? [], max = Math.max(1, ...activity.map(day => day.seconds));
  const day = selected === null ? undefined : activity[selected];
  useEffect(() => {
    let active = true;
    api.libraryStatistics(30).then(data => { if (active) { setStatistics(data); setError(""); } }).catch(() => { if (active) setError("阅读记录加载失败"); });
    return () => { active = false; };
  }, [revision]);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const update = () => setNarrow(media.matches);
    media.addEventListener("change", update); return () => media.removeEventListener("change", update);
  }, []);
  function paint() {
    const surface = svg.current;
    if (!surface) return;
    surface.querySelectorAll<SVGPathElement>("[data-trace]").forEach(path => {
      const index = Number(path.dataset.trace);
      path.setAttribute("d", tracePath(index, Number(path.dataset.lane), activity[index]?.seconds ?? 0, max, points.current));
    });
    surface.querySelector(".imprint-ribbon")?.setAttribute("d", ribbonPath(points.current));
    points.current.forEach((point, index) => {
      const handle = handles.current[index];
      if (handle) { handle.style.left = `${(point.x - viewX) / viewWidth * 100}%`; handle.style.top = `${point.y / 8}%`; handle.setAttribute("aria-valuenow", String(Math.round(point.y))); }
      surface.querySelector(`[data-bookmark="${index}"]`)?.setAttribute("transform", `translate(${point.x} ${point.y})`);
    });
    surface.querySelector(".imprint-opening")?.setAttribute("transform", `translate(${(points.current[2].x - initialPoints[2].x) * .25} ${(points.current[2].y - initialPoints[2].y) * .25})`);
  }
  function move(index: number, point: Point) {
    const origin = initialPoints[index];
    points.current[index] = { x: Math.max(origin.x - 80, narrow ? 150 : 0, Math.min(origin.x + 80, point.x)), y: Math.max(origin.y - 60, Math.min(origin.y + 60, point.y)) };
    cancelAnimationFrame(frame.current); frame.current = requestAnimationFrame(paint);
  }
  function reset() { points.current = initialPoints.map(point => ({ ...point })); paint(); setSelected(null); setNotice(""); }
  async function save() {
    if (!svg.current || saving) return;
    setSaving(true); setNotice(""); paint();
    const clone = svg.current.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("viewBox", "0 0 1200 800"); clone.setAttribute("width", "1800"); clone.setAttribute("height", "1200");
    clone.querySelectorAll<SVGElement>(".imprint-day-lines").forEach(node => { node.style.opacity = "1"; });
    const source = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" }));
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("图片生成失败")); image.src = source; });
      const canvas = document.createElement("canvas"); canvas.width = 1800; canvas.height = 1200;
      const context = canvas.getContext("2d"); if (!context) throw new Error("当前浏览器无法生成图片");
      context.drawImage(image, 0, 0);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("图片保存失败")), "image/png"));
      const url = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = url; link.download = `NH-${statistics?.period.end_date ?? "reading"}.png`; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000); setNotice("图片已保存");
    } catch (error) { setNotice(error instanceof Error ? error.message : "保存失败，请重试"); }
    finally { URL.revokeObjectURL(source); setSaving(false); }
  }
  return <>
    <header className="concept-heading imprint-heading"><time>{statistics?.period.end_date ?? "—"}</time><div className="concept-actions"><button type="button" aria-label="恢复初始位置" onClick={reset}><RotateCcw size={16} /></button><button type="button" disabled={!statistics || saving} onClick={() => void save()}><Download size={16} />{saving ? "正在保存" : "保存图片"}</button></div></header>
    {error ? <div className="concept-error" role="alert">{error}<button type="button" onClick={() => setRevision(value => value + 1)}>重试</button></div> : null}
    <div className="imprint-stage" style={{ aspectRatio: `${viewWidth} / 800` }}>
      <svg ref={svg} viewBox={`${viewX} 0 ${viewWidth} 800`} xmlns="http://www.w3.org/2000/svg" aria-label="近30天阅读记录" fontFamily="sans-serif">
        <rect width="1200" height="800" fill={paper} />
        {activity.map((item, index) => <g className="imprint-day-lines" key={item.date} style={{ opacity: selected === null || selected === index ? 1 : .23 }}>
          {Array.from({ length: item.seconds ? 7 : 4 }, (_, lane) => <path key={lane} data-trace={index} data-lane={lane} d={tracePath(index, lane, item.seconds, max, points.current)} fill="none" stroke={selected === index ? red : ink} strokeWidth={selected === index ? .9 : .65} opacity={item.seconds ? .35 + lane * .045 : .22} />)}
        </g>)}
        <g className="imprint-opening" transform={`translate(${(points.current[2].x - initialPoints[2].x) * .25} ${(points.current[2].y - initialPoints[2].y) * .25})`} fill="none" stroke={ink} strokeWidth=".8">
          <path d="M660 330Q722 323 765 346Q810 325 868 330V447Q812 442 765 466Q715 443 660 450Z" fill={paper} strokeOpacity=".48" />
          <path d="M765 346V466" strokeOpacity=".45" />
          {Array.from({ length: 10 }, (_, row) => <g key={row} strokeOpacity={.14 + row % 3 * .05}><path d={`M675 ${354 + row * 8}Q712 ${351 + row * 8} ${738 - row % 3 * 9} ${358 + row * 8}`} /><path d={`M779 ${358 + row * 8}Q815 ${350 + row * 8} ${854 - row % 4 * 9} ${353 + row * 8}`} /></g>)}
        </g>
        <g className="imprint-margin" fill="#6d695f" fontSize="12">
          <path d="M957 125V242M215 323V445M943 545V650" stroke={ink} strokeOpacity=".35" strokeWidth=".8" />
          <text x="976" y="142">已读</text><text x="1068" y="142" textAnchor="end">{statistics?.overview.works_read ?? "—"}</text>
          <text x="976" y="172">收藏</text><text x="1068" y="172" textAnchor="end">{statistics?.overview.favorite_count ?? "—"}</text>
          <text x="976" y="202">阅读天数</text><text x="1068" y="202" textAnchor="end">{statistics?.overview.active_days ?? "—"}</text>
          <text x="190" y="345" textAnchor="end">{statistics?.period.start_date.slice(5).replace("-", ".") ?? "—"}</text>
          <text x="190" y="375" textAnchor="end">起</text>
          <text x="962" y="568">{day ? day.date : "近30天"}</text>
          <text x="962" y="598">{statistics ? `${Math.round((day?.seconds ?? statistics.overview.total_seconds) / 60)} 分钟` : "—"}</text>
          <text x="962" y="628">{statistics ? `${day?.sessions ?? statistics.overview.sessions} 次阅读` : "—"}</text>
          <text x="450" y="172">阅</text><text x="450" y="192">读</text><text x="905" y="430">页</text>
          <path d="M450 204H468M450 215H480M900 443H929M900 455H944" stroke={ink} strokeOpacity=".35" />
        </g>
        <path className="imprint-ribbon" d={ribbonPath(points.current)} fill="none" stroke={red} strokeWidth="1.2" pathLength="1" />
        {points.current.map((point, index) => <g data-bookmark={index} key={index} transform={`translate(${point.x} ${point.y})`}><path d="M-5 -12H5V12L0 8L-5 12Z" fill={red} /></g>)}
        <text x="817" y="72" fill="#6d695f" fontSize="12" letterSpacing="1">{statistics?.period.end_date.slice(5).replace("-", ".") ?? "—"}</text>
        <path d="M817 83H905" stroke={ink} strokeOpacity=".3" strokeWidth=".7" />
        <g transform="translate(40 733)" stroke={red} fill="none" strokeWidth=".8"><path d="M0 0H27V27H0ZM3 3H24V24H3" /><path d="M7 6V21M20 6V21M7 8H11V12H7M16 8H20V12H16M11 16H17M11 19H17" /></g>
        <text x="87" y="751" fontSize="10" letterSpacing="2" fill="#6d695f">NH ARCHIVE</text>
        <text x="1150" y="751" textAnchor="end" fontSize="11" fill="#6d695f">{statistics ? `${statistics.period.start_date} — ${statistics.period.end_date}` : "正在加载阅读记录"}</text>
      </svg>
      {initialPoints.map((origin, index) => <button key={index} ref={node => { handles.current[index] = node; }} className="imprint-handle" type="button" role="slider" aria-label={`拖动点 ${index + 1}`} aria-valuemin={origin.y - 60} aria-valuemax={origin.y + 60} aria-valuenow={Math.round(points.current[index].y)} style={{ left: `${(points.current[index].x - viewX) / viewWidth * 100}%`, top: `${points.current[index].y / 8}%` }}
        onPointerDown={event => { if (event.button !== 0 || gesture.current) return; const rect = svg.current!.getBoundingClientRect(); gesture.current = { index, pointer: event.pointerId, x: event.clientX, y: event.clientY, point: { ...points.current[index] }, width: rect.width, height: rect.height }; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={event => { const drag = gesture.current; if (!drag || drag.pointer !== event.pointerId) return; move(drag.index, { x: drag.point.x + (event.clientX - drag.x) * viewWidth / drag.width, y: drag.point.y + (event.clientY - drag.y) * 800 / drag.height }); }} onPointerUp={() => { gesture.current = null; }} onPointerCancel={() => { gesture.current = null; }} onLostPointerCapture={() => { gesture.current = null; }}
        onKeyDown={event => { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home"].includes(event.key)) { event.preventDefault(); const point = points.current[index]; move(index, event.key === "Home" ? initialPoints[index] : { x: point.x + (event.key === "ArrowRight" ? 10 : event.key === "ArrowLeft" ? -10 : 0), y: point.y + (event.key === "ArrowDown" ? 10 : event.key === "ArrowUp" ? -10 : 0) }); } }} />)}
    </div>
    <footer className="imprint-footer"><div className="imprint-selection" aria-live="polite"><button type="button" onClick={() => setSelected(null)} aria-label="查看30天汇总">{day?.date ?? "近30天"}</button><span>{statistics ? `${Math.round((day?.seconds ?? statistics.overview.total_seconds) / 60)} 分钟 · ${day?.sessions ?? statistics.overview.sessions} 次阅读` : "正在加载"}</span></div><div className="imprint-dates" aria-label="选择阅读日期">{activity.map((item, index) => <button type="button" key={item.date} aria-label={`${item.date}，${item.sessions}次阅读`} aria-pressed={selected === index} onClick={() => setSelected(index)}><i style={{ height: `${8 + Math.sqrt(item.seconds / max) * 20}px`, opacity: item.seconds ? 1 : .25 }} /></button>)}</div></footer>
    <p className="imprint-notice" role="status">{notice || (statistics && !statistics.overview.sessions ? "近30天暂无阅读记录" : "")}</p>
  </>;
}
