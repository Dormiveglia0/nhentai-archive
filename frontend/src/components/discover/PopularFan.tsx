import { Download, Flame } from "lucide-react";
import type { CSSProperties } from "react";
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
  const [progress, setProgress] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window === "undefined" ? 1280 : window.innerWidth));
  const visibleItems = items.slice(0, 5);
  const compact = viewportWidth < 860;
  const easedProgress = easeInOut(progress);

  const cardStyles = useMemo(
    () => visibleItems.map((_, index) => cardStyle(index, easedProgress, compact)),
    [compact, easedProgress, visibleItems]
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
        <div className="fan-cards">
          {visibleItems.map((item, index) => (
            <article key={item.gallery_id} className="fan-card" style={cardStyles[index]}>
              <button type="button" className="fan-cover" onClick={() => onOpen(item.gallery_id)}>
                {item.thumbnail.url ? (
                  <img className={blurCovers ? "blurred" : ""} src={item.thumbnail.url} alt="" loading="lazy" />
                ) : (
                  <span className="cover-fallback">NO COVER</span>
                )}
                <b>{index + 1}</b>
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

function cardStyle(index: number, progress: number, compact: boolean): CSSProperties {
  const radius = compact ? 138 : 250;
  const centerX = compact ? 20 : 40;
  const topBase = compact ? 4 : 10;
  const arcDepth = compact ? 38 : 56;
  const exitX = compact ? 120 : 220;
  const exitY = compact ? 90 : 112;
  const startAngles = [150, 125, 100, 75, 50];
  const startRotations = [-8, -3.5, 0, 3.5, 8];
  const endAngle = 12;
  const angle = interpolate(startAngles[index], endAngle, progress);
  const radians = (angle * Math.PI) / 180;
  const x = radius * Math.cos(radians) + centerX + progress * exitX;
  const y = topBase + (1 - Math.sin(radians)) * arcDepth + progress * exitY;
  const rotate = interpolate(startRotations[index], 24, progress);
  return {
    zIndex: index === 2 ? 6 : 5 - Math.abs(index - 2),
    transform: `translate3d(${x}px, ${y}px, 0) rotate(${rotate}deg)`,
    pointerEvents: progress > 0.72 ? "none" : "auto",
  };
}

function interpolate(from: number, to: number, progress: number) {
  return from + (to - from) * progress;
}
