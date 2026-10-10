import { useEffect, useLayoutEffect, useRef, type CSSProperties } from "react";

import { ReaderImage } from "./ReaderImage";
import type { Fit, ReaderPageItem } from "./readerHelpers";

type WebtoonViewProps = {
  pages: ReaderPageItem[];
  pageIndex: number;
  fit: Fit;
  onReachPage: (pageIndex: number) => void;
  onToggleChrome: () => void;
  retryToken: number;
  onRetry: () => void;
  emptyHint: string;
};

export function WebtoonView({ pages, pageIndex, fit, onReachPage, onToggleChrome, retryToken, onRetry, emptyHint }: WebtoonViewProps) {
  const itemRefs = useRef<Map<number, HTMLElement>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);
  // -1 哨兵:确保进入 webtoon 时下方“外部跳页”effect 至少滚动一次到当前页,
  // 否则初值等于 pageIndex 会被提前 return,列表停在顶部并把进度回写成第 1 页。
  const lastReported = useRef<number>(-1);
  const restoringPage = useRef<number | null>(pageIndex);
  // ponytail: unknown sizes reserve the first known page; per-page metadata supplies exact sizes when available.
  const fallbackSize = pages.find(page => page.width && page.height) ?? { width: 867, height: 1226 };

  // 观测视口中部的页面，回写当前页
  useEffect(() => {
    if (pages.length === 0) return;
    const root = itemRefs.current.values().next().value?.closest<HTMLElement>(".reader-viewport") ?? null;
    const stopRestoring = () => { restoringPage.current = null; };
    const pointerScroll = (event: PointerEvent) => { if (event.target === root) stopRestoring(); };
    const keyboardScroll = (event: KeyboardEvent) => {
      if (!(event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable='true']"))) stopRestoring();
    };
    root?.addEventListener("wheel", stopRestoring, { passive: true });
    root?.addEventListener("touchmove", stopRestoring, { passive: true });
    root?.addEventListener("pointerdown", pointerScroll);
    window.addEventListener("keydown", keyboardScroll);
    const observer = new IntersectionObserver(
      (entries) => {
        // Layout changes during restoration are not reading progress; user scrolling releases the anchor.
        if (restoringPage.current !== null) return;
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const idx = Number((visible.target as HTMLElement).dataset.pageIndex);
        if (idx && idx !== lastReported.current) {
          lastReported.current = idx;
          onReachPage(idx);
        }
      },
      { root, threshold: 0, rootMargin: "-45% 0px -45% 0px" }
    );
    observerRef.current = observer;
    itemRefs.current.forEach((node) => observer.observe(node));
    return () => {
      observer.disconnect(); observerRef.current = null;
      root?.removeEventListener("wheel", stopRestoring);
      root?.removeEventListener("touchmove", stopRestoring);
      root?.removeEventListener("pointerdown", pointerScroll);
      window.removeEventListener("keydown", keyboardScroll);
    };
  }, [pages, onReachPage]);

  // 外部跳页（缩略图/键盘）→ 滚动到目标
  useLayoutEffect(() => {
    if (pageIndex === lastReported.current) return;
    const target = itemRefs.current.get(pageIndex);
    if (target) {
      restoringPage.current = pageIndex;
      lastReported.current = pageIndex;
      target.scrollIntoView({ block: "start", behavior: "auto" });
    }
  }, [pageIndex]);

  if (pages.length === 0) {
    return <p className="reader-empty">{emptyHint}</p>;
  }

  return (
    <div className="reader-webtoon" onClick={onToggleChrome}>
      {pages.map((page) => (
        <ReaderImage
          key={page.key}
          ref={(node) => {
            const previous = itemRefs.current.get(page.pageIndex);
            if (previous) observerRef.current?.unobserve(previous);
            if (node) {
              itemRefs.current.set(page.pageIndex, node);
              // At the end of the list, the initial scroll can be clamped before the image has its real height.
              if (restoringPage.current === page.pageIndex && !node.matches(".reader-image-loading, .reader-image-pending, .reader-img-error")) {
                node.scrollIntoView({ block: "start", behavior: "auto" });
              }
              observerRef.current?.observe(node);
            }
            else itemRefs.current.delete(page.pageIndex);
          }}
          pageIndex={page.pageIndex}
          className={`reader-webtoon-img fit-${fit}`}
          style={{ "--reader-page-width": `${page.width || fallbackSize.width}px`, "--reader-page-height": `${page.height || fallbackSize.height}px` } as CSSProperties}
          src={page.src}
          width={page.width}
          height={page.height}
          alt={`第 ${page.pageIndex} 页`}
          loading={page.pageIndex >= pageIndex - 1 && page.pageIndex <= pageIndex + 4 ? "eager" : "lazy"}
          retryToken={retryToken}
          onRetry={onRetry}
        />
      ))}
    </div>
  );
}
