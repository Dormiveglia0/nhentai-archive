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

      <div className="files-layout">
        <div className="files-main">
          <FileToolbar
            category={state.category}
            onCategory={state.setCategory}
            query={state.query}
            onQuery={state.setQuery}
            statusFilter={state.statusFilter}
            onStatus={state.setStatusFilter}
            total={state.inventory?.total ?? 0}
          />
          <FileList
            entries={entries}
            selected={state.selected}
            focusId={state.focusId}
            onToggle={state.toggleSelect}
            loading={state.loading}
          />
          <FileDetailPanel focus={focus} blurCovers={blurCovers} />
        </div>
        <FileHealthRail
          overview={state.overview}
          selectedCount={state.selected.size}
          preview={state.preview}
          busy={state.busy}
          actionNotice={state.actionNotice}
          onPreview={state.requestPreview}
          onConfirm={state.confirmDelete}
          onClear={state.clearSelection}
        />
      </div>
    </section>
  );
}
