import { useCallback, useEffect, useState } from "react";

import {
  DEFAULT_PREFS,
  Direction,
  Fit,
  Mode,
  PREFS_KEY,
  parsePrefs,
  ReaderPrefs,
  serializePrefs,
} from "./readerHelpers";

export function useReaderPrefs() {
  const [prefs, setPrefs] = useState<ReaderPrefs>(() => {
    if (typeof window === "undefined") return DEFAULT_PREFS;
    return parsePrefs(window.localStorage.getItem(PREFS_KEY));
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(PREFS_KEY, serializePrefs(prefs));
    } catch {
      /* localStorage 不可用时静默降级为仅内存 */
    }
  }, [prefs]);

  const setMode = useCallback((mode: Mode) => setPrefs((p) => ({ ...p, mode })), []);
  const setDirection = useCallback((direction: Direction) => setPrefs((p) => ({ ...p, direction })), []);
  const setFit = useCallback((fit: Fit) => setPrefs((p) => ({ ...p, fit })), []);

  return { prefs, setMode, setDirection, setFit };
}
