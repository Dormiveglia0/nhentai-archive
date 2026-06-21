import { Direction, Fit, Mode, ReaderPageItem } from "./readerHelpers";
import { SinglePageView } from "./SinglePageView";
import { WebtoonView } from "./WebtoonView";

type ReaderViewportProps = {
  pages: ReaderPageItem[];
  pageIndex: number;
  mode: Mode;
  direction: Direction;
  fit: Fit;
  zoom: number;
  masked: boolean;
  isRemote: boolean;
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
  masked,
  isRemote,
  onFlip,
  onJump,
  onToggleChrome,
}: ReaderViewportProps) {
  const emptyHint = isRemote ? "远端详情未返回可阅读页面 URL。" : "此作品没有可读取页面。";
  const current = pages.find((page) => page.pageIndex === pageIndex) ?? pages[0] ?? null;

  return (
    <div className={masked ? "reader-viewport masked" : "reader-viewport"}>
      {mode === "webtoon" ? (
        <WebtoonView
          pages={pages}
          pageIndex={pageIndex}
          fit={fit}
          onReachPage={onJump}
          onToggleChrome={onToggleChrome}
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
          emptyHint={emptyHint}
        />
      )}
    </div>
  );
}
