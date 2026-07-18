import { useState } from "react";

import type { Direction, Fit, Mode, ReaderPageItem } from "./readerHelpers";
import { SinglePageView } from "./SinglePageView";
import { WebtoonView } from "./WebtoonView";

type ReaderViewportProps = {
  pages: ReaderPageItem[];
  pageIndex: number;
  mode: Mode;
  direction: Direction;
  fit: Fit;
  zoom: number;
  isRemote: boolean;
  loading: boolean;
  onFlip: (delta: number) => void;
  onJump: (pageIndex: number) => void;
  onToggleChrome: () => void;
};

export function ReaderViewport({
  pages,
  pageIndex,
  mode,
  direction,
  fit,
  zoom,
  isRemote,
  loading,
  onFlip,
  onJump,
  onToggleChrome,
}: ReaderViewportProps) {
  const [retryToken, setRetryToken] = useState(0);
  const emptyHint = isRemote ? "远端详情未返回可阅读页面 URL。" : "此作品没有可读取页面。";
  const current = pages.find((page) => page.pageIndex === pageIndex) ?? pages[0] ?? null;

  return (
    <div className="reader-viewport">
      {loading && pages.length === 0 ? (
        <div className="reader-loading" role="status"><span><i /><i /><i /></span><p>正在装载阅读页面</p></div>
      ) : mode === "webtoon" ? (
        <WebtoonView
          pages={pages}
          pageIndex={pageIndex}
          fit={fit}
          onReachPage={onJump}
          onToggleChrome={onToggleChrome}
          retryToken={retryToken}
          onRetry={() => setRetryToken((value) => value + 1)}
          emptyHint={emptyHint}
        />
      ) : (
        <SinglePageView
          page={current}
          fit={fit}
          zoom={zoom}
          direction={direction}
          onFlip={onFlip}
          onToggleChrome={onToggleChrome}
          retryToken={retryToken}
          onRetry={() => setRetryToken((value) => value + 1)}
          emptyHint={emptyHint}
        />
      )}
    </div>
  );
}
