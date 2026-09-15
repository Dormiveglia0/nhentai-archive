import { AlertCircle, CircleCheck } from "lucide-react";
import { useState } from "react";

import { FadeIn, SelectionStage } from "../../lib/motion";
import { FolioSheet } from "../folio/ui/FolioSheet";
import { SectionSwitch } from "../folio/ui/SectionSwitch";
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
  const [section, setSection] = useState<"inventory" | "maintenance">("inventory");
  const entries = files.inventory?.result ?? [];
  const focus = entries.find((entry) => entry.id === files.focusId) ?? null;
  const total = files.inventory?.total ?? 0;
  const perPage = files.inventory?.per_page ?? 50;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const detailPanel = <FileDetailPanel focus={focus} blurCovers={blurCovers} busy={files.busy} onClose={files.closeFocus} onDelete={files.previewEntry} />;

  return (
    <section className="folio-page-body folio-files-page">
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

      <SectionSwitch label="文件工作区" value={section} onChange={setSection} items={[{value: "inventory", label: "文件清单"}, {value: "maintenance", label: "扫描与清理"}]} />
      <div hidden={section !== "inventory"}>
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

      <FadeIn className="folio-files-layout is-compact" y={8}>
        <section className="folio-files-main" aria-labelledby="folio-files-list-title">
          <header className="folio-files-column-head">
            <h2 id="folio-files-list-title">文件清单</h2>
            <p>{total.toLocaleString()} 项</p>
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
      </FadeIn>
      </div>
      <div hidden={section !== "maintenance"}>
      <SelectionStage selection={section} className="files-maintenance-workspace">
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
      </SelectionStage>
      </div>

      {<FolioSheet open={Boolean(focus)} label="文件详情" onClose={files.closeFocus}><div className="files-detail-sheet">{detailPanel}</div></FolioSheet>}

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
