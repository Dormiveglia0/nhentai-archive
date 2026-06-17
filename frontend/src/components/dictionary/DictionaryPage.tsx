import { useCallback, useEffect, useState } from "react";

import {
  api,
  DictionaryApplyPayload,
  DictionaryCandidate,
  DictionaryEvidence,
  DictionaryPreview,
  DictionarySummary,
} from "../../lib/api";
import { BulkImportPanel } from "./BulkImportPanel";
import { DictionaryApplyPreview } from "./DictionaryApplyPreview";
import { DictionaryCandidatePool } from "./DictionaryCandidatePool";
import { DictionaryEditor } from "./DictionaryEditor";
import { DictionaryEvidencePanel } from "./DictionaryEvidencePanel";
import { DictionarySummaryStrip } from "./DictionarySummaryStrip";

const EMPTY_FORM: DictionaryApplyPayload = {
  original_text: "",
  zh_name: "",
  tag_type: "tag",
  remote_tag_id: null,
  aliases: [],
  scope: [],
  note: "",
  status: "configured",
  confidence: 80,
};

export function DictionaryPage() {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [status, setStatus] = useState("all");
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(20);
  const [summary, setSummary] = useState<DictionarySummary | null>(null);
  const [candidates, setCandidates] = useState<DictionaryCandidate[]>([]);
  const [selected, setSelected] = useState<DictionaryCandidate | null>(null);
  const [dictionaryId, setDictionaryId] = useState<number | null>(null);
  const [evidence, setEvidence] = useState<DictionaryEvidence | null>(null);
  const [form, setForm] = useState<DictionaryApplyPayload>(EMPTY_FORM);
  const [preview, setPreview] = useState<DictionaryPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    setSummary(await api.dictionarySummary());
  }, []);

  const loadCandidates = useCallback(async () => {
    const payload = await api.dictionaryCandidates({ q: query, type: typeFilter, status, limit, offset });
    setCandidates(payload.result);
  }, [limit, offset, query, status, typeFilter]);

  const refreshList = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      await Promise.all([loadSummary(), loadCandidates()]);
    } catch (exc) {
      setMessage(exc instanceof Error ? exc.message : String(exc));
    } finally {
      setLoading(false);
    }
  }, [loadCandidates, loadSummary]);

  useEffect(() => {
    const handle = window.setTimeout(() => void refreshList(), 180);
    return () => window.clearTimeout(handle);
  }, [refreshList]);

  async function loadEvidence(candidate: DictionaryCandidate, nextDictionaryId = candidate.dictionary_id ?? null) {
    setEvidenceLoading(true);
    try {
      const payload = await api.dictionaryEvidence({ remote_tag_id: candidate.id ?? null, dictionary_id: nextDictionaryId });
      setEvidence(payload);
      if (payload.dictionary) {
        setDictionaryId(payload.dictionary.id);
        setForm({
          original_text: payload.dictionary.original_text,
          zh_name: payload.dictionary.zh_name,
          tag_type: payload.dictionary.tag_type,
          remote_tag_id: payload.dictionary.remote_tag_id,
          aliases: payload.dictionary.aliases ?? [],
          scope: payload.dictionary.scope,
          note: payload.dictionary.note ?? "",
          status: payload.dictionary.status,
          confidence: payload.dictionary.confidence,
          locked: payload.dictionary.locked,
          ignored: payload.dictionary.ignored,
        });
      }
    } catch (exc) {
      setMessage(exc instanceof Error ? exc.message : String(exc));
    } finally {
      setEvidenceLoading(false);
    }
  }

  function selectCandidate(candidate: DictionaryCandidate) {
    setSelected(candidate);
    setDictionaryId(candidate.dictionary_id ?? null);
    setPreview(null);
    setEvidence(null);
    setForm({
      ...EMPTY_FORM,
      original_text: candidate.name || candidate.slug || String(candidate.id),
      zh_name: candidate.configured && candidate.display ? candidate.display : "",
      tag_type: candidate.type || "tag",
      remote_tag_id: candidate.id ?? null,
    });
    void loadEvidence(candidate);
  }

  function newLocalTerm() {
    setSelected(null);
    setDictionaryId(null);
    setEvidence(null);
    setPreview(null);
    setForm(EMPTY_FORM);
  }

  async function previewApply() {
    setLoading(true);
    setMessage(null);
    try {
      setPreview(await api.dictionaryPreviewApply(form));
    } catch (exc) {
      setMessage(exc instanceof Error ? exc.message : String(exc));
    } finally {
      setLoading(false);
    }
  }

  async function apply() {
    setLoading(true);
    setMessage(null);
    try {
      const result = await api.dictionaryApply(form);
      setDictionaryId(result.dictionary.id);
      setMessage(`已写入：${result.dictionary.zh_name}`);
      await refreshList();
      if (selected) await loadEvidence(selected, result.dictionary.id);
    } catch (exc) {
      setMessage(exc instanceof Error ? exc.message : String(exc));
    } finally {
      setLoading(false);
    }
  }

  async function ignore() {
    if (!dictionaryId) return;
    setLoading(true);
    try {
      await api.dictionaryIgnore(dictionaryId);
      setMessage("已忽略该词条。");
      await refreshList();
      if (selected) await loadEvidence(selected, dictionaryId);
    } catch (exc) {
      setMessage(exc instanceof Error ? exc.message : String(exc));
    } finally {
      setLoading(false);
    }
  }

  async function review() {
    if (!dictionaryId) return;
    setLoading(true);
    try {
      await api.dictionaryReview(dictionaryId);
      setMessage("已加入复核。");
      await refreshList();
      if (selected) await loadEvidence(selected, dictionaryId);
    } catch (exc) {
      setMessage(exc instanceof Error ? exc.message : String(exc));
    } finally {
      setLoading(false);
    }
  }

  async function deleteTerm() {
    if (!dictionaryId) return;
    setLoading(true);
    setMessage(null);
    try {
      await api.dictionaryDelete(dictionaryId);
      setMessage("已删除该词条，并解除相关作品标签映射。");
      setDictionaryId(null);
      setSelected(null);
      setEvidence(null);
      setPreview(null);
      setForm(EMPTY_FORM);
      await refreshList();
    } catch (exc) {
      setMessage(exc instanceof Error ? exc.message : String(exc));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="page dictionary-page">
      <div className="hero">
        <div>
          <h1>词典治理</h1>
          <p>统一术语规范，把英文远端 tag 映射成中文显示与检索入口。</p>
        </div>
        <div className="sketch" aria-hidden="true" />
      </div>

      <DictionarySummaryStrip summary={summary} />
      {message ? <div className="notice slim dictionary-notice">{message}</div> : null}

      <div className="dictionary-workspace">
        <DictionaryCandidatePool
          query={query}
          typeFilter={typeFilter}
          status={status}
          candidates={candidates}
          loading={loading}
          selectedKey={candidateKey(selected)}
          offset={offset}
          limit={limit}
          onQuery={(value) => {
            setOffset(0);
            setQuery(value);
          }}
          onTypeFilter={(value) => {
            setOffset(0);
            setTypeFilter(value);
          }}
          onStatus={(value) => {
            setOffset(0);
            setStatus(value);
          }}
          onRefresh={refreshList}
          onSelect={selectCandidate}
          onPage={setOffset}
          onLimit={(value) => {
            setOffset(0);
            setLimit(value);
          }}
        />
        <div className="dictionary-detail">
          <DictionaryEditor
            value={form}
            dictionaryId={dictionaryId}
            loading={loading}
            onChange={setForm}
            onNew={newLocalTerm}
            onPreview={previewApply}
            onApply={apply}
            onIgnore={ignore}
            onReview={review}
            onDelete={deleteTerm}
          />
          <DictionaryEvidencePanel evidence={evidence} loading={evidenceLoading} />
        </div>
      </div>

      <BulkImportPanel onImported={refreshList} />
      <DictionaryApplyPreview preview={preview} form={form} onClose={() => setPreview(null)} />
    </section>
  );
}

function candidateKey(candidate: DictionaryCandidate | null) {
  if (!candidate) return null;
  return candidate.id ? `remote-${candidate.id}` : `dict-${candidate.dictionary_id}`;
}
