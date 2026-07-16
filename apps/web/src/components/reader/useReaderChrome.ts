import { useCallback, useEffect, useRef, useState } from "react";

import { CHROME_IDLE_MS } from "./readerHelpers";

export function useReaderChrome() {
  const [rawVisible, setRawVisible] = useState(true);
  const [pinned, setPinned] = useState(false);
  const timer = useRef<number | null>(null);
  const activityFrame = useRef<number | null>(null);

  const reveal = useCallback(() => {
    setRawVisible(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setRawVisible(false), CHROME_IDLE_MS);
  }, []);

  const hide = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    if (activityFrame.current !== null) window.cancelAnimationFrame(activityFrame.current);
    activityFrame.current = null;
    setRawVisible(false);
  }, []);

  useEffect(() => {
    const onActivity = () => {
      if (activityFrame.current !== null) return;
      activityFrame.current = window.requestAnimationFrame(() => {
        activityFrame.current = null;
        reveal();
      });
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "mouse") onActivity();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (event.pointerType !== "mouse" && target?.closest(".reader-webtoon")) return;
      onActivity();
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("keydown", onActivity);
    reveal();
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onActivity);
      if (timer.current) window.clearTimeout(timer.current);
      if (activityFrame.current !== null) window.cancelAnimationFrame(activityFrame.current);
    };
  }, [reveal]);

  return { visible: rawVisible || pinned, pinned, setPinned, reveal, hide };
}
