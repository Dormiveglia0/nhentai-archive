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

  const hide = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    setRawVisible(false);
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", reveal);
    reveal();
    return () => {
      window.removeEventListener("keydown", reveal);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [reveal]);

  return { visible: rawVisible || pinned, pinned, setPinned, reveal, hide };
}
