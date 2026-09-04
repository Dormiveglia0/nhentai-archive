import { useEffect, useRef } from "react";

import { api } from "../../lib/api";

const SYNC_INTERVAL_MS = 15_000;
let fallbackSessionSequence = 0;

function createSessionKey() {
  try {
    const randomUUID = globalThis.crypto?.randomUUID;
    if (typeof randomUUID === "function") return randomUUID.call(globalThis.crypto);
    const getRandomValues = globalThis.crypto?.getRandomValues;
    if (typeof getRandomValues === "function") {
      const values = new Uint32Array(2);
      getRandomValues.call(globalThis.crypto, values);
      return `reader-${Date.now().toString(36)}-${values[0].toString(36)}${values[1].toString(36)}`;
    }
  } catch {
    // Reading analytics must never prevent the reader itself from opening.
  }
  fallbackSessionSequence += 1;
  return `reader-${Date.now().toString(36)}-${fallbackSessionSequence.toString(36)}`;
}

export type ReadingSessionSource =
  | { kind: "local"; id: number }
  | { kind: "remote"; id: number }
  | null;

export function useReadingSession(source: ReadingSessionSource, pageIndex: number) {
  const sourceKey = source ? `${source.kind}:${source.id}` : "";
  const sourceKind = source?.kind ?? null;
  const sourceId = source?.id ?? null;
  const pageRef = useRef(pageIndex);
  const keyRef = useRef<{ sourceKey: string; key: string }>({ sourceKey: "", key: "" });
  pageRef.current = pageIndex;

  if (keyRef.current.sourceKey !== sourceKey) {
    keyRef.current = { sourceKey, key: sourceKey ? createSessionKey() : "" };
  }
  const sessionKey = keyRef.current.key;

  useEffect(() => {
    if (sourceKind === null || sourceId === null) return;
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
      const update = sourceKind === "local" ? api.updateReadingSession : api.updateRemoteReadingSession;
      void update(sourceId, sessionId, seconds(), pageRef.current, finished, keepalive).catch(() => undefined);
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
    const start = sourceKind === "local" ? api.startReadingSession : api.startRemoteReadingSession;
    void start(sourceId, sessionKey, pageRef.current)
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
  }, [sessionKey, sourceId, sourceKind]);
}
