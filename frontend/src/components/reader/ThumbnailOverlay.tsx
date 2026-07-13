import { X } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import { m } from "motion/react";

import { duration, ease, Presence, usePrefersReducedMotion } from "../../lib/motion";
import { trapDialogFocus } from "./readerDialogFocus";
import { ReaderPageItem } from "./readerHelpers";
import "./ReaderPanels.css";

type ThumbnailOverlayProps = {
  open: boolean;
  pages: ReaderPageItem[];
  pageIndex: number;
  onJump: (pageIndex: number) => void;
  onClose: () => void;
};

const PAGE_ASPECT = 867 / 1226; // 页面真实宽高比 (w/h)
const GAP = 10;
const MIN_TILE = 132; // 小于此宽度则不再缩小,改为可滚动
const CONCURRENCY = 6; // 同时加载的缩略图数,避免远端并发过高而失败

/** 在可用区域内挑选让缩略图最大、且全部放得下的列数。 */
function bestFit(width: number, height: number, count: number) {
  let bestCols = 1;
  let bestTileW = 0;
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    const widthBound = (width - (cols - 1) * GAP) / cols;
    const heightBound = ((height - (rows - 1) * GAP) / rows) * PAGE_ASPECT;
    const tileW = Math.min(widthBound, heightBound);
    if (tileW > bestTileW) {
      bestTileW = tileW;
      bestCols = cols;
    }
  }
  return { cols: bestCols, tileW: bestTileW };
}

/** 先尝试整屏放下;放不下(会缩得太小)就用舒适尺寸并允许纵向滚动。 */
function planLayout(width: number, height: number, count: number) {
  if (width <= 0 || height <= 0 || count <= 0) return { cols: 1, tileW: 0, tileH: 0, scroll: false };
  const fit = bestFit(width, height, count);
  if (fit.tileW >= MIN_TILE) {
    const tileW = Math.floor(fit.tileW);
    return { cols: fit.cols, tileW, tileH: Math.floor(tileW / PAGE_ASPECT), scroll: false };
  }
  const cols = Math.max(1, Math.floor((width + GAP) / (MIN_TILE + GAP)));
  const tileW = Math.floor((width - (cols - 1) * GAP) / cols);
  return { cols, tileW, tileH: Math.floor(tileW / PAGE_ASPECT), scroll: true };
}

/** 限并发、按顺序预加载缩略图,带重试;避免乱序与远端并发过高导致的失败。 */
function useThrottledThumbs(srcs: string[], active: boolean) {
  const ready = useRef<Set<string>>(new Set());
  const failed = useRef<Set<string>>(new Set());
  const [, bump] = useReducer((x: number) => x + 1, 0);

  // 切换作品(srcs 变化)时重置进度
  useEffect(() => {
    ready.current = new Set();
    failed.current = new Set();
    bump();
  }, [srcs]);

  useEffect(() => {
    if (!active || srcs.length === 0) return;
    let cancelled = false;
    let flushPending = false;
    const flush = () => {
      if (flushPending) return;
      flushPending = true;
      requestAnimationFrame(() => {
        flushPending = false;
        if (!cancelled) bump();
      });
    };
    const queue = srcs.filter((src) => !ready.current.has(src) && !failed.current.has(src));
    const retries = new Map<string, number>();
    let inFlight = 0;
    const pump = () => {
      while (!cancelled && inFlight < CONCURRENCY && queue.length > 0) {
        const src = queue.shift()!;
        inFlight += 1;
        const img = new Image();
        img.onload = () => {
          inFlight -= 1;
          if (cancelled) return;
          ready.current.add(src);
          flush();
          pump();
        };
        img.onerror = () => {
          inFlight -= 1;
          if (cancelled) return;
          const attempts = retries.get(src) ?? 0;
          if (attempts < 2) {
            retries.set(src, attempts + 1);
            queue.push(src);
          } else {
            failed.current.add(src);
            flush();
          }
          pump();
        };
        img.src = src;
      }
    };
    pump();
    return () => {
      cancelled = true;
    };
  }, [srcs, active]);

  return { ready: ready.current, failed: failed.current };
}

