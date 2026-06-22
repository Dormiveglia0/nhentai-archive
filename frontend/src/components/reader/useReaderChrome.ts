import { useCallback, useEffect, useRef, useState } from "react";

import { CHROME_IDLE_MS } from "./readerHelpers";

export function useReaderChrome() {
  const [rawVisible, setRawVisible] = useState(true);
  const [pinned, setPinned] = useState(false);
  const timer = useRef<number | null>(null);

  const reveal = useCallback(() => {
    setRawVisible(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setRawVisible(false), CHROME_IDLE_MS);
  }, []);

  useEffect(() => {
    const onActivity = () => reveal();
    window.addEventListener("mousemove", onActivity);
    window.addEventListener("touchstart", onActivity);
    reveal();
    return () => {
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("touchstart", onActivity);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [reveal]);

  return { visible: rawVisible || pinned, pinned, setPinned, reveal };
}
