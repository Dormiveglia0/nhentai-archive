import { Download, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, type ReadingStatistics } from "../../../lib/api";

type Point = { x: number; y: number };
const initialPoints: Point[] = [{ x: 240, y: 210 }, { x: 590, y: 410 }, { x: 930, y: 200 }];
const ink = "#171815", red = "#ad382e", paper = "#f3efe5";
function tracePath(index: number, lane: number, seconds: number, max: number, points: Point[]) {
  const group = Math.min(2, Math.floor(index / 10)), point = points[group];
  const row = index % 10;
  const x = 55 + group * 350, y = 95 + row * 40 + lane * 2.5;
  const length = Math.min(1155 - point.x, 25 + Math.sqrt(seconds / max) * 185);
  return `M${x} ${y}C${x + 80} ${y} ${point.x - 65} ${point.y + row * 10 + lane * 2.5} ${point.x} ${point.y + row * 10 + lane * 2.5}h${length}`;
}
function ribbonPath(points: Point[]) {
  let control = { x: 100, y: 570 }, path = "M80 670";
  for (const point of points) {
    path += `Q${control.x} ${control.y} ${point.x} ${point.y}`;
    control = { x: Math.max(45, Math.min(1155, 2 * point.x - control.x)), y: Math.max(55, Math.min(670, 2 * point.y - control.y)) };
  }
  return path;
}
export function ImprintPreview () {
  const [statistics, setStatistics] = useState<ReadingStatistics>();
  const [error, setError] = useState(""), [saving, setSaving] = useState(false), [notice, setNotice] = useState(""), [revision, setRevision] = useState(0);
  const svg = useRef<SVGSVGElement>(null), points = useRef(initialPoints.map(point => ({ ...point })));
  const handles = useRef<(HTMLButtonElement | null)[]>([]);
  const gesture = useRef<{ index: number; x: number; y: number; point: Point; width: number; height: number } | null>(null);
  const frame = useRef(0);
  const activity = statistics?.activity ?? [], max = Math.max(1, ...activity.map(day => day.seconds));
  useEffect(() => {
    let active = true;
    api.libraryStatistics(30).then(data => { if (active) { setStatistics(data); setError(""); } }).catch(() => { if (active) setError("阅读记录加载失败"); });
    return () => { active = false; };
  }, [revision]);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  function paint() {
    const surface = svg.current;
    if (!surface) return;
    surface.querySelectorAll<SVGPathElement>("[data-trace]").forEach(path => {
      const index = Number(path.dataset.trace), lane = Number(path.dataset.lane);
      path.setAttribute("d", tracePath(index, lane, activity[index]?.seconds ?? 0, max, points.current));
    });
    surface.querySelector(".imprint-ribbon")?.setAttribute("d", ribbonPath(points.current));
    points.current.forEach((point, index) => {
      const handle = handles.current[index];
      if (handle) { handle.style.left = `${point.x / 12}%`; handle.style.top = `${point.y / 8}%`; handle.setAttribute("aria-valuenow", String(Math.round(point.y))); }
      surface.querySelector(`[data-bookmark="${index}"]`)?.setAttribute("transform", `translate(${point.x} ${point.y})`);
    });
  }
  function move(index: number, point: Point) {
    const origin = initialPoints[index];
    points.current[index] = { x: Math.max(origin.x - 100, Math.min(origin.x + 100, point.x)), y: Math.max(85, Math.min(500, point.y)) };
    cancelAnimationFrame(frame.current); frame.current = requestAnimationFrame(paint);
  }
  function reset() { points.current = initialPoints.map(point => ({ ...point })); paint(); setNotice(""); }
  async function save() {
    if (!svg.current || saving) return;
    setSaving(true); setNotice(""); paint();
    const clone = svg.current.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("width", "1800"); clone.setAttribute("height", "1200");
    const source = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" }));
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("图片生成失败")); image.src = source; });
      const canvas = document.createElement("canvas"); canvas.width = 1800; canvas.height = 1200;
      const context = canvas.getContext("2d"); if (!context) throw new Error("当前浏览器无法生成图片");
      context.drawImage(image, 0, 0);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("图片保存失败")), "image/png"));
      const url = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = url; link.download = `NH-阅读扉页-${statistics?.period.end_date ?? "preview"}.png`; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000); setNotice("图片已生成");
    } catch (error) { setNotice(error instanceof Error ? error.message : "保存失败，请重试"); }
    finally { URL.revokeObjectURL(source); setSaving(false); }
  }
  return <>
    <header className="concept-heading imprint-heading"><div><h1>私人扉页</h1><span>{statistics?.period.end_date ?? "—"}</span></div><div className="concept-actions"><button type="button" aria-label="恢复初始编排" onClick={reset}><RotateCcw size={16} /></button><button type="button" disabled={!statistics || saving} onClick={() => void save()}><Download size={16} />{saving ? "正在生成" : "保存这一页"}</button></div></header>
    {error ? <div className="concept-error" role="alert">{error}<button type="button" onClick={() => setRevision(value => value + 1)}>重试</button></div> : null}
    <div className="imprint-stage">
      <svg ref={svg} viewBox="0 0 1200 800" xmlns="http://www.w3.org/2000/svg" aria-label="由近30天阅读记录生成的扉页">
        <rect width="1200" height="800" fill={paper} />
        <text x="45" y="38" fill={ink} fontSize="13" fontFamily="serif" letterSpacing="2">NH ARCHIVE</text>
        <text x="1155" y="38" textAnchor="end" fill="#6d695f" fontSize="12">{statistics?.period.end_date ?? "—"}</text>
        {activity.map((day, index) => <g key={day.date}>{Array.from({ length: Math.max(1, Math.min(12, day.sessions)) }, (_, lane) => <path key={lane} data-trace={index} data-lane={lane} d={tracePath(index, lane, day.seconds, max, points.current)} fill="none" stroke={day.seconds ? ink : "#bcb6a9"} strokeWidth={day.seconds ? .65 : .5} opacity={day.seconds ? .55 : .4} strokeDasharray={day.seconds ? undefined : "2 5"} />)}{index % 5 === 0 ? <text x={55 + Math.floor(index / 10) * 350} y={85 + index % 10 * 40} fontSize="10" fill="#6d695f">{day.date.slice(5)}</text> : null}</g>)}
        <path className="imprint-ribbon" d={ribbonPath(points.current)} fill="none" stroke={red} strokeWidth="1.2" />
        {points.current.map((point, index) => <g data-bookmark={index} key={index} transform={`translate(${point.x} ${point.y})`}><path d="M-5 -10H5V15L0 10L-5 15Z" fill={red} /></g>)}
        <path d="M45 715H1155" stroke="#bcb6a9" strokeWidth=".6" />
        <text x="45" y="750" fill={ink} fontSize="14">{statistics ? `${Math.round(statistics.overview.total_seconds / 60)} 分钟 · ${statistics.overview.sessions} 次阅读 · ${statistics.overview.active_days} 天` : "正在加载阅读记录"}</text>
        <text x="1155" y="750" textAnchor="end" fill="#6d695f" fontSize="12">{statistics ? `${statistics.period.start_date} — ${statistics.period.end_date}` : "—"}</text>
      </svg>
      {initialPoints.map((_, index) => <button key={index} ref={node => { handles.current[index] = node; }} className="imprint-handle" type="button" role="slider" aria-label={`书签${index + 1}`} aria-valuemin={85} aria-valuemax={500} aria-valuenow={Math.round(points.current[index].y)} style={{ left: `${points.current[index].x / 12}%`, top: `${points.current[index].y / 8}%` }}
        onPointerDown={event => { if (event.button !== 0) return; const rect = svg.current!.getBoundingClientRect(); gesture.current = { index, x: event.clientX, y: event.clientY, point: { ...points.current[index] }, width: rect.width, height: rect.height }; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={event => { const drag = gesture.current; if (!drag) return; move(index, { x: drag.point.x + (event.clientX - drag.x) * 1200 / drag.width, y: drag.point.y + (event.clientY - drag.y) * 800 / drag.height }); }} onPointerUp={() => { gesture.current = null; }} onPointerCancel={() => { gesture.current = null; }} onLostPointerCapture={() => { gesture.current = null; }}
        onKeyDown={event => { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home"].includes(event.key)) { event.preventDefault(); const point = points.current[index]; move(index, event.key === "Home" ? initialPoints[index] : { x: point.x + (event.key === "ArrowRight" ? 15 : event.key === "ArrowLeft" ? -15 : 0), y: point.y + (event.key === "ArrowDown" ? 15 : event.key === "ArrowUp" ? -15 : 0) }); } }} />)}
    </div>
    <p className="imprint-notice" role="status">{notice || (statistics && !statistics.overview.sessions ? "近30天暂无阅读记录" : "")}</p>
  </>;
}
