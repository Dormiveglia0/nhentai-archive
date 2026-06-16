import { Info, Library } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { api, LibrarySummary, LibraryTag, LibraryTagFilter, LibraryWork } from "../../lib/api";
import { ContinueReadingRow } from "./ContinueReadingRow";
import { IconPager } from "../discover/IconPager";
import { LibrarySummaryStrip } from "./LibrarySummaryStrip";
import { LibraryToolbar, LibraryView } from "./LibraryToolbar";
import { WorkCard } from "./WorkCard";
import { WorkInspector } from "./WorkInspector";

type Props = {
  blurCovers: boolean;
};

const PER_PAGE = 24;

export function LibraryPage({ blurCovers }: Props) {
  const [summary, setSummary] = useState<LibrarySummary | null>(null);
  const [continueReading, setContinueReading] = useState<LibraryWork[]>([]);
  const [recentAdded, setRecentAdded] = useState<LibraryWork[]>([]);

  const [works, setWorks] = useState<LibraryWork[]>([]);
  const [total, setTotal] = useState(0);
  const [numPages, setNumPages] = useState(1);
  const [selected, setSelected] = useState<LibraryWork | null>(null);

  const [q, setQ] = useState("");
  const [language, setLanguage] = useState("all");
  const [readStatus, setReadStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [sort, setSort] = useState("recent_updated");
  const [tags, setTags] = useState<LibraryTagFilter[]>([]);
  const [view, setView] = useState<LibraryView>("grid");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const token = useRef(0);

  const filtersActive =
    Boolean(q) || language !== "all" || readStatus !== "all" || source !== "all" || tags.length > 0;

  const loadOverview = useCallback(async () => {
    try {
      const [summaryPayload, cont, added] = await Promise.all([
        api.librarySummary(),
        api.libraryContinueReading(12),
        api.libraryRecentAdded(12),
      ]);
      setSummary(summaryPayload);
      setContinueReading(cont.result);
      setRecentAdded(added.result);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : String(exc));
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    const current = ++token.current;
    setLoading(true);
    setError(null);
    api
      .librarySearch({
        q,
        page,
        per_page: PER_PAGE,
        sort,
        read_status: readStatus,
        source,
        language,
        tag_ids: tags.map((tag) => tag.id),
      })
      .then((payload) => {
        if (token.current !== current) return;
        setWorks(payload.result);
        setTotal(payload.total);
        setNumPages(payload.num_pages);
        setSelected((prev) => {
          if (prev && payload.result.some((work) => work.id === prev.id)) return prev;
          return payload.result[0] ?? null;
        });
      })
      .catch((exc) => {
        if (token.current !== current) return;
        setError(exc instanceof Error ? exc.message : String(exc));
        setWorks([]);
        setTotal(0);
        setNumPages(1);
      })
      .finally(() => {
        if (token.current === current) setLoading(false);
      });
  }, [q, page, sort, readStatus, source, language, tags]);

  function resetFilters() {
    setQ("");
    setLanguage("all");
    setReadStatus("all");
    setSource("all");
    setTags([]);
    setPage(1);
  }

  function changeFilter(apply: () => void) {
    apply();
    setPage(1);
  }

  function pickTag(tag: LibraryTag) {
    if (tags.some((item) => item.id === tag.id)) return;
    changeFilter(() => setTags([...tags, { id: tag.id, type: tag.type, name: tag.name, slug: tag.slug, display: tag.display, count: 0 }]));
  }

  const emptyLibrary = summary?.total === 0;

  return (
    <section className="page library-page">
      <div className="hero">
        <div>
          <h1>我的库</h1>
          <p>专属的同人志档案馆，所有条目都来自真实入库的 CBZ 与本地索引。</p>
          <LibrarySummaryStrip summary={summary} />
        </div>
        <div className="sketch" aria-hidden="true" />
      </div>

      <LibraryToolbar
        q={q}
        onQ={(value) => changeFilter(() => setQ(value))}
        language={language}
        onLanguage={(value) => changeFilter(() => setLanguage(value))}
        readStatus={readStatus}
        onReadStatus={(value) => changeFilter(() => setReadStatus(value))}
        source={source}
        onSource={(value) => changeFilter(() => setSource(value))}
        sort={sort}
        onSort={(value) => changeFilter(() => setSort(value))}
        tags={tags}
        onTags={(next) => changeFilter(() => setTags(next))}
        view={view}
        onView={setView}
        summary={summary}
        canReset={filtersActive}
        onReset={resetFilters}
      />

      {error ? <div className="notice error">{error}</div> : null}

      {emptyLibrary && !error ? (
        <div className="empty-state">
          <Library size={26} />
          <strong>库里还没有作品</strong>
          <p>先在发现页导入真实 CBZ，导入完成后即可在这里筛选、继续阅读与管理。</p>
        </div>
      ) : null}

      {!emptyLibrary && !filtersActive ? (
        <>
          <ContinueReadingRow title="继续阅读" works={continueReading} blurCovers={blurCovers} />
          <ContinueReadingRow title="最近添加" works={recentAdded} blurCovers={blurCovers} />
        </>
      ) : null}

      {!emptyLibrary ? (
        <div className="library-layout">
          <div className="library-results">
            <div className="library-results-head">
              <span>
                {loading ? "读取中…" : `共 ${total.toLocaleString()} 部作品`}
                {filtersActive ? " · 已筛选" : ""}
              </span>
            </div>

            {!loading && works.length === 0 && !error ? (
              <div className="empty-state compact">
                <Info size={22} />
                <strong>没有符合条件的作品</strong>
                <p>调整筛选条件或点击重置查看全部馆藏。</p>
              </div>
            ) : (
              <div className={view === "grid" ? "library-grid" : "library-list"}>
                {works.map((work) => (
                  <WorkCard
                    key={work.id}
                    work={work}
                    view={view}
                    blurCovers={blurCovers}
                    selected={selected?.id === work.id}
                    onSelect={() => setSelected(work)}
                    onPickTag={pickTag}
                  />
                ))}
              </div>
            )}

            <IconPager page={page} totalPages={numPages} loading={loading} onPage={setPage} />
          </div>

          <WorkInspector
            work={selected}
            blurCovers={blurCovers}
            onClose={() => setSelected(null)}
            onPickTag={pickTag}
          />
        </div>
      ) : null}
    </section>
  );
}
