import { AlertCircle, CircleCheck, Files, Folder, ArrowRightLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { FadeIn, SlidingIndicator, transitionTabs, usePrefersReducedMotion } from "../../lib/motion";
import { IconPager } from "../folio/ui/IconPager";
import { FileDeleteDialog } from "./FileDeleteDialog";
import { FileDetailPanel } from "./FileDetailPanel";
import { FileHealthRail } from "./FileHealthRail";
import { FileList } from "./FileList";
import { FileOverviewStrip } from "./FileOverviewStrip";
import { FileToolbar } from "./FileToolbar";
import { useFilesState } from "./useFilesState";
import { MediaLibrariesSection } from "../settings/MediaLibrariesSection";
import { MigrationPanel } from "./MigrationPanel";
import "./FilesPage.css";

export function FilesPage({ blurCovers }: { blurCovers: boolean }) {
  type View = "libraries" | "files" | "migration";
  const readView = (): View => {
    const value = new URLSearchParams(window.location.hash.split("?")[1]).get("view");
    return value === "files" || value === "migration" ? value : "libraries";
  };
  const [view, setView] = useState(readView);
  useEffect(() => {
    const update = () => setView(readView());
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  function choose(next: View) {
    transitionTabs(["libraries", "files", "migration"] as const, view, next, value => {
      setView(value); window.history.replaceState(null, "", value === "libraries" ? "#files" : "#files?view=" + value);
    }, "files");
  }
  return <section className="folio-page-body folio-files-page">
    <nav className="folio-files-tabs folio-files-primary-tabs" aria-label="文件内容">
      {([{ id: "libraries", label: "媒体库", icon: Folder }, { id: "files", label: "文件", icon: Files }, { id: "migration", label: "迁移", icon: ArrowRightLeft }] as const).map(tab => <button type="button" key={tab.id} className={view === tab.id ? "is-active" : ""} aria-current={view === tab.id ? "page" : undefined} onClick={() => choose(tab.id)}>
        {view === tab.id ? <SlidingIndicator className="folio-files-tab-active" layoutId="files-views" /> : null}<tab.icon size={16} /><span>{tab.label}</span>
      </button>)}
    </nav>
    <div className="folio-files-stage">{view === "libraries" ? <MediaLibrariesSection /> : view === "migration" ? <MigrationPanel onLibraries={() => choose("libraries")} /> : <FileInventory blurCovers={blurCovers} />}</div>
  </section>;
}

function FileInventory({ blurCovers }: { blurCovers: boolean }) {
  const files = useFilesState();
  const reduceMotion = usePrefersReducedMotion();
  const sideRef = useRef<HTMLDivElement>(null);
  const entries = files.inventory?.result ?? [];
  const focus = entries.find((entry) => entry.id === files.focusId) ?? null;
  const total = files.inventory?.total ?? 0;
  const perPage = files.inventory?.per_page ?? 50;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  useEffect(() => {
    if (!files.focusId || window.matchMedia("(max-width: 900px)").matches) return;
    const frame = window.requestAnimationFrame(() => {
      sideRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [files.focusId, reduceMotion]);

  return (
    <section className="folio-files-inventory">
      <FileOverviewStrip overview={files.overview} />
      {files.error ? <FadeIn key={files.error} className="folio-files-message is-error" role="alert" y={6}><AlertCircle size={15} /><p>{files.error}</p></FadeIn> : null}
      {files.actionNotice ? (
        <FadeIn
          key={files.actionNotice.message}
          className={`folio-files-message${files.actionNotice.error ? " is-error" : ""}`}
          role={files.actionNotice.error ? "alert" : "status"}
          y={6}
        >
          {files.actionNotice.error ? <AlertCircle size={15} /> : <CircleCheck size={15} />}
          <p>{files.actionNotice.message}</p>
        </FadeIn>
      ) : null}

      <FileToolbar
        category={files.category}
        onCategory={files.setCategory}
        query={files.query}
        onQuery={files.setQuery}
        statusFilter={files.statusFilter}
        onStatus={files.setStatusFilter}
        sort={files.sort}
        onSort={files.setSort}
        total={total}
        selectedCount={files.selected.size}
        onPreviewSelected={files.previewSelected}
        onClearSelection={files.clearSelection}
        busy={files.busy}
      />

      <FadeIn className="folio-files-layout" y={8}>
        <section className="folio-files-main" aria-labelledby="folio-files-list-title">
          <header className="folio-files-column-head">
            <h2 id="folio-files-list-title">文件清单</h2>
          </header>
          <FileList
            entries={entries}
            selected={files.selected}
            focusId={files.focusId}
            onPick={files.pickRow}
            onToggle={files.toggleSelected}
            loading={files.loading}
          />
          <IconPager className="folio-files-pager" page={files.page} totalPages={totalPages} loading={files.loading} onPage={files.setPage} />
        </section>
        <div ref={sideRef} className="folio-files-side">
          <FileDetailPanel
            focus={focus}
            blurCovers={blurCovers}
            busy={files.busy}
            onClose={files.closeFocus}
            onDelete={files.previewEntry}
          />
          <FileHealthRail
            overview={files.overview}
            duplicates={files.duplicates}
            busy={files.busy}
            scanBusy={files.scanBusy}
            scanPreview={files.scanPreview}
            scanNotice={files.scanNotice}
            scanError={files.scanError}
            onCleanup={files.cleanupCategory}
            onScanPreview={files.previewScan}
            onScanStart={files.startScan}
            onScanCancel={files.cancelScan}
            onFilter={status => { files.setCategory("all"); files.setStatusFilter(status); }}
          />
        </div>
      </FadeIn>

      <FileDeleteDialog
        preview={files.preview}
        label={files.pendingLabel}
        returnFocus={files.deleteTrigger}
        error={files.error}
        busy={files.busy}
        onConfirm={files.confirmDelete}
        onCancel={files.cancelDelete}
      />
    </section>
  );
}
