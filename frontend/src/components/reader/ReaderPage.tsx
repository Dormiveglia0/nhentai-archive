import { ArrowLeft, BookMarked, ChevronLeft, ChevronRight, EyeOff, Maximize2, ScrollText, Star } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { api, PageInfo, ReaderState, Work } from "../../lib/api";
import { navigate } from "../../lib/navigation";

type Props = {
  workId: number;
  privacyMode: boolean;
};

type Mode = "single" | "scroll";

export function ReaderPage({ workId, privacyMode }: Props) {
  const [work, setWork] = useState<Work | null>(null);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [state, setState] = useState<ReaderState | null>(null);
  const [mode, setMode] = useState<Mode>("single");
  const [masked, setMasked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      try {
        const [nextWork, nextPages, nextState] = await Promise.all([
          api.work(workId),
          api.pages(workId),
          api.readerState(workId)
        ]);
        if (!cancelled) {
          setWork(nextWork);
          setPages(nextPages.result);
          setState(nextState);
        }
      } catch (exc) {
        if (!cancelled) setError(exc instanceof Error ? exc.message : String(exc));
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [workId]);

  useEffect(() => {
    document.title = privacyMode ? "NH Archive" : work?.title || "NH Archive";
    return () => {
      document.title = "NH Archive";
    };
  }, [privacyMode, work?.title]);

  const pageIndex = state?.page_index || 1;
  const pageCount = state?.page_count || pages.length;

  const savePage = useCallback(
    async (next: number, completed = false) => {
      if (!pageCount) return;
      const bounded = Math.max(1, Math.min(next, pageCount));
      setState((current) =>
        current
          ? {
              ...current,
              page_index: bounded,
              progress_percent: Math.round((bounded / pageCount) * 100),
              completed: completed || bounded >= pageCount
            }
          : current
      );
      try {
        setState(await api.updateReaderState(workId, bounded, completed || bounded >= pageCount));
      } catch (exc) {
        setError(exc instanceof Error ? exc.message : String(exc));
      }
    },
    [pageCount, workId]
  );

  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") void savePage(pageIndex + 1);
      if (event.key === "ArrowLeft") void savePage(pageIndex - 1);
      if (event.key.toLowerCase() === "h") setMasked((value) => !value);
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [pageIndex, savePage]);

  const visiblePages = useMemo(() => {
    if (mode === "scroll") {
      const start = Math.max(1, pageIndex - 2);
      const end = Math.min(pageCount, pageIndex + 4);
      return pages.filter((page) => page.page_index >= start && page.page_index <= end);
    }
    return pages.filter((page) => page.page_index === pageIndex);
  }, [mode, pageCount, pageIndex, pages]);

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
        <button className="back-button" type="button" onClick={() => navigate({ name: "library" })}>
          <ArrowLeft size={17} />
          返回库
        </button>
        {work ? (
          <div className="reader-work">
            {work.cover_path ? <img src={`/api/works/${work.id}/cover`} alt="" /> : null}
            <h1>{work.title}</h1>
            <p>{pageIndex} / {pageCount} 页 · {state?.progress_percent ?? 0}%</p>
          </div>
        ) : null}
        <div className="chapter-list">
          {pages.map((page) => (
            <button
              key={page.id}
              className={page.page_index === pageIndex ? "active" : ""}
              type="button"
              onClick={() => savePage(page.page_index)}
            >
              第 {page.page_index} 页
            </button>
          ))}
        </div>
      </aside>

      <div className="reader-main">
        <div className="reader-toolbar">
          <button type="button" onClick={() => savePage(pageIndex - 1)}>
            <ChevronLeft size={17} />
            上一页
          </button>
          <strong>{pageIndex}</strong>
          <span>/ {pageCount}</span>
          <button type="button" onClick={() => savePage(pageIndex + 1)}>
            下一页
            <ChevronRight size={17} />
          </button>
          <progress max="100" value={state?.progress_percent ?? 0} />
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
        </div>

        <div className={masked ? "page-stage masked" : "page-stage"}>
          {visiblePages.map((page) => (
            <img
              key={page.id}
              src={`/api/works/${workId}/pages/${page.page_index}`}
              alt={`Page ${page.page_index}`}
              loading={mode === "scroll" ? "lazy" : "eager"}
              onLoad={() => {
                if (mode === "scroll" && page.page_index > pageIndex) void savePage(page.page_index);
              }}
            />
          ))}
          {visiblePages.length === 0 ? <p>此作品没有可读取页面。</p> : null}
        </div>
      </div>

      <aside className="reader-inspector">
        <div className="reader-tabs">
          <button className="active" type="button">作品信息</button>
          <button type="button">阅读设置</button>
        </div>
        <div className="reader-info">
          <BookMarked size={18} />
          <strong>{work?.title || "读取中"}</strong>
          <p>当前进度 {state?.progress_percent ?? 0}%</p>
          <button type="button" onClick={() => savePage(pageCount, true)}>
            <Star size={17} />
            标记已读
          </button>
          <button type="button" disabled>进入治理将在后续模块接入</button>
        </div>
      </aside>
    </section>
  );
}
