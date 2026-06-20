import { FadeIn } from "../../lib/motion";
import { FileDetailPanel } from "./FileDetailPanel";
import { FileHealthRail } from "./FileHealthRail";
import { FileList } from "./FileList";
import { FileOverviewStrip } from "./FileOverviewStrip";
import { FileToolbar } from "./FileToolbar";
import { useFilesState } from "./useFilesState";

export function FilesPage({ blurCovers }: { blurCovers: boolean }) {
  const state = useFilesState();
  const entries = state.inventory?.result ?? [];
  const focus = entries.find((e) => e.id === state.focusId) ?? null;

  return (
    <section className="page files-page">
      <div className="hero">
        <div>
          <h1>文件管理</h1>
          <p>数据目录内全部文件的真实清单。删除前会预览影响；删除作品会连同其数据库记录一起移除。</p>
        </div>
        <div className="sketch" aria-hidden="true" />
      </div>

      <FileOverviewStrip overview={state.overview} />
      {state.error ? <div className="files-error">{state.error}</div> : null}

      <FadeIn className="files-layout" y={8}>
        <div className="files-main">
          <FileToolbar
            category={state.category}
            onCategory={state.setCategory}
            query={state.query}
            onQuery={state.setQuery}
            statusFilter={state.statusFilter}
            onStatus={state.setStatusFilter}
            total={state.inventory?.total ?? 0}
            multiSelect={state.multiSelect}
            onToggleMultiSelect={state.toggleMultiSelect}
            selectedCount={state.selected.size}
            onPreviewSelected={state.previewSelected}
            onClearSelection={state.clearSelection}
          />
          <FileList
            entries={entries}
            selected={state.selected}
            focusId={state.focusId}
            multiSelect={state.multiSelect}
            onPick={state.pickRow}
            loading={state.loading}
          />
          <FileDetailPanel focus={focus} blurCovers={blurCovers} busy={state.busy} onDelete={state.previewEntry} />
        </div>
        <FileHealthRail
          overview={state.overview}
          duplicates={state.duplicates}
          preview={state.preview}
          pendingLabel={state.pendingLabel}
          busy={state.busy}
          actionNotice={state.actionNotice}
          onCleanup={state.cleanupCategory}
          onConfirm={state.confirmDelete}
          onCancel={state.cancelDelete}
        />
      </FadeIn>
    </section>
  );
}
