import { ReaderImage } from "./ReaderImage";
import { Direction, Fit, ReaderPageItem, clickZoneDelta } from "./readerHelpers";

type SinglePageViewProps = {
  page: ReaderPageItem | null;
  fit: Fit;
  zoom: number;
  direction: Direction;
  onFlip: (delta: number) => void;
  emptyHint: string;
};

export function SinglePageView({ page, fit, zoom, direction, onFlip, emptyHint }: SinglePageViewProps) {
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
      <ReaderImage
        key={page.key}
        className={`reader-single-img fit-${fit}`}
        style={{ transform: `scale(${zoom})` }}
        src={page.src}
        alt={`第 ${page.pageIndex} 页`}
      />
    </div>
  );
}
