import { useState, type ReactNode } from "react";

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
  loadingControls?: ReactNode;
  onFlip: (delta: number) => void;
  onJump: (pageIndex: number) => void;
  onToggleChrome: () => void;
  onPrepareRetry: () => Promise<boolean>;
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
  loadingControls,
  onFlip,
  onJump,
  onToggleChrome,
  onPrepareRetry,
}: ReaderViewportProps) {
  const [retryToken, setRetryToken] = useState(0);
  const emptyHint = isRemote ? "远端详情未返回可阅读页面 URL。" : "此作品没有可读取页面。";
  const current = pages.find((page) => page.pageIndex === pageIndex) ?? pages[0] ?? null;
  const retry = async () => {
    if (await onPrepareRetry()) setRetryToken((value) => value + 1);
  };

  return (
    <div className="reader-viewport">
      {loading && pages.length === 0 ? (
        <div className="reader-loading" role="status"><svg viewBox="0 0 100 120" aria-hidden="true"><path d="M18 18V108H82V32L68 18ZM68 18V32H82M10 10H70M26 26V116H90" /><path className="reader-loading-trace" d="M18 108V18H68L82 32V108H18" pathLength="1" /><path d="M32 52H68M32 64H68M32 76H56" /></svg><p>正在读取页面…</p>{loadingControls}</div>
      ) : mode === "webtoon" ? (
        <WebtoonView
          pages={pages}
          pageIndex={pageIndex}
          fit={fit}
          onReachPage={onJump}
          onToggleChrome={onToggleChrome}
          retryToken={retryToken}
          onRetry={() => void retry()}
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
          onRetry={() => void retry()}
          emptyHint={emptyHint}
        />
      )}
    </div>
  );
}
