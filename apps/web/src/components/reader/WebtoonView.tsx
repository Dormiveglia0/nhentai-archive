import { useEffect, useRef } from "react";

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
  const itemRefs = useRef<Map<number, HTMLImageElement>>(new Map());
  // -1 哨兵:确保进入 webtoon 时下方“外部跳页”effect 至少滚动一次到当前页,
  // 否则初值等于 pageIndex 会被提前 return,列表停在顶部并把进度回写成第 1 页。
  const lastReported = useRef<number>(-1);

  // 观测视口中部的页面，回写当前页
  useEffect(() => {
    if (pages.length === 0) return;
    const root = itemRefs.current.values().next().value?.closest<HTMLElement>(".reader-viewport") ?? null;
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
      { root, threshold: 0, rootMargin: "-45% 0px -45% 0px" }
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
    <div className="reader-webtoon" onClick={onToggleChrome}>
      {pages.map((page) => (
        <ReaderImage
          key={page.key}
          ref={(node) => {
            if (node) itemRefs.current.set(page.pageIndex, node);
            else itemRefs.current.delete(page.pageIndex);
          }}
          pageIndex={page.pageIndex}
          className={`reader-webtoon-img fit-${fit}`}
          src={page.src}
          alt={`第 ${page.pageIndex} 页`}
          loading="lazy"
          retryToken={retryToken}
          onRetry={onRetry}
        />
      ))}
    </div>
  );
}
