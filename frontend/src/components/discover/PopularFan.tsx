import { Download, Flame } from "lucide-react";
import type { CSSProperties, PointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { GallerySummary } from "../../lib/api";

type Props = {
  loading: boolean;
  items: GallerySummary[];
  blurCovers: boolean;
  collapseSignal: number;
  onOpen: (id: number) => void;
  onImport: (id: number) => void;
};

export function PopularFan({ loading, items, blurCovers, collapseSignal, onOpen, onImport }: Props) {
  const rootRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef({ active: false, startX: 0, moved: false });
  const skipClickRef = useRef(false);
  const [progress, setProgress] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window === "undefined" ? 1280 : window.innerWidth));
  const [activeMobileIndex, setActiveMobileIndex] = useState(0);
  const [mobileDrag, setMobileDrag] = useState(0);
  const visibleItems = items.slice(0, 5);
  const compact = viewportWidth < 860;
  const easedProgress = compact ? 0 : easeInOut(progress);

  const cardStyles = useMemo(
    () =>
      visibleItems.map((_, index) =>
        compact ? mobileCardStyle(index, activeMobileIndex, mobileDrag, visibleItems.length) : cardStyle(index, easedProgress, viewportWidth)
      ),
    [activeMobileIndex, compact, easedProgress, mobileDrag, viewportWidth, visibleItems]
  );

  useEffect(() => {
    let frame = 0;

    function writeProgress() {
      frame = 0;
      const progress = Math.min(1, Math.max(0, window.scrollY / 220));
      setProgress((current) => (Math.abs(current - progress) > 0.006 ? progress : current));
      setViewportWidth((current) => (Math.abs(current - window.innerWidth) > 4 ? window.innerWidth : current));
      rootRef.current?.style.setProperty("--popular-progress", progress.toFixed(3));
    }

    function onScroll() {
      if (frame) return;
      frame = window.requestAnimationFrame(writeProgress);
    }

    function onResize() {
      if (frame) return;
      frame = window.requestAnimationFrame(writeProgress);
    }

    writeProgress();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [collapseSignal]);

  if (!loading && visibleItems.length === 0) return null;

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!compact || visibleItems.length < 2) return;
    dragRef.current = { active: true, startX: event.clientX, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!compact || !dragRef.current.active) return;
    const delta = event.clientX - dragRef.current.startX;
    if (Math.abs(delta) > 4) dragRef.current.moved = true;
    setMobileDrag(Math.max(-1.35, Math.min(1.35, delta / 116)));
  }

  function handlePointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (!compact || !dragRef.current.active) return;
    if (dragRef.current.moved) skipClickRef.current = true;
    const direction = mobileDrag < -0.35 ? 1 : mobileDrag > 0.35 ? -1 : 0;
    if (direction && visibleItems.length) {
      setActiveMobileIndex((current) => (current + direction + visibleItems.length) % visibleItems.length);
    }
    setMobileDrag(0);
    dragRef.current.active = false;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may already be released by the browser.
    }
  }

  return (
    <section ref={rootRef} className="popular-fan suntrack" aria-label="今日热门">
      <div className="fan-title">
        <Flame size={16} />
        <strong>今日热门</strong>
        <span>{loading ? "读取中" : `${visibleItems.length || 5} 项`}</span>
      </div>
      {loading && !visibleItems.length ? (
        <div className="fan-empty">正在读取真实热门作品...</div>
      ) : (
        <div
          className={compact ? "fan-cards mobile-loop" : "fan-cards"}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
        >
          {visibleItems.map((item, index) => (
            <article key={item.gallery_id} className="fan-card" style={cardStyles[index]}>
              <button
                type="button"
                className="fan-cover"
                onClick={() => {
                  if (skipClickRef.current) {
                    skipClickRef.current = false;
                    return;
                  }
                  onOpen(item.gallery_id);
                }}
              >
                {item.thumbnail.url ? (
                  <img className={blurCovers ? "blurred" : ""} src={item.thumbnail.url} alt="" loading="lazy" />
                ) : (
                  <span className="cover-fallback">NO COVER</span>
                )}
              </button>
              <button
                type="button"
                className="fan-import"
                onClick={(event) => {
                  event.stopPropagation();
                  onImport(item.gallery_id);
                }}
                aria-label={`加入导入队列：${item.title_japanese || item.pretty_title || item.title}`}
              >
                <Download size={14} />
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function easeInOut(value: number) {
  return value * value * (3 - 2 * value);
}

function cardStyle(index: number, progress: number, viewportWidth: number): CSSProperties {
  const medium = viewportWidth < 1180;
  const radius = medium ? 272 : 326;
  const centerX = medium ? -26 : -30;
  const topBase = medium ? -2 : -4;
  const arcDepth = medium ? 58 : 70;
  const exitX = medium ? 250 : 300;
  const exitY = medium ? 114 : 126;
  const startAngles = medium ? [150, 125, 100, 76, 55] : [150, 125, 100, 75, 50];
  const startRotations = [-8, -3.5, 0, 3.5, 8];
  const openX = medium ? [-310, -170, -35, 100, 225] : [-390, -215, -50, 115, 270];
  const endAngle = 12;
  const angle = interpolate(startAngles[index], endAngle, progress);
  const radians = (angle * Math.PI) / 180;
  const baseX = radius * Math.cos(radians) + centerX;
  const startBaseX = radius * Math.cos((startAngles[index] * Math.PI) / 180) + centerX;
  const x = baseX + (openX[index] - startBaseX) * (1 - progress) + progress * exitX;
  const y = topBase + (1 - Math.sin(radians)) * arcDepth + progress * exitY;
  const rotate = interpolate(startRotations[index], 24, progress);
  return {
    zIndex: index === 2 ? 6 : 5 - Math.abs(index - 2),
    transform: `translate3d(${x}px, ${y}px, 0) rotate(${rotate}deg)`,
    pointerEvents: progress > 0.72 ? "none" : "auto",
  };
}

function mobileCardStyle(index: number, activeIndex: number, drag: number, total: number): CSSProperties {
  const relative = wrapRelative(index - activeIndex, total) + drag;
  const abs = Math.abs(relative);
  const x = relative * 72 - 52;
  const y = 4 + Math.min(abs, 2) * 14;
  const rotate = relative * 5;
  const scale = 1 - Math.min(abs, 2) * 0.06;
  return {
    zIndex: 20 - Math.round(abs * 4),
    opacity: abs > 2.25 ? 0.3 : 1,
    transform: `translate3d(${x}px, ${y}px, 0) rotate(${rotate}deg) scale(${scale})`,
  };
}

function wrapRelative(value: number, total: number) {
  if (!total) return 0;
  let result = value;
  const half = total / 2;
  while (result > half) result -= total;
  while (result < -half) result += total;
  return result;
}

function interpolate(from: number, to: number, progress: number) {
  return from + (to - from) * progress;
}
