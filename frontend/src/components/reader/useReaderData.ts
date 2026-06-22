import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api, GalleryDetail, PageInfo, ReaderState, Work } from "../../lib/api";
import { clamp, PERSIST_DEBOUNCE_MS, ReaderPageItem } from "./readerHelpers";

export type ReaderSource =
  | { kind: "local"; workId: number }
  | { kind: "remote"; galleryId: number };

export type ReaderTag = { id: number; type: string; display: string };

export function useReaderData(source: ReaderSource) {
  const [work, setWork] = useState<Work | null>(null);
  const [gallery, setGallery] = useState<GalleryDetail | null>(null);
  const [localPages, setLocalPages] = useState<PageInfo[]>([]);
  const [state, setState] = useState<ReaderState | null>(null);
  const [pageIndex, setPageIndex] = useState(1);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isRemote = source.kind === "remote";
  const sourceKey = source.kind === "local" ? `local:${source.workId}` : `remote:${source.galleryId}`;
  // identity-stable view of source; updates only when sourceKey changes
  const stableSource = useMemo(() => source, [sourceKey]);
  const persistTimer = useRef<number | null>(null);
  // 记录最近一次待写入的进度,卸载/切换来源时若 debounce 未触发则立即补写,避免丢失
  const pendingPersist = useRef<{ workId: number; next: number; done: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      setNotice(null);
      setWork(null);
      setGallery(null);
      setLocalPages([]);
      setState(null);
      setPageIndex(1);
      setCompleted(false);
      try {
        if (stableSource.kind === "local") {
          const [nextWork, nextPages, nextState] = await Promise.all([
            api.work(stableSource.workId),
            api.pages(stableSource.workId),
            api.readerState(stableSource.workId),
          ]);
          if (cancelled) return;
          setWork(nextWork);
          setLocalPages(nextPages.result);
          setState(nextState);
          setPageIndex(Math.max(1, nextState.page_index || 1));
          setCompleted(Boolean(nextState.completed));
        } else {
          const detail = await api.gallery(stableSource.galleryId);
          if (cancelled) return;
          setGallery(detail);
        }
      } catch (exc) {
        if (!cancelled) setError(exc instanceof Error ? exc.message : String(exc));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
      if (persistTimer.current) {
        window.clearTimeout(persistTimer.current);
        persistTimer.current = null;
        const pending = pendingPersist.current;
        pendingPersist.current = null;
        if (pending) {
          // 卸载前 debounce 未触发:补一次写入,避免最后的翻页/完成态丢失
          void api.updateReaderState(pending.workId, pending.next, pending.done).catch(() => {});
        }
      }
    };
  }, [sourceKey]);

  const pages = useMemo<ReaderPageItem[]>(() => {
    if (stableSource.kind === "local") {
      return localPages.map((page) => ({
        key: `local-${page.id}`,
        pageIndex: page.page_index,
        src: `/api/works/${stableSource.workId}/pages/${page.page_index}`,
      }));
    }
    return (gallery?.pages ?? [])
      .filter((page) => page.url)
      .map((page, index) => ({
        key: `remote-${page.index ?? index + 1}`,
        pageIndex: page.index ?? index + 1,
        src: page.url!,
      }));
  }, [gallery?.pages, localPages, stableSource]);

  const pageCount =
    stableSource.kind === "local"
      ? state?.page_count || pages.length
      : pages.length || gallery?.page_count || 0;

  const title = isRemote
    ? gallery?.title.japanese || gallery?.title.pretty || gallery?.title.english || `Gallery ${(stableSource as { galleryId: number }).galleryId}`
    : work?.title || "NH Archive";

  const coverSrc = isRemote
    ? gallery?.thumbnail?.url || gallery?.cover?.url || null
    : work
      ? `/api/works/${work.id}/cover`
      : null;

  const tags = useMemo<ReaderTag[]>(() => {
    if (!isRemote || !gallery) return [];
    return gallery.tags.map((tag) => ({ id: tag.id, type: tag.type, display: tag.display || tag.name }));
  }, [gallery, isRemote]);

  const progressPercent = pageCount ? Math.round((pageIndex / pageCount) * 100) : 0;

  const persistLocal = useCallback(
    (next: number, done: boolean) => {
      if (stableSource.kind !== "local") return;
      if (persistTimer.current) window.clearTimeout(persistTimer.current);
      const workId = stableSource.workId;
      pendingPersist.current = { workId, next, done };
      persistTimer.current = window.setTimeout(() => {
        persistTimer.current = null;
        pendingPersist.current = null;
        api
          .updateReaderState(workId, next, done)
          .then((updated) => setState(updated))
          .catch((exc) => setError(exc instanceof Error ? exc.message : String(exc)));
      }, PERSIST_DEBOUNCE_MS);
    },
    [stableSource]
  );

  const setPage = useCallback(
    (next: number, done = false) => {
      if (!pageCount) return;
      const bounded = clamp(next, 1, pageCount);
      const isDone = done || bounded >= pageCount;
      setPageIndex(bounded);
      setCompleted(isDone);
      persistLocal(bounded, isDone);
    },
    [pageCount, persistLocal]
  );

  const markCompleted = useCallback(() => setPage(pageCount, true), [pageCount, setPage]);

  const importRemote = useCallback(async () => {
    if (stableSource.kind !== "remote") return;
    setError(null);
    try {
      await api.importGallery(stableSource.galleryId);
      setNotice(`Gallery ${stableSource.galleryId} 已加入真实导入队列。`);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc));
    }
  }, [stableSource]);

  return {
    loading,
    error,
    notice,
    isRemote,
    sourceKey,
    title,
    coverSrc,
    tags,
    pages,
    pageIndex,
    pageCount,
    progressPercent,
    completed,
    work,
    gallery,
    setPage,
    markCompleted,
    importRemote,
  };
}
