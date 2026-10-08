import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api, type GalleryDetail, type Job, type LibraryWork, type PageInfo } from "../../lib/api";
import { clamp, PERSIST_DEBOUNCE_MS, type ReaderPageItem } from "./readerHelpers";

export type ReaderSource =
  | { kind: "local"; workId: number }
  | { kind: "remote"; galleryId: number };

export type ReaderTag = { id: number; type: string; name?: string; slug?: string; display: string };

export function useReaderData(source: ReaderSource) {
  const localWorkId = source.kind === "local" ? source.workId : null;
  const remoteGalleryId = source.kind === "remote" ? source.galleryId : null;
  const stableSource = useMemo<ReaderSource>(
    () => localWorkId !== null ? { kind: "local", workId: localWorkId } : { kind: "remote", galleryId: remoteGalleryId! },
    [localWorkId, remoteGalleryId],
  );
  const sourceKey = stableSource.kind === "local" ? `local:${stableSource.workId}` : `remote:${stableSource.galleryId}`;

  const [work, setWork] = useState<LibraryWork | null>(null);
  const [gallery, setGallery] = useState<GalleryDetail | null>(null);
  const [localPages, setLocalPages] = useState<PageInfo[]>([]);
  const [pageIndex, setPageIndex] = useState(1);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [queued, setQueued] = useState(false);
  const [revision, setRevision] = useState(0);
  const [cacheLease, setCacheLease] = useState<string | null>(null);
  const [preparingJob, setPreparingJob] = useState<Job | null>(null);

  const loadRequest = useRef(0);
  const importRequest = useRef(0);
  const mounted = useRef(true);
  const currentSourceKey = useRef(sourceKey);
  currentSourceKey.current = sourceKey;
  const persistTimer = useRef<number | null>(null);
  const pendingPersist = useRef<{ workId: number; next: number; done: boolean; lease: string | null } | null>(null);
  const persistTail = useRef<Promise<unknown>>(Promise.resolve());

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
    let openedLease: string | null = null;
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
    setPageIndex(1);
    setCompleted(false);
    setCacheLease(null);
    setPreparingJob(null);

    async function load() {
      try {
        if (stableSource.kind === "local") {
          const [nextWork, nextPages, nextState] = await Promise.all([
            api.work(stableSource.workId),
            api.pages(stableSource.workId),
            api.readerState(stableSource.workId),
          ]);
          if (request !== loadRequest.current) return;
          let prepared = await api.prepareReadingSource(stableSource.workId);
          while (!["ready", "direct", "failed", "cancelled"].includes(prepared.status)) {
            if (request !== loadRequest.current) return;
            setPreparingJob(prepared.job ?? null);
            await new Promise((resolve) => window.setTimeout(resolve, 800));
            if (request !== loadRequest.current) return;
            prepared = await api.prepareReadingSource(stableSource.workId);
          }
          openedLease = prepared.lease;
          if (request !== loadRequest.current) {
            if (openedLease) void api.releaseReadingSource(stableSource.workId, openedLease).catch(() => undefined);
            return;
          }
          setPreparingJob(prepared.job ?? null);
          if (prepared.status === "failed" || prepared.status === "cancelled") {
            throw new Error(prepared.error || prepared.job?.error || "阅读准备已取消");
          }
          const readyPages = prepared.pages ?? nextPages.result;
          const pageCount = readyPages.length;
          setWork(nextWork);
          setLocalPages(readyPages);
          setCacheLease(openedLease);
          setPageIndex(pageCount ? clamp(nextState.page_index || 1, 1, pageCount) : 1);
          setCompleted(Boolean(nextState.completed) && nextState.page_count === pageCount);
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

    const flush = () => {
      if (persistTimer.current) window.clearTimeout(persistTimer.current);
      persistTimer.current = null;
      const pending = pendingPersist.current;
      pendingPersist.current = null;
      if (pending) persistTail.current = persistTail.current.catch(() => undefined)
        .then(() => api.updateReaderState(pending.workId, pending.next, pending.done, pending.lease, true)).catch(() => undefined);
      return persistTail.current;
    };
    const release = () => {
      const flushed = flush();
      if (openedLease && stableSource.kind === "local") {
        const lease = openedLease;
        void flushed.then(() => api.releaseReadingSource(stableSource.workId, lease)).catch(() => undefined);
      }
    };
    const onPageHide = (event: PageTransitionEvent) => { if (event.persisted) void flush(); else release(); };
    const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) setRevision((value) => value + 1); };
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    void load();
    return () => {
      loadRequest.current += 1;
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      release();
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
        key: `local-${stableSource.workId}-${cacheLease || "direct"}-${page.page_index}`,
        pageIndex: page.page_index,
        src: `/api/works/${stableSource.workId}/pages/${page.page_index}${cacheLease ? `?lease=${cacheLease}` : ""}`,
        thumbSrc: `/api/works/${stableSource.workId}/pages/${page.page_index}/thumb${cacheLease ? `?lease=${cacheLease}` : ""}`,
      }));
    }
    return (gallery?.pages ?? []).filter((page) => Boolean(page.url)).map((page, index) => ({
      key: `remote-${page.index ?? index + 1}`,
      pageIndex: index + 1,
      src: page.url!,
    }));
  }, [cacheLease, gallery?.pages, localPages, stableSource]);

  const isRemote = stableSource.kind === "remote";
  const pageCount = pages.length;
  const title = isRemote
    ? gallery?.title.japanese || gallery?.title.pretty || gallery?.title.english || `Gallery ${remoteGalleryId}`
    : work?.title || "NH Archive";
  const coverSrc = isRemote ? gallery?.thumbnail?.url || gallery?.cover?.url || null : work ? `/api/works/${work.id}/cover` : null;
  const tags = useMemo<ReaderTag[]>(() => {
    const sourceTags = isRemote ? gallery?.tags : work?.tags;
    return (sourceTags ?? []).map((tag) => ({
      id: tag.id,
      type: tag.type || "tag",
      name: tag.name,
      slug: tag.slug,
      display: tag.display || tag.name || tag.slug || String(tag.id),
    }));
  }, [gallery?.tags, isRemote, work?.tags]);
  const progressPercent = pageCount ? Math.round((clamp(pageIndex, 1, pageCount) / pageCount) * 100) : 0;

  const persistLocal = useCallback((next: number, done: boolean) => {
    if (stableSource.kind !== "local") return;
    if (persistTimer.current) window.clearTimeout(persistTimer.current);
    const workId = stableSource.workId;
    const requestSource = sourceKey;
    pendingPersist.current = { workId, next, done, lease: cacheLease };
    persistTimer.current = window.setTimeout(() => {
      persistTimer.current = null;
      pendingPersist.current = null;
      persistTail.current = persistTail.current.catch(() => undefined)
        .then(() => api.updateReaderState(workId, next, done, cacheLease))
        .catch((reason) => {
          if (mounted.current && currentSourceKey.current === requestSource) setActionError(reason instanceof Error ? reason.message : String(reason));
        });
    }, PERSIST_DEBOUNCE_MS);
  }, [cacheLease, sourceKey, stableSource]);

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

  const toggleFavorite = useCallback(async () => {
    if (!work) return;
    setActionError(null);
    try {
      const updated = await api.setWorkFavorite(work.id, !work.favorite);
      if (!mounted.current || currentSourceKey.current !== sourceKey) return;
      setWork(updated);
      setNotice(updated.favorite ? "已加入收藏。" : "已取消收藏。");
    } catch (reason) {
      if (mounted.current && currentSourceKey.current === sourceKey) {
        setActionError(reason instanceof Error ? reason.message : String(reason));
      }
    }
  }, [sourceKey, work]);

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
    cacheLease,
    preparingJob,
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
    toggleFavorite,
    importRemote,
    reload: () => {
      if (preparingJob && ["failed", "cancelled"].includes(preparingJob.status)) {
        void api.retryJob(preparingJob.id).then(() => setRevision((value) => value + 1))
          .catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)));
      } else setRevision((value) => value + 1);
    },
  };
}
