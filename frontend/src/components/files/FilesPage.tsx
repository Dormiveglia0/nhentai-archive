import { AlertCircle, CircleCheck } from "lucide-react";

import { FadeIn } from "../../lib/motion";
import { IconPager } from "../folio/ui/IconPager";
import { FileDeleteDialog } from "./FileDeleteDialog";
import { FileDetailPanel } from "./FileDetailPanel";
import { FileHealthRail } from "./FileHealthRail";
import { FileList } from "./FileList";
import { FileOverviewStrip } from "./FileOverviewStrip";
import { FileToolbar } from "./FileToolbar";
import { useFilesState } from "./useFilesState";
import "./FilesPage.css";

export function FilesPage({ blurCovers }: { blurCovers: boolean }) {
  const files = useFilesState();
  const entries = files.inventory?.result ?? [];
  const focus = entries.find((entry) => entry.id === files.focusId) ?? null;
  const total = files.inventory?.total ?? 0;
  const perPage = files.inventory?.per_page ?? 50;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <section className="folio-page-body folio-files-page">
      <FileOverviewStrip overview={files.overview} />
      {files.error ? <FadeIn key={files.error} className="folio-files-message is-error" y={6}><AlertCircle size={15} /><p>{files.error}</p></FadeIn> : null}
      {files.actionNotice ? (
        <FadeIn
          key={files.actionNotice.message}
          className={`folio-files-message${files.actionNotice.error ? " is-error" : ""}`}
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
        <main className="folio-files-main">
          <header className="folio-files-column-head">
            <span>Managed inventory</span>
            <h2>文件清单</h2>
            <p>数据库索引与受管目录的实时对照。</p>
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
        </main>
        <div className="folio-files-side">
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