/** 缩略图悬浮平铺:无独立窗口,仅模糊背景。点图跳转,点背景退出;按数量自适应,过多则滚动。 */
export function ThumbnailOverlay({ open, pages, pageIndex, onJump, onClose }: ThumbnailOverlayProps) {
  const reduce = usePrefersReducedMotion();
  const fieldRef = useRef<HTMLDivElement | null>(null);
  const closeButton = useRef<HTMLButtonElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const frame = window.requestAnimationFrame(() => closeButton.current?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      previous?.focus();
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const el = fieldRef.current;
    if (!el) return;
    const measure = () => {
      const style = getComputedStyle(el);
      const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      setSize({ w: el.clientWidth - padX, h: el.clientHeight - padY });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [open]);

  const srcs = useMemo(() => pages.map((page) => page.thumbSrc ?? page.src), [pages]);
  const { ready, failed } = useThrottledThumbs(srcs, open);

  const layout = useMemo(() => planLayout(size.w, size.h, pages.length), [size, pages.length]);
  const rows = Math.max(1, Math.ceil(pages.length / layout.cols));
  const centerRow = (rows - 1) / 2;
  const centerCol = (layout.cols - 1) / 2;
  const showLabel = layout.tileW >= 56;

  return (
    <Presence>
      {open ? (
        <m.div
          className="reader-chrome reader-thumb-field"
          role="dialog"
          aria-modal="true"
          aria-label="页面索引"
          onClick={onClose}
          onKeyDown={trapDialogFocus}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: duration.fast, ease: ease.standard }}
        >
          <div ref={fieldRef} className="reader-thumb-layout">
            <header className="reader-thumb-head" onClick={(event) => event.stopPropagation()}>
              <span><small>PAGE INDEX</small><strong>页面索引 · {pages.length} 页</strong></span>
              <button ref={closeButton} type="button" onClick={onClose} aria-label="关闭页面索引"><X size={18} /></button>
            </header>
            {layout.tileW > 0 ? <m.div
              className="reader-thumb-stage"
              style={{
                gridTemplateColumns: `repeat(${layout.cols}, ${layout.tileW}px)`,
                gap: `${GAP}px`,
                ...(layout.scroll ? { maxHeight: size.h, overflowY: "auto", alignContent: "start" } : {}),
              }}
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: duration.base, ease: ease.standard }}
            >
              {pages.map((page, index) => {
                const thumbSrc = page.thumbSrc ?? page.src;
                const isReady = ready.has(thumbSrc);
                const isFailed = failed.has(thumbSrc);
                const row = Math.floor(index / layout.cols);
                const col = index % layout.cols;
                const dist = Math.hypot(row - centerRow, col - centerCol);
                return (
                  <m.button
                    key={page.key}
                    type="button"
                    className={page.pageIndex === pageIndex ? "reader-thumb-tile active" : "reader-thumb-tile"}
                    style={{ width: layout.tileW, height: layout.tileH }}
                    onClick={(event) => {
                      event.stopPropagation();
                      onJump(page.pageIndex);
                      onClose();
                    }}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.84 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={reduce ? undefined : { scale: 1.06 }}
                    transition={
                      reduce
                        ? { duration: duration.fast }
                        : { type: "spring", stiffness: 300, damping: 22, delay: Math.min(dist * 0.03, 0.45) }
                    }
                  >
                    {isReady ? (
                      <img src={thumbSrc} alt={`第 ${page.pageIndex} 页`} draggable={false} />
                    ) : isFailed ? (
                      <div className="reader-thumb-fail">{page.pageIndex}</div>
                    ) : (
                      <div className="reader-thumb-skeleton" />
                    )}
                    {showLabel ? <span>{page.pageIndex}</span> : null}
                  </m.button>
                );
              })}
            </m.div> : <div className="reader-thumb-measuring" role="status" aria-label="正在计算页面布局"><i /><i /><i /></div>}
          </div>
        </m.div>
      ) : null}
    </Presence>
  );
}
