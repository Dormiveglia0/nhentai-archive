import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api, type GalleryDetail, type PageInfo, type ReaderState, type Work } from "../../lib/api";
import { clamp, PERSIST_DEBOUNCE_MS, type ReaderPageItem } from "./readerHelpers";

export type ReaderSource =
  | { kind: "local"; workId: number }
  | { kind: "remote"; galleryId: number };

export type ReaderTag = { id: number; type: string; display: string };

export function useReaderData(source: ReaderSource) {
  const localWorkId = source.kind === "local" ? source.workId : null;
  const remoteGalleryId = source.kind === "remote" ? source.galleryId : null;
  const stableSource = useMemo<ReaderSource>(
    () => localWorkId !== null ? { kind: "local", workId: localWorkId } : { kind: "remote", galleryId: remoteGalleryId! },
    [localWorkId, remoteGalleryId],
  );
  const sourceKey = stableSource.kind === "local" ? `local:${stableSource.workId}` : `remote:${stableSource.galleryId}`;

  const [work, setWork] = useState<Work | null>(null);
  const [gallery, setGallery] = useState<GalleryDetail | null>(null);
  const [localPages, setLocalPages] = useState<PageInfo[]>([]);
  const [state, setState] = useState<ReaderState | null>(null);
  const [pageIndex, setPageIndex] = useState(1);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [queued, setQueued] = useState(false);
  const [revision, setRevision] = useState(0);

  const loadRequest = useRef(0);
  const importRequest = useRef(0);
  const mounted = useRef(true);
  const currentSourceKey = useRef(sourceKey);
  currentSourceKey.current = sourceKey;
  const persistTimer = useRef<number | null>(null);
  const pendingPersist = useRef<{ workId: number; next: number; done: boolean } | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      loadRequest.current += 1;
      importRequest.current += 1;
    };
  }, []);

  useEffect(() => {
    const request = ++loadRequest.current;
    importRequest.current += 1;
    setLoading(true);
    setError(null);
    setActionError(null);
    setNotice(null);
    setImporting(false);
    setQueued(false);
    setWork(null);
    setGallery(null);
    setLocalPages([]);
    setState(null);
    setPageIndex(1);
    setCompleted(false);

    async function load() {
      try {
        if (stableSource.kind === "local") {
          const [nextWork, nextPages, nextState] = await Promise.all([
            api.work(stableSource.workId),
            api.pages(stableSource.workId),
            api.readerState(stableSource.workId),
          ]);
          if (request !== loadRequest.current) return;
          const pageCount = nextState.page_count || nextPages.result.length;
          setWork(nextWork);
          setLocalPages(nextPages.result);
          setState(nextState);
          setPageIndex(pageCount ? clamp(nextState.page_index || 1, 1, pageCount) : 1);
          setCompleted(Boolean(nextState.completed));
        } else {
          const detail = await api.gallery(stableSource.galleryId);
          if (request !== loadRequest.current) return;
          setGallery(detail);
        }
      } catch (reason) {
        if (request === loadRequest.current) setError(reason instanceof Error ? reason.message : String(reason));
      } finally {
        if (request === loadRequest.current) setLoading(false);
      }
    }

    void load();
    return () => {
      loadRequest.current += 1;
      if (!persistTimer.current) return;
      window.clearTimeout(persistTimer.current);
      persistTimer.current = null;
      const pending = pendingPersist.current;
      pendingPersist.current = null;
      if (pending) void api.updateReaderState(pending.workId, pending.next, pending.done).catch(() => undefined);
    };
  }, [revision, sourceKey, stableSource]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!actionError) return;
    const timer = window.setTimeout(() => setActionError(null), 5600);
    return () => window.clearTimeout(timer);
  }, [actionError]);

  const pages = useMemo<ReaderPageItem[]>(() => {
    if (stableSource.kind === "local") {
      return localPages.map((page) => ({
        key: `local-${page.id}`,
        pageIndex: page.page_index,
        src: `/api/works/${stableSource.workId}/pages/${page.page_index}`,
        thumbSrc: `/api/works/${stableSource.workId}/pages/${page.page_index}/thumb`,
      }));
    }
    return (gallery?.pages ?? []).filter((page) => Boolean(page.url)).map((page, index) => ({
      key: `remote-${page.index ?? index + 1}`,
      pageIndex: index + 1,
      src: page.url!,
    }));
  }, [gallery?.pages, localPages, stableSource]);

  const isRemote = stableSource.kind === "remote";
  const pageCount = isRemote ? pages.length : state?.page_count || pages.length;
  const title = isRemote
    ? gallery?.title.japanese || gallery?.title.pretty || gallery?.title.english || `Gallery ${remoteGalleryId}`
    : work?.title || "NH Archive";
  const coverSrc = isRemote ? gallery?.thumbnail?.url || gallery?.cover?.url || null : work ? `/api/works/${work.id}/cover` : null;
  const tags = useMemo<ReaderTag[]>(() => {
    if (!isRemote || !gallery) return [];
    return gallery.tags.map((tag) => ({ id: tag.id, type: tag.type, display: tag.display || tag.name }));
  }, [gallery, isRemote]);
  const progressPercent = pageCount ? Math.round((clamp(pageIndex, 1, pageCount) / pageCount) * 100) : 0;

  const persistLocal = useCallback((next: number, done: boolean) => {
    if (stableSource.kind !== "local") return;
    if (persistTimer.current) window.clearTimeout(persistTimer.current);
    const workId = stableSource.workId;
    const requestSource = sourceKey;
    pendingPersist.current = { workId, next, done };
    persistTimer.current = window.setTimeout(() => {
      persistTimer.current = null;
      pendingPersist.current = null;
      api.updateReaderState(workId, next, done)
        .then((updated) => {
          if (mounted.current && currentSourceKey.current === requestSource) setState(updated);
        })
        .catch((reason) => {
          if (mounted.current && currentSourceKey.current === requestSource) setActionError(reason instanceof Error ? reason.message : String(reason));
        });
    }, PERSIST_DEBOUNCE_MS);
  }, [sourceKey, stableSource]);

  const setPage = useCallback((next: number, done = false) => {
    if (!pageCount) return;
    const bounded = clamp(next, 1, pageCount);
    const isDone = done || bounded >= pageCount;
    setPageIndex(bounded);
    setCompleted(isDone);
    setActionError(null);
    persistLocal(bounded, isDone);
  }, [pageCount, persistLocal]);

  const markCompleted = useCallback(() => setPage(pageCount, true), [pageCount, setPage]);

  const importRemote = useCallback(async () => {
    if (stableSource.kind !== "remote" || importing || queued) return;
    const request = ++importRequest.current;
    setImporting(true);
    setActionError(null);
    try {
      await api.importGallery(stableSource.galleryId);
      if (!mounted.current || request !== importRequest.current) return;
      setQueued(true);
      setNotice(`Gallery ${stableSource.galleryId} 已提交到导入队列。`);
    } catch (reason) {
      if (mounted.current && request === importRequest.current) setActionError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      if (mounted.current && request === importRequest.current) setImporting(false);
    }
  }, [importing, queued, stableSource]);

  return {
    loading,
    error,
    actionError,
    notice,
    importing,
    queued,
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
    reload: () => setRevision((value) => value + 1),
  };
}
