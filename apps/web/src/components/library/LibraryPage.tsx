import { AlertTriangle, Clock3, Grid2X2, Info, Library, List } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useCallback, useState } from "react";
import type { LibraryWorkGroup } from "../../lib/api";
import { libraryTagKey } from "../../lib/navigation";

import { duration, ease, SlidingIndicator, Stagger, StaggerItem } from "../../lib/motion";
import { pageHref } from "../../lib/navigation";
import { balanceGridRows, completeGridRows, useGridColumns } from "../../lib/useGridColumns";
import { IconPager } from "../folio/ui/IconPager";
import { FolioEmptyState, FolioPanelHeading } from "../folio/ui/FolioPrimitives";
import { ContinueReadingRow } from "../folio/ui/ContinueReadingRow";
import { LibraryBatchTray } from "./LibraryBatchTray";
import { LibrarySummaryStrip } from "./LibrarySummaryStrip";
import { UploadDialog } from "./UploadDialog";
import { LibraryToolbar } from "./LibraryToolbar";
import { WorkCard } from "./WorkCard";
import { WorkInspector } from "./WorkInspector";
import { WorkGroupCard } from "./WorkGroupCard";
import { WorkGroupDialog } from "./WorkGroupDialog";
import { useLibraryState } from "./useLibraryState";
import "./LibraryPage.css";

