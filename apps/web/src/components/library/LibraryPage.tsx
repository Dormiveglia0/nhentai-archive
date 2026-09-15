import { AlertTriangle, Clock3, Info, Library } from "lucide-react";
import { useRef, useState } from "react";
import { SectionSwitch } from "../folio/ui/SectionSwitch";
import { AnimatePresence, m } from "motion/react";

import { duration, ease, SelectionStage, Stagger, StaggerItem } from "../../lib/motion";
import { pageHref } from "../../lib/navigation";
import { balanceGridRows, completeGridRows, useGridColumns } from "../../lib/useGridColumns";
import { IconPager } from "../folio/ui/IconPager";
import { FolioEmptyState, FolioPanelHeading } from "../folio/ui/FolioPrimitives";
import { ContinueReadingRow } from "../folio/ui/ContinueReadingRow";
import { LibraryBatchTray } from "./LibraryBatchTray";
import { LibrarySummaryStrip } from "./LibrarySummaryStrip";
import { LibraryToolbar } from "./LibraryToolbar";
import { WorkCard } from "./WorkCard";
import { WorkInspector } from "./WorkInspector";
import { useLibraryState } from "./useLibraryState";
import "./LibraryPage.css";

let previousShelf: "reading" | "recent" = "reading";

export function LibraryPage({ blurCovers }: { blurCovers: boolean }) {
  const origin = useRef<HTMLElement | null>(null);
  const [shelf, updateShelf] = useState(previousShelf);
  function setShelf(value: "reading" | "recent") { previousShelf = value; updateShelf(value); }
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [gridRef, gridColumns] = useGridColumns();
  const library = useLibraryState(completeGridRows(24, gridColumns));
  const gridRows = balanceGridRows(library.works.length, gridColumns);

  return (
    <section className="folio-page-body folio-library-page">
      <LibrarySummaryStrip summary={library.summary} />

      <div className="library-workspace">
      <aside className={`library-filter-rail${filtersOpen ? " is-open" : ""}`}>
      <button className="library-filter-trigger" type="button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}>搜索与筛选{library.filtersActive ? " · 已筛选" : ""}</button>
      <LibraryToolbar
        q={library.q}
        onQ={library.setQ}
        language={library.language}
        onLanguage={library.setLanguage}
        readStatus={library.readStatus}
        onReadStatus={library.setReadStatus}
        source={library.source}
        onSource={library.setSource}
        sort={library.sort}
        onSort={library.setSort}
        tags={library.tags}
        onTags={library.setTags}
        favoriteOnly={library.favoriteOnly}
        onFavoriteOnly={library.setFavoriteOnly}
        view={library.view}
        onView={library.setView}
        summary={library.summary}
        canReset={library.filtersActive}
        onReset={library.resetFilters}
      />
      </aside>
      <div className="library-content">

      {library.error ? (
        <div className="folio-library-error" role="alert">
          <AlertTriangle size={17} />
          <span>{library.error}</span>
        </div>
      ) : null}

      {library.emptyLibrary && !library.error ? (
        <section className="folio-ruled-panel folio-library-empty-library">
          <FolioEmptyState
            icon={Library}
            title="库里还没有作品"
            copy="从发现页导入漫画，或在文件页扫描本地 CBZ。"
            action="前往发现页"
            actionHref={pageHref({ name: "discover" })}
          />
        </section>
      ) : null}

      {!library.emptyLibrary && !library.filtersActive ? (
        <section className="library-recent-section">
          <SectionSwitch label="最近作品" value={shelf} onChange={setShelf} items={[{value: "reading", label: "继续阅读"}, {value: "recent", label: "最近添加"}]} />
          <SelectionStage selection={shelf} className="folio-library-shelves">
            <ContinueReadingRow title={shelf === "reading" ? "继续阅读" : "最近添加"} works={shelf === "reading" ? library.continueReading : library.recentAdded} blurCovers={blurCovers} />
          </SelectionStage>
        </section>
      ) : null}

      {!library.emptyLibrary ? (
        <div className="folio-library-browser">
          <section className="folio-library-results" aria-busy={library.loading}>
            <header className="folio-library-results-head">
              <FolioPanelHeading
                title="作品列表"
                description={library.filtersActive ? "已按当前条件筛选。" : "全部已收藏的漫画。"}
              />
              <div className="folio-library-result-controls">
                <span>{library.loading ? "读取中…" : `${library.total.toLocaleString()} 部作品`}</span>
                <a className="folio-library-history-link" href={pageHref({ name: "history" })}>
                  <Clock3 size={14} />
                  <span>阅读历史</span>
                </a>
                {library.multiSelect ? (
                  <button type="button" onClick={library.selectAllOnPage} disabled={library.works.length === 0}>
                    选中本页
                  </button>
                ) : null}
                <button
                  type="button"
                  className={library.multiSelect ? "is-active" : ""}
                  onClick={library.toggleMultiSelect}
                  aria-pressed={library.multiSelect}
                >
                  {library.multiSelect ? "退出多选" : "批量选择"}
                </button>
              </div>
            </header>

            <AnimatePresence initial={false}>
              {library.multiSelect ? (
                <m.div
                  key="batch"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: duration.fast, ease: ease.standard }}
                  className="folio-library-batch-wrap"
                >
                  <LibraryBatchTray
                    selectedIds={Array.from(library.selectedIds)}
                    onClear={library.clearSelectedIds}
                    onDone={library.afterBulkAction}
                  />
                </m.div>
              ) : null}
            </AnimatePresence>

            {!library.loading && library.works.length === 0 && !library.error ? (
              <div className="folio-library-empty-results">
                <FolioEmptyState
                  icon={Info}
                  title="没有符合条件的作品"
                  copy="调整搜索、标签或筛选条件，或者重置后查看全部作品。"
                  action="重置筛选"
                  onAction={library.resetFilters}
                />
              </div>
            ) : (
              <div className={library.loading ? "folio-library-cards is-loading" : "folio-library-cards"}>
                <div ref={gridRef} className="folio-library-grid-measure" aria-hidden="true" />
                <Stagger
                  key={library.view}
                  className={library.view === "grid" ? "folio-library-grid" : "folio-library-list"}
                  style={library.view === "grid" ? gridRows.style : undefined}
                >
                  {library.works.map((work, index) => (
                    <StaggerItem key={work.id} className={`folio-library-card-cell${library.view === "grid" && index >= gridRows.tailStart ? " is-balanced-tail" : ""}`}>
                      <WorkCard
                        work={work}
                        view={library.view}
                        blurCovers={blurCovers}
                        selected={library.selected?.id === work.id}
                        onSelect={(node) => { origin.current = node; library.setSelected(work); }}
                        onPickTag={library.pickTag}
                        onToggleFavorite={() => void library.toggleFavorite(work)}
                        multiSelect={library.multiSelect}
                        checked={library.selectedIds.has(work.id)}
                        onToggle={() => library.toggleSelectedId(work.id)}
                      />
                    </StaggerItem>
                  ))}
                </Stagger>
              </div>
            )}

            <IconPager
              className="folio-library-pager"
              page={library.page}
              totalPages={library.numPages}
              loading={library.loading}
              onPage={library.setPage}
            />
          </section>

          <WorkInspector
            origin={origin.current}
            work={library.selected}
            blurCovers={blurCovers}
            onClose={() => library.setSelected(null)}
            onPickTag={library.pickTag}
            onToggleFavorite={(work) => void library.toggleFavorite(work)}
            onDeleted={library.afterBulkAction}
          />
        </div>
      ) : null}
      </div>
      </div>
    </section>
  );
}
