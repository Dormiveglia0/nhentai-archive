import { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from "react";

import { Presence, FadeInOut } from "../../lib/motion";
import { clamp } from "./readerHelpers";
import "./ReaderToolbar.css";

type ReaderScrubberProps = {
  visible: boolean;
  pageIndex: number;
  pageCount: number;
  onJump: (pageIndex: number) => void;
  onScrubChange: (active: boolean) => void;
};

/** 底部进度条：点击快速跳页、拖动快速切换。 */
export function ReaderScrubber({ visible, pageIndex, pageCount, onJump, onScrubChange }: ReaderScrubberProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const lastEmitted = useRef(pageIndex);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState(pageIndex);

  useEffect(() => {
    if (!dragging) {
      lastEmitted.current = pageIndex;
      setPreview(pageIndex);
    }
  }, [dragging, pageIndex]);

  const pageFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el || pageCount <= 1) return 1;
      const rect = el.getBoundingClientRect();
      const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
      return clamp(Math.round(ratio * (pageCount - 1)) + 1, 1, pageCount);
    },
    [pageCount]
  );

  const emit = useCallback(
    (page: number) => {
      setPreview(page);
      if (page !== lastEmitted.current) {
        lastEmitted.current = page;
        onJump(page);
      }
    },
    [onJump]
  );

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    onScrubChange(true);
    emit(pageFromClientX(event.clientX));
  };
  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    emit(pageFromClientX(event.clientX));
  };
  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragging(false);
    onScrubChange(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const shownPage = dragging ? preview : pageIndex;
  const fill = pageCount > 1 ? ((shownPage - 1) / (pageCount - 1)) * 100 : 0;

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 5 : 1;
    let next: number | null = null;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = shownPage - step;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") next = shownPage + step;
    if (event.key === "Home") next = 1;
    if (event.key === "End") next = pageCount;
    if (next === null) return;
    event.preventDefault();
    emit(clamp(next, 1, pageCount));
  };

  return (
    <Presence>
      {visible && pageCount > 0 ? (
        <FadeInOut y={12} className="reader-chrome reader-scrubber">
          <div className={dragging ? "reader-scrubber-row dragging" : "reader-scrubber-row"}>
            <div
              ref={trackRef}
              className="reader-scrubber-track"
              role="slider"
              aria-label="阅读进度"
              aria-valuemin={1}
              aria-valuemax={pageCount}
              aria-valuenow={shownPage}
              aria-valuetext={`第 ${shownPage} 页，共 ${pageCount} 页`}
              tabIndex={0}
              onKeyDown={handleKeyDown}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onMouseEnter={() => onScrubChange(true)}
              onMouseLeave={() => !dragging && onScrubChange(false)}
              onFocus={() => onScrubChange(true)}
              onBlur={() => !dragging && onScrubChange(false)}
            >
              <div className="reader-scrubber-rail">
                <div className="reader-scrubber-fill" style={{ width: `${fill}%` }} />
              </div>
              <div className="reader-scrubber-knob" style={{ left: `${fill}%` }} />
              {dragging ? (
                <div className="reader-scrubber-bubble" style={{ left: `${fill}%` }}>
                  {shownPage}
                </div>
              ) : null}
            </div>
            <span className="reader-counter reader-scrubber-counter">
              {shownPage} / {pageCount}
            </span>
          </div>
        </FadeInOut>
      ) : null}
    </Presence>
  );
}
