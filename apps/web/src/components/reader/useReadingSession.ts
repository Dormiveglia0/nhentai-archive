import { useEffect, useRef } from "react";

import { api } from "../../lib/api";

const SYNC_INTERVAL_MS = 15_000;

export function useReadingSession(workId: number | null, pageIndex: number) {
  const pageRef = useRef(pageIndex);
  const keyRef = useRef<{ workId: number | null; key: string }>({ workId: null, key: "" });
  pageRef.current = pageIndex;

  if (keyRef.current.workId !== workId) {
    keyRef.current = { workId, key: workId === null ? "" : crypto.randomUUID() };
  }
  const sessionKey = keyRef.current.key;

  useEffect(() => {
    if (workId === null) return;
    let alive = true;
    let sessionId: number | null = null;
    let elapsedMs = 0;
    let activeSince = document.visibilityState === "visible" ? performance.now() : null;

    const stopClock = () => {
      if (activeSince === null) return;
      elapsedMs += performance.now() - activeSince;
      activeSince = null;
    };
    const seconds = () => Math.max(0, Math.floor((elapsedMs + (activeSince === null ? 0 : performance.now() - activeSince)) / 1000));
    const flush = (finished = false, keepalive = false) => {
      if (sessionId === null) return;
      void api.updateReadingSession(workId, sessionId, seconds(), pageRef.current, finished, keepalive).catch(() => undefined);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        stopClock();
        flush();
      } else if (activeSince === null) {
        activeSince = performance.now();
      }
    };
    const onPageHide = () => {
      stopClock();
      flush(true, true);
    };
    const onPageShow = () => {
      if (document.visibilityState === "visible" && activeSince === null) activeSince = performance.now();
    };

    const interval = window.setInterval(() => flush(), SYNC_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    void api.startReadingSession(workId, sessionKey, pageRef.current)
      .then((session) => {
        sessionId = session.id;
        if (!alive) flush(true, true);
      })
      .catch(() => undefined);

    return () => {
      alive = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      stopClock();
      flush(true, true);
    };
  }, [sessionKey, workId]);
}
