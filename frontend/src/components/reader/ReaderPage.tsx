import { ArrowLeft, BookMarked, ChevronLeft, ChevronRight, Download, EyeOff, Maximize2, ScrollText, Star } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { api, GalleryDetail, PageInfo, ReaderState, Work } from "../../lib/api";
import { FadeIn } from "../../lib/motion";
import { navigate } from "../../lib/navigation";

type Props = {
  source: { kind: "local"; workId: number } | { kind: "remote"; galleryId: number };
  privacyMode: boolean;
};

type Mode = "single" | "scroll";
type ReaderPageItem = {
  key: string;
  pageIndex: number;
  src: string;
};

export function ReaderPage({ source, privacyMode }: Props) {
  const [work, setWork] = useState<Work | null>(null);
  const [gallery, setGallery] = useState<GalleryDetail | null>(null);
  const [localPages, setLocalPages] = useState<PageInfo[]>([]);
  const [state, setState] = useState<ReaderState | null>(null);
  const [remotePageIndex, setRemotePageIndex] = useState(1);
  const [mode, setMode] = useState<Mode>("single");
  const [masked, setMasked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isRemote = source.kind === "remote";
  const sourceKey = source.kind === "local" ? `local:${source.workId}` : `remote:${source.galleryId}`;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      setNotice(null);
      setWork(null);
      setGallery(null);
      setLocalPages([]);
      setState(null);
      setRemotePageIndex(1);
      try {
        if (source.kind === "local") {
          const [nextWork, nextPages, nextState] = await Promise.all([
            api.work(source.workId),
            api.pages(source.workId),
            api.readerState(source.workId),
          ]);
          if (!cancelled) {
            setWork(nextWork);
            setLocalPages(nextPages.result);
            setState(nextState);
          }
        } else {
          const detail = await api.gallery(source.galleryId);
          if (!cancelled) setGallery(detail);
        }
      } catch (exc) {
        if (!cancelled) setError(exc instanceof Error ? exc.message : String(exc));
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [source, sourceKey]);

  const title = isRemote
    ? gallery?.title.japanese || gallery?.title.pretty || gallery?.title.english || `Gallery ${source.galleryId}`
    : work?.title || "NH Archive";

  useEffect(() => {
    document.title = privacyMode ? "NH Archive" : title;
    return () => {
      document.title = "NH Archive";
    };
  }, [privacyMode, title]);

  const readerPages = useMemo<ReaderPageItem[]>(() => {
    if (source.kind === "local") {
      return localPages.map((page) => ({
        key: `local-${page.id}`,
        pageIndex: page.page_index,
        src: `/api/works/${source.workId}/pages/${page.page_index}`,
      }));
    }
    return (gallery?.pages ?? [])
      .filter((page) => page.url)
      .map((page, index) => ({
        key: `remote-${page.index ?? index + 1}`,
        pageIndex: page.index ?? index + 1,
        src: page.url!,
      }));
  }, [gallery?.pages, localPages, source]);

  const pageCount = source.kind === "local" ? state?.page_count || readerPages.length : readerPages.length || gallery?.page_count || 0;
  const pageIndex = source.kind === "local" ? state?.page_index || 1 : remotePageIndex;
  const progressPercent = pageCount ? Math.round((pageIndex / pageCount) * 100) : 0;

  const setPage = useCallback(
    async (next: number, completed = false) => {
      if (!pageCount) return;
      const bounded = Math.max(1, Math.min(next, pageCount));
      if (source.kind === "remote") {
        setRemotePageIndex(bounded);
        return;
      }
      setState((current) =>
        current
          ? {
              ...current,
              page_index: bounded,
              progress_percent: Math.round((bounded / pageCount) * 100),
              completed: completed || bounded >= pageCount,
            }
          : current
      );
      try {
        setState(await api.updateReaderState(source.workId, bounded, completed || bounded >= pageCount));
      } catch (exc) {
        setError(exc instanceof Error ? exc.message : String(exc));
      }
    },
    [pageCount, source]
  );

  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") void setPage(pageIndex + 1);
      if (event.key === "ArrowLeft") void setPage(pageIndex - 1);
      if (event.key.toLowerCase() === "h") setMasked((value) => !value);
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [pageIndex, setPage]);

  const visiblePages = useMemo(() => {
    if (mode === "scroll") {
      const start = Math.max(1, pageIndex - 2);
      const end = Math.min(pageCount, pageIndex + 4);
      return readerPages.filter((page) => page.pageIndex >= start && page.pageIndex <= end);
    }
    return readerPages.filter((page) => page.pageIndex === pageIndex);
  }, [mode, pageCount, pageIndex, readerPages]);

  async function importRemote() {
    if (source.kind !== "remote") return;
    setError(null);
    try {
      await api.importGallery(source.galleryId);
      setNotice(`Gallery ${source.galleryId} 已加入真实导入队列。`);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc));
    }
  }

  if (error) {
    return (
      <section className="reader-page">
        <div className="notice error">{error}</div>
      </section>
    );
  }

  return (
    <section className="reader-page">
      <aside className="reader-sidebar">
        <FadeIn key={sourceKey} x={-12}>
        <button className="back-button" type="button" onClick={() => navigate({ name: isRemote ? "discover" : "library" })}>
          <ArrowLeft size={17} />
          {isRemote ? "返回发现" : "返回库"}
        </button>
        <div className="reader-work">
          {!isRemote && work?.cover_path ? <img src={`/api/works/${work.id}/cover`} alt="" /> : null}
          {isRemote && gallery?.thumbnail?.url ? <img src={gallery.thumbnail.url} alt="" /> : null}
          <h1>{title}</h1>
          <p>
            {pageIndex} / {pageCount} 页 · {progressPercent}%
          </p>
          {isRemote ? <small>远端只读预览，不保存阅读进度</small> : null}
        </div>
        <div className="chapter-list">
          {readerPages.map((page) => (
            <button
              key={page.key}
              className={page.pageIndex === pageIndex ? "active" : ""}
              type="button"
              onClick={() => setPage(page.pageIndex)}
            >
              第 {page.pageIndex} 页
            </button>
          ))}
        </div>
        </FadeIn>
      </aside>

      <div className="reader-main">
        <FadeIn key={sourceKey} y={8}>
        <div className="reader-toolbar">
          <button type="button" onClick={() => setPage(pageIndex - 1)} disabled={pageIndex <= 1}>
            <ChevronLeft size={17} />
            上一页
          </button>
          <strong>{pageIndex}</strong>
          <span>/ {pageCount}</span>
          <button type="button" onClick={() => setPage(pageIndex + 1)} disabled={pageIndex >= pageCount}>
            下一页
            <ChevronRight size={17} />
          </button>
          <progress max="100" value={progressPercent} />
          <button className={mode === "single" ? "active" : ""} type="button" onClick={() => setMode("single")}>
            <Maximize2 size={17} />
            单页
          </button>
          <button className={mode === "scroll" ? "active" : ""} type="button" onClick={() => setMode("scroll")}>
            <ScrollText size={17} />
            连续滚动
          </button>
          <button type="button" onClick={() => setMasked((value) => !value)}>
            <EyeOff size={17} />
            隐私遮罩
          </button>
          {isRemote ? (
            <button className="primary-action" type="button" onClick={importRemote}>
              <Download size={17} />
              加入队列
            </button>
          ) : null}
        </div>

        {notice ? <div className="notice slim">{notice}</div> : null}
        <div className={masked ? "page-stage masked" : "page-stage"}>
          {visiblePages.map((page) => (
            <FadeIn key={page.key} className="reader-page-cell" y={10}>
              <img
                src={page.src}
                alt={`Page ${page.pageIndex}`}
                loading={mode === "scroll" ? "lazy" : "eager"}
                onLoad={() => {
                  if (mode === "scroll" && page.pageIndex > pageIndex) void setPage(page.pageIndex);
                }}
              />
            </FadeIn>
          ))}
          {visiblePages.length === 0 ? <p>{isRemote ? "远端详情未返回可阅读页面 URL。" : "此作品没有可读取页面。"}</p> : null}
        </div>
        </FadeIn>
      </div>

      <aside className="reader-inspector">
        <FadeIn key={sourceKey} x={12}>
        <div className="reader-tabs">
          <button className="active" type="button">
            作品信息
          </button>
          <button type="button">阅读设置</button>
        </div>
        <div className="reader-info">
          <BookMarked size={18} />
          <strong>{title}</strong>
          <p>当前进度 {progressPercent}%</p>
          {!isRemote ? (
            <button type="button" onClick={() => setPage(pageCount, true)}>
              <Star size={17} />
              标记已读
            </button>
          ) : (
            <button type="button" onClick={importRemote}>
              <Download size={17} />
              加入导入队列
            </button>
          )}
          {!isRemote && work ? (
            <button type="button" onClick={() => navigate({ name: "governance", workId: work.id })}>
              进入治理
            </button>
          ) : null}
        </div>
        </FadeIn>
      </aside>
    </section>
  );
}
