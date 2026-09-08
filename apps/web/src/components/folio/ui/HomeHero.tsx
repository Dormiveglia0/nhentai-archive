import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Expand, GalleryHorizontalEnd, RotateCcw } from "lucide-react";
import { animate, m, useMotionValue } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { LibraryWork } from "../../../lib/api";
import { workTitle } from "../../../lib/format";
import { usePrefersReducedMotion } from "../../../lib/motion";
import "./HomeHero.css";

export function HomeHero({ works = [], blurCovers = false }: {
  works?: LibraryWork[];
  blurCovers?: boolean;
}) {
  const stage = useRef<HTMLElement>(null);
  const [size, setSize] = useState({ width: 1200, height: 800 });
  const [mode, setMode] = useState<"wall" | "shelf">("wall");
  const [active, setActive] = useState(0);
  const dragging = useRef(false);
  const swipe = useRef<number | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const reduced = usePrefersReducedMotion();
  const controls = useRef<ReturnType<typeof animate>[]>([]);
  const count = works.length;
  const selected = Math.min(active, Math.max(0, count - 1));
  const columns = Math.max(1, Math.min(count, Math.ceil(Math.sqrt(count * size.width / size.height * .8))));
  const rows = Math.ceil(count / columns);
  const cardWidth = Math.min(280, Math.max(150, size.width / Math.max(3.6, columns - .5)));
  const cardHeight = cardWidth * 1.4;
  const focusScale = Math.min(1.65, (size.height - 240) / cardHeight, (size.width - 90) / cardWidth);
  const stepX = cardWidth + 32;
  const stepY = cardHeight + 40;
  const panX = Math.max(0, (columns * stepX - size.width) / 2 + 100);
  const panY = Math.max(0, (rows * stepY - size.height) / 2 + 100);

  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  function moveTo(nextX: number, nextY: number) {
    controls.current.forEach(control => control.stop());
    controls.current = [animate(x, nextX, { duration: reduced ? 0 : .6, ease: [.22, 1, .36, 1] }), animate(y, nextY, { duration: reduced ? 0 : .6, ease: [.22, 1, .36, 1] })];
  }
  useEffect(() => () => controls.current.forEach(control => control.stop()), []);
  useEffect(() => { x.stop(); y.stop(); x.set(0); y.set(0); }, [size.width, size.height, reduced, x, y]);

  useEffect(() => {
    const node = stage.current;
    if (!node || mode !== "wall") return;
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey) return;
      event.preventDefault();
      controls.current.forEach(control => control.stop());
      x.stop(); y.stop();
      const factor = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? size.height : 1;
      x.set(Math.max(-panX, Math.min(panX, x.get() - event.deltaX * factor)));
      y.set(Math.max(-panY, Math.min(panY, y.get() - event.deltaY * factor)));
    };
    node.addEventListener("wheel", wheel, { passive: false });
    return () => node.removeEventListener("wheel", wheel);
  }, [mode, panX, panY, size.height, x, y]);

  function changeMode(next: "wall" | "shelf") {
    setMode(next);
    moveTo(0, 0);
  }
  function turn(direction: number) {
    if (document.activeElement?.classList.contains("folio-home-art")) stage.current?.focus({ preventScroll: true });
    if (count) setActive(current => (current + direction + count) % count);
  }

  return (
    <section ref={stage} className={`folio-home-gallery is-${mode}`} aria-label="作品封面漫游" tabIndex={0}
      onPointerDownCapture={event => { swipe.current = mode === "shelf" && !(event.target as Element).closest(".folio-home-controls") ? event.clientX : null; }}
      onPointerUpCapture={event => {
        if (swipe.current !== null && Math.abs(event.clientX - swipe.current) > 40) {
          dragging.current = true;
          turn(event.clientX < swipe.current ? 1 : -1);
          window.setTimeout(() => { dragging.current = false; }, 0);
        }
        swipe.current = null;
      }}
      onPointerCancel={() => { swipe.current = null; dragging.current = false; }}
      onKeyDown={event => {
        if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Escape"].includes(event.key)) return;
        event.preventDefault();
        if (event.key === "Escape") { changeMode("wall"); return; }
        if (mode === "shelf") { if (event.key === "ArrowLeft") turn(-1); if (event.key === "ArrowRight") turn(1); }
        else moveTo(Math.max(-panX, Math.min(panX, x.get() + (event.key === "ArrowLeft" ? 220 : event.key === "ArrowRight" ? -220 : 0))), Math.max(-panY, Math.min(panY, y.get() + (event.key === "ArrowUp" ? 220 : event.key === "ArrowDown" ? -220 : 0))));
      }}>
      <h1 className="folio-home-sr">首页</h1>
      <div className="folio-home-registration" aria-hidden="true"><i /><i /><i /><i /></div>
      <div className="folio-home-perspective">
        <m.div className="folio-home-camera" animate={{ rotateX: 0, rotateY: 0, rotateZ: mode === "wall" ? -3 : 0 }} transition={{ duration: reduced ? 0 : .8, ease: [.22, 1, .36, 1] }}>
        <m.div className="folio-home-plane" style={{ x, y }} drag={mode === "wall" && count > 1} dragConstraints={{ left: -panX, right: panX, top: -panY, bottom: panY }} dragElastic={.06} dragMomentum={!reduced}
          onDragStart={() => { dragging.current = true; controls.current.forEach(control => control.stop()); }}
          onDragEnd={() => { window.setTimeout(() => { dragging.current = false; }, 0); }}>
          {works.map((work, index) => {
            let offset = (index - selected + count) % count;
            if (offset > count / 2) offset -= count;
            const visible = mode === "wall" || Math.abs(offset) <= 3;
            const wallX = (index % columns - (columns - 1) / 2) * stepX;
            const wallY = (Math.floor(index / columns) - (rows - 1) / 2) * stepY + (index % 2 ? 36 : -36);
            return <m.button key={work.id} type="button" className={`folio-home-art${mode === "shelf" && offset === 0 ? " is-selected" : ""}${blurCovers ? " is-private" : ""}`}
              style={{ width: cardWidth, height: cardHeight, marginLeft: -cardWidth / 2, marginTop: -cardHeight / 2, pointerEvents: visible ? "auto" : "none", zIndex: mode === "shelf" ? 10 - Math.abs(offset) : index % 3 }}
              initial={reduced ? false : { x: 0, y: 0, z: 0, rotate: 0, scale: .8, opacity: 0 }}
              animate={{ x: mode === "wall" ? wallX : offset * Math.min(235, size.width * .29), y: mode === "wall" ? wallY : Math.abs(offset) * 22 - 50, z: mode === "wall" ? 0 : -Math.abs(offset) * 160, rotate: mode === "wall" ? (index % 5 - 2) * 2 : 0, rotateY: mode === "wall" ? 0 : offset === 0 ? 0 : offset > 0 ? -38 : 38, scale: mode === "wall" ? 1 : offset === 0 ? focusScale : .95, opacity: visible ? 1 : 0 }}
              transition={{ type: "spring", stiffness: 95, damping: 23, mass: .8, ...(reduced ? { duration: 0, type: "tween" } : {}) }}
              tabIndex={visible ? 0 : -1} aria-hidden={!visible} aria-label={`翻阅：${workTitle(work)}`} aria-pressed={mode === "shelf" && offset === 0}
              onFocus={event => { if (event.currentTarget.matches(":focus-visible")) { setActive(index); changeMode("shelf"); } }}
              onClick={() => { if (!dragging.current) { setActive(index); changeMode("shelf"); } }}>
              <img src={`/api/works/${work.id}/cover?w=512`} alt="" draggable={false} decoding="async" onLoad={({ currentTarget: image }) => { image.dataset.orientation = image.naturalWidth > image.naturalHeight ? "landscape" : "portrait"; }} />
              <span className="folio-home-art-edge" aria-hidden="true" />
            </m.button>;
          })}
        </m.div>
        </m.div>
      </div>
      {!count ? <div className="folio-home-empty-art" aria-hidden="true"><span /><span /><span /></div> : null}
      {mode === "shelf" && works[selected] ? <div className="folio-home-caption" style={{ top: size.height / 2 - 50 + cardHeight * focusScale / 2 + 24 }} aria-live="polite"><span>{String(selected + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}</span><strong>{workTitle(works[selected])}</strong></div> : null}
      <div className="folio-home-controls" role="group" aria-label="封面展示控制">
        <button type="button" aria-label="漫游" aria-pressed={mode === "wall"} onClick={() => changeMode("wall")}><Expand size={16} /><span>漫游</span></button>
        <button type="button" aria-label="翻阅" aria-pressed={mode === "shelf"} disabled={!count} onClick={() => changeMode("shelf")}><GalleryHorizontalEnd size={16} /><span>翻阅</span></button>
        <span className="folio-home-control-divider" />
        <button type="button" aria-label={mode === "wall" ? "向左漫游" : "上一本"} disabled={!count} onClick={() => mode === "wall" ? moveTo(Math.min(panX, x.get() + 240), y.get()) : turn(-1)}><ChevronLeft size={18} /></button>
        <button type="button" aria-label={mode === "wall" ? "向右漫游" : "下一本"} disabled={!count} onClick={() => mode === "wall" ? moveTo(Math.max(-panX, x.get() - 240), y.get()) : turn(1)}><ChevronRight size={18} /></button>
        {mode === "wall" ? <><button type="button" aria-label="向上漫游" disabled={!count} onClick={() => moveTo(x.get(), Math.min(panY, y.get() + 240))}><ChevronUp size={18} /></button><button type="button" aria-label="向下漫游" disabled={!count} onClick={() => moveTo(x.get(), Math.max(-panY, y.get() - 240))}><ChevronDown size={18} /></button></> : null}
        <button type="button" aria-label="复位" onClick={() => moveTo(0, 0)}><RotateCcw size={16} /></button>
      </div>
    </section>
  );
}
