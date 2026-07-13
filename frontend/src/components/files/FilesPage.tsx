import { AlertCircle } from "lucide-react";

import { FadeIn } from "../../lib/motion";
import { IconPager } from "../discover/IconPager";
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
        multiSelect={files.multiSelect}
        onToggleMultiSelect={files.toggleMultiSelect}
        selectedCount={files.selected.size}
        onPreviewSelected={files.previewSelected}
        onClearSelection={files.clearSelection}
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
            multiSelect={files.multiSelect}
            onPick={files.pickRow}
            loading={files.loading}
          />
          <IconPager className="folio-files-pager" page={files.page} totalPages={totalPages} loading={files.loading} onPage={files.setPage} />
          <FileDetailPanel focus={focus} blurCovers={blurCovers} busy={files.busy} onDelete={files.previewEntry} />
        </main>
        <FileHealthRail
          overview={files.overview}
          duplicates={files.duplicates}
          preview={files.preview}
          pendingLabel={files.pendingLabel}
          busy={files.busy}
          actionNotice={files.actionNotice}
          onCleanup={files.cleanupCategory}
          onConfirm={files.confirmDelete}
          onCancel={files.cancelDelete}
        />
      </FadeIn>
    </section>
  );
}
