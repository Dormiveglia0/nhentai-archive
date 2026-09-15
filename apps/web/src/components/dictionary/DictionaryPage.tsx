import { useState } from "react";
import { AlertCircle, X, Plus } from "lucide-react";
import { FadeIn, SelectionStage } from "../../lib/motion";
import { FolioSheet } from "../folio/ui/FolioSheet";
import { BulkImportPanel } from "./BulkImportPanel";
import { DictionaryActionBar } from "./DictionaryActionBar";
import { DictionaryCandidatePool } from "./DictionaryCandidatePool";
import { DictionaryEditor } from "./DictionaryEditor";
import { DictionaryEvidencePanel } from "./DictionaryEvidencePanel";
import { useDictionaryState } from "./useDictionaryState";
import "./DictionaryPage.css";
import "./DictionaryEditor.css";

export function DictionaryPage({ blurCovers }: { blurCovers: boolean }) {
  const dictionary = useDictionaryState();
  const [editorOpen,setEditorOpen] = useState(false);
  function openBulk() { dictionary.setBulkOpen(true); }
  function closeBulk() { dictionary.setBulkOpen(false); }

  return (
    <section className={`folio-page-body folio-dictionary-page${blurCovers ? " is-private" : ""}`}>
      <header className="dictionary-index-head"><h1>词典</h1><div><span><strong>{dictionary.summary?.configured ?? "—"}</strong> 已配置</span><span><strong>{dictionary.summary?.unconfigured ?? "—"}</strong> 未配置</span></div><button type="button" onClick={()=>{dictionary.newLocalTerm();setEditorOpen(true);}}><Plus size={17}/>新建词条</button></header>

      {dictionary.message ? (
        <FadeIn key={dictionary.message} className="folio-dictionary-message" role="status" y={6}>
          <AlertCircle size={15} />
          <p>{dictionary.message}</p>
        </FadeIn>
      ) : null}

      <div className="dictionary-workspace">
        <DictionaryCandidatePool
          query={dictionary.query}
          typeFilter={dictionary.typeFilter}
          status={dictionary.status}
          candidates={dictionary.candidates}
          loading={dictionary.loading}
          suggesting={dictionary.suggesting}
          batchCount={dictionary.batchCount}
          selectedKey={dictionary.selectedKey}
          offset={dictionary.offset}
          limit={dictionary.limit}
          onQuery={dictionary.updateQuery}
          onTypeFilter={dictionary.updateTypeFilter}
          onStatus={dictionary.updateStatus}
          onRefresh={() => void dictionary.refreshList()}
          onSuggest={() => void dictionary.suggestBatch()}
          onBulkImport={openBulk}
          onSelect={(candidate)=>{dictionary.selectCandidate(candidate);setEditorOpen(true);}}
          onPage={dictionary.setOffset}
          onLimit={dictionary.updateLimit}
        />
      </div>
      <FolioSheet open={editorOpen} label="编辑词条" onClose={()=>setEditorOpen(false)} className="dictionary-editor-sheet">
        <header className="dictionary-sheet-head"><span>词条编辑</span><button type="button" aria-label="关闭词条编辑" onClick={()=>setEditorOpen(false)}><X size={20}/></button></header>
        <SelectionStage selection={dictionary.selectedKey} className="dictionary-edit-column">
        <DictionaryEditor
          value={dictionary.form}
          dictionaryId={dictionary.dictionaryId}
          loading={dictionary.loading}
          translating={dictionary.translating}
          mtError={dictionary.mtError}
          onChange={dictionary.updateForm}
          onNew={dictionary.newLocalTerm}
          onTranslate={() => void dictionary.machineTranslate()}
        />

      <DictionaryEvidencePanel
        evidence={dictionary.evidence}
        loading={dictionary.evidenceLoading}
        preview={dictionary.preview}
        form={dictionary.form}
      />

        </SelectionStage>

      <DictionaryActionBar
        hasOriginal={Boolean(dictionary.form.original_text.trim())}
        hasTranslation={Boolean(dictionary.form.zh_name.trim())}
        hasDictionaryId={Boolean(dictionary.dictionaryId)}
        ignored={Boolean(dictionary.form.ignored)}
        previewReady={Boolean(dictionary.preview)}
        loading={dictionary.loading}
        onPreview={() => void dictionary.previewApply()}
        onApply={() => void dictionary.apply()}
        onIgnore={() => void dictionary.ignore()}
        onReview={() => void dictionary.review()}
        onDelete={() => void dictionary.deleteTerm()}
      />

      </FolioSheet>
      <FolioSheet open={dictionary.bulkOpen} label="批量导入词典" onClose={closeBulk}>
        <div className="dictionary-import-sheet">
          <header><h2>批量导入</h2><button type="button" onClick={closeBulk} aria-label="关闭批量导入"><X size={18} /></button></header>
          <BulkImportPanel onImported={() => void dictionary.refreshList()} />
        </div>
      </FolioSheet>
    </section>
  );
}
