import { ReaderImage } from "./ReaderImage";
import { clickZoneDelta, type Direction, type Fit, type ReaderPageItem } from "./readerHelpers";

type SinglePageViewProps = {
  page: ReaderPageItem | null;
  fit: Fit;
  zoom: number;
  direction: Direction;
  onFlip: (delta: number) => void;
  onToggleChrome: () => void;
  retryToken: number;
  onRetry: () => void;
  emptyHint: string;
};

export function SinglePageView({ page, fit, zoom, direction, onFlip, onToggleChrome, retryToken, onRetry, emptyHint }: SinglePageViewProps) {
  if (!page) {
    return <p className="reader-empty">{emptyHint}</p>;
  }
  return (
    <div className="reader-single">
      <button
        type="button"
        className="reader-zone reader-zone-left"
        aria-label="左侧点击区"
        onClick={() => onFlip(clickZoneDelta("left", direction))}
      />
      <button
        type="button"
        className="reader-zone reader-zone-right"
        aria-label="右侧点击区"
        onClick={() => onFlip(clickZoneDelta("right", direction))}
      />
      <button
        type="button"
        className="reader-zone reader-zone-center"
        aria-label="显示或隐藏阅读控件"
        onClick={onToggleChrome}
      />
      <ReaderImage
        key={page.key}
        className={`reader-single-img fit-${fit}`}
        style={{ transform: `scale(${zoom})` }}
        src={page.src}
        alt={`第 ${page.pageIndex} 页`}
        retryToken={retryToken}
        onRetry={onRetry}
      />
    </div>
  );
}
