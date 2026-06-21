import { useEffect, useRef } from "react";

import { Fit, ReaderPageItem } from "./readerHelpers";

type WebtoonViewProps = {
  pages: ReaderPageItem[];
  pageIndex: number;
  fit: Fit;
  onReachPage: (pageIndex: number) => void;
  onToggleChrome: () => void;
  emptyHint: string;
};

export function WebtoonView({ pages, pageIndex, fit, onReachPage, onToggleChrome, emptyHint }: WebtoonViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Map<number, HTMLImageElement>>(new Map());
  const lastReported = useRef<number>(pageIndex);

  // 观测视口中部的页面，回写当前页
  useEffect(() => {
    const root = containerRef.current;
    if (!root || pages.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
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
      { root, threshold: [0.5], rootMargin: "-40% 0px -40% 0px" }
    );
    itemRefs.current.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [pages, onReachPage]);

  // 外部跳页（缩略图/键盘）→ 滚动到目标
  useEffect(() => {
    if (pageIndex === lastReported.current) return;
    const target = itemRefs.current.get(pageIndex);
    if (target) {
      lastReported.current = pageIndex;
      target.scrollIntoView({ block: "start", behavior: "auto" });
    }
  }, [pageIndex]);

  if (pages.length === 0) {
    return <p className="reader-empty">{emptyHint}</p>;
  }

  return (
    <div className="reader-webtoon" ref={containerRef} onClick={onToggleChrome}>
      {pages.map((page) => (
        <img
          key={page.key}
          data-page-index={page.pageIndex}
          ref={(node) => {
            if (node) itemRefs.current.set(page.pageIndex, node);
            else itemRefs.current.delete(page.pageIndex);
          }}
          className={`reader-webtoon-img fit-${fit}`}
          src={page.src}
          alt={`第 ${page.pageIndex} 页`}
          loading="lazy"
          draggable={false}
        />
      ))}
    </div>
  );
}