export function LibraryPage({ blurCovers }: { blurCovers: boolean }) {
  const [uploading, setUploading] = useState(false);
  const [openGroup, setOpenGroup] = useState<LibraryWorkGroup | null>(null);
  const [createGroupIds, setCreateGroupIds] = useState<number[] | null>(null);
  const [gridRef, gridColumns] = useGridColumns();
  const library = useLibraryState(completeGridRows(24, gridColumns));
  const closeInspector = useCallback(() => library.setSelected(null), [library.setSelected]);
  const gridRows = balanceGridRows(library.works.length, gridColumns);

  if (!library.summary && !library.error) return <section className="folio-page-body folio-library-page" aria-busy="true">
    <div className="folio-library-summary-loading" role="status">正在读取我的库…</div>
  </section>;

  return (
    <section className="folio-page-body folio-library-page">
      <LibraryToolbar
        onUpload={() => setUploading(true)}
        q={library.q}
        onQ={library.setQ}
        language={library.language}
        onLanguage={library.setLanguage}
        readStatus={library.readStatus}
        onReadStatus={library.setReadStatus}
        libraryId={library.libraryId}
        onLibraryId={library.setLibraryId}
        mediaLibraries={library.mediaLibraries}
        sort={library.sort}
        onSort={library.setSort}
        groupBy={library.groupBy}
        onGroupBy={library.setGroupBy}
        tags={library.tags}
        onTags={library.setTags}
        favoriteOnly={library.favoriteOnly}
        onFavoriteOnly={library.setFavoriteOnly}
        summary={library.summary}
        canReset={library.filtersActive}
        onReset={library.resetFilters}
      />
      <LibrarySummaryStrip summary={library.summary} />

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
            copy="上传 ZIP / CBZ、添加媒体库，或从发现页导入漫画。"
            action="添加媒体库"
            actionHref="#files"
          />
        </section>
      ) : null}

      {!library.emptyLibrary && !library.filtersActive ? (
        <div className="folio-library-shelves">
          <ContinueReadingRow title="继续阅读" works={library.continueReading} blurCovers={blurCovers} />
          <ContinueReadingRow title="最近添加" works={library.recentAdded} blurCovers={blurCovers} />
        </div>
      ) : null}

      {!library.emptyLibrary ? (
        <div className="folio-library-browser">
          <section className="folio-library-results" aria-busy={library.loading}>
            <header className="folio-library-results-head">
              <FolioPanelHeading
                title="作品列表"
              />
              <div className="folio-library-result-controls">
                <span>{library.loading ? "读取中…" : library.workTotal === library.total ? `${library.workTotal.toLocaleString()} 部作品` : `${library.workTotal.toLocaleString()} 部作品 · ${library.total.toLocaleString()} 项`}</span>
                <div className="folio-view-switch folio-library-view-switch" role="group" aria-label="作品视图方式">
                  <button type="button" aria-label="封面墙视图" aria-pressed={library.view === "grid"} className={library.view === "grid" ? "is-active" : ""} onClick={() => library.setView("grid")}>
                    {library.view === "grid" ? <SlidingIndicator className="folio-control-active" layoutId="folio-library-view" /> : null}<Grid2X2 size={16} />
                  </button>
                  <button type="button" aria-label="列表视图" aria-pressed={library.view === "list"} className={library.view === "list" ? "is-active" : ""} onClick={() => library.setView("list")}>
                    {library.view === "list" ? <SlidingIndicator className="folio-control-active" layoutId="folio-library-view" /> : null}<List size={17} />
                  </button>
                </div>
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
                    onGroup={() => setCreateGroupIds([...library.selectedIds])}
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
                  key={`${library.view}:${library.page}:${library.works.length}:${library.works[0]?.id ?? "none"}`}
                  className={library.view === "grid" ? "folio-library-grid" : "folio-library-list"}
                  style={library.view === "grid" ? gridRows.style : undefined}
                >
                  {library.works.map((work, index) => (
                    <StaggerItem key={work.group?.key ?? work.id} className={`folio-library-card-cell${library.view === "grid" && index >= gridRows.tailStart ? " is-balanced-tail" : ""}`}>
                      {work.group ? <WorkGroupCard group={work.group} view={library.view} blurCovers={blurCovers}
                        multiSelect={library.multiSelect} checked={work.group.member_ids.every(id => library.selectedIds.has(id))}
                        partial={work.group.member_ids.some(id => library.selectedIds.has(id)) && !work.group.member_ids.every(id => library.selectedIds.has(id))}
                        onOpen={() => setOpenGroup(work.group!)} onToggle={() => library.toggleSelectedWorks(work.group!.member_ids)} /> : <WorkCard
                        work={work}
                        view={library.view}
                        blurCovers={blurCovers}
                        selected={library.selected?.id === work.id}
                        onSelect={() => library.setSelected(work)}
                        onPickTag={library.pickTag}
                        onToggleFavorite={() => void library.toggleFavorite(work)}
                        multiSelect={library.multiSelect}
                        checked={library.selectedIds.has(work.id)}
                        onToggle={() => library.toggleSelectedId(work.id)}
                      />}
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

        </div>
      ) : null}
      {uploading ? <UploadDialog blurCovers={blurCovers} onClose={() => setUploading(false)} onImported={library.reload} /> : null}
      {openGroup || createGroupIds ? <WorkGroupDialog key={openGroup?.key ?? 'create'} group={openGroup ?? undefined} createIds={createGroupIds ?? undefined}
        filters={{ q: library.q, language: library.language, read_status: library.readStatus, sort: library.sort,
          favorite_only: library.favoriteOnly, library_id: library.libraryId === 'all' ? undefined : Number(library.libraryId), tag_keys: library.tags.map(libraryTagKey) }}
        blurCovers={blurCovers} onClose={() => { setOpenGroup(null); setCreateGroupIds(null); }}
        onChanged={() => { if (createGroupIds) library.afterBulkAction(); else library.reload(); }}
        onInspect={library.setSelected} onPickTag={library.pickTag} /> : null}
      <AnimatePresence>
        {library.selected ? <WorkInspector
            work={library.selected}
            blurCovers={blurCovers}
            onClose={closeInspector}
            onPickTag={library.pickTag}
            onToggleFavorite={(work) => void library.toggleFavorite(work)}
            onDeleted={library.afterBulkAction}
            onUpdated={library.reload}
          /> : null}
      </AnimatePresence>
    </section>
  );
}
