import { AlertCircle, X } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useRef } from "react";

import { duration, ease, FadeIn, usePrefersReducedMotion } from "../../lib/motion";
import { BulkImportPanel } from "./BulkImportPanel";
import { DictionaryActionBar } from "./DictionaryActionBar";
import { DictionaryCandidatePool } from "./DictionaryCandidatePool";
import { DictionaryEditor } from "./DictionaryEditor";
import { DictionaryEvidencePanel } from "./DictionaryEvidencePanel";
import { DictionarySummaryStrip } from "./DictionarySummaryStrip";
import { useDictionaryState } from "./useDictionaryState";
import "./DictionaryPage.css";
import "./DictionaryEditor.css";

export function DictionaryPage() {
  const dictionary = useDictionaryState();
  const reduceMotion = usePrefersReducedMotion();
  const modalRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  function openBulk() {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dictionary.setBulkOpen(true);
  }

  function closeBulk() {
    dictionary.setBulkOpen(false);
    window.requestAnimationFrame(() => returnFocusRef.current?.focus());
  }

  useEffect(() => {
    if (!dictionary.bulkOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeBulk();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // dictionary.bulkOpen is the modal's lifecycle boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dictionary.bulkOpen]);

  return (
    <section className="folio-page-body folio-dictionary-page">
      <DictionarySummaryStrip summary={dictionary.summary} />

      {dictionary.message ? (
        <FadeIn key={dictionary.message} className="folio-dictionary-message" role="status" y={6}>
          <AlertCircle size={15} />
          <p>{dictionary.message}</p>
        </FadeIn>
      ) : null}

      <div className="folio-dictionary-layout">
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
          onSelect={dictionary.selectCandidate}
          onPage={dictionary.setOffset}
          onLimit={dictionary.updateLimit}
        />
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
      </div>

      <DictionaryEvidencePanel
        evidence={dictionary.evidence}
        loading={dictionary.evidenceLoading}
        preview={dictionary.preview}
        form={dictionary.form}
      />

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

      <AnimatePresence>
        {dictionary.bulkOpen ? (
          <m.div
            className="folio-dictionary-modal-backdrop"
            role="presentation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: duration.fast }}
            onMouseDown={closeBulk}
          >
            <m.section
              ref={modalRef}
              className="folio-dictionary-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="folio-dictionary-bulk-title"
              initial={{ opacity: 0, y: reduceMotion ? 0 : 14, scale: reduceMotion ? 1 : 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: reduceMotion ? 0 : 8, scale: reduceMotion ? 1 : 0.99 }}
              transition={{ duration: duration.base, ease: ease.standard }}
              onMouseDown={(event) => event.stopPropagation()}
              onKeyDown={(event) => trapFocus(event, modalRef.current)}
            >
              <button autoFocus className="folio-dictionary-modal-close" type="button" onClick={closeBulk} aria-label="关闭批量导入"><X size={18} /></button>
              <header><span>Dictionary import</span><h2 id="folio-dictionary-bulk-title">批量导入</h2></header>
              <BulkImportPanel onImported={() => void dictionary.refreshList()} />
            </m.section>
          </m.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

function trapFocus(event: ReactKeyboardEvent, container: HTMLElement | null) {
  if (event.key !== "Tab" || !container) return;
  const controls = [...container.querySelectorAll<HTMLElement>("button:not(:disabled), textarea:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex='-1'])")];
  const first = controls[0];
  const last = controls[controls.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}
