import { Languages, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  api,
  DictionaryApplyPayload,
  DictionaryCandidate,
  DictionaryEvidence,
  DictionaryPreview,
  DictionarySummary,
} from "../../lib/api";
import { FadeInOut, Presence } from "../../lib/motion";
import { BulkImportPanel } from "./BulkImportPanel";
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
  const [bulkOpen, setBulkOpen] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const batchRemoteTagIds = candidates
    .filter((candidate) => candidate.id != null && (candidate.type ?? "tag") === "tag" && !candidate.configured && !candidate.ignored)
    .map((candidate) => Number(candidate.id));

  useEffect(() => {
    if (!bulkOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setBulkOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [bulkOpen]);

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

  async function suggestBatch() {
    if (batchRemoteTagIds.length === 0) {
      setMessage("当前候选池没有可机翻的未配置标签。");
      return;
    }
    setSuggesting(true);
    setMessage(null);
    try {
      const settings = await api.settings();
      const limit = settings.machine_translation?.batch_limit ?? 20;
      const result = await api.dictionarySuggestBatch(limit, batchRemoteTagIds);
      setMessage(
        result.generated > 0
          ? `已为当前候选生成 ${result.generated} 条机翻建议，请按「机器建议」筛选并逐条复核。`
          : "当前候选池没有可生成建议的未配置标签。"
      );
      if (result.generated > 0) {
        setStatus("suggested");
        setOffset(0);
        await loadSummary();
      } else {
        await refreshList();
      }
    } catch (exc) {
      setMessage(exc instanceof Error ? exc.message : String(exc));
    } finally {
      setSuggesting(false);
    }
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
      const result = await api.dictionaryApply({ ...form, status: "configured", ignored: false });
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
    if (!form.original_text.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      if (dictionaryId) {
        await api.dictionaryIgnore(dictionaryId);
      } else {
        // Ignoring an unconfigured tag: create an ignored row that keeps the original.
        await api.dictionaryApply({ ...form, status: "ignored", ignored: true });
      }
      setMessage("已忽略该标签，保留原文不翻译。");
      newLocalTerm();
      await refreshList();
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

      <div className="dictionary-mt-bar">
        <button type="button" onClick={() => void suggestBatch()} disabled={loading || suggesting || batchRemoteTagIds.length === 0}>
          <Languages size={15} />
          {suggesting ? "生成中…" : "批量机翻当前候选"}
        </button>
        <span>只处理候选术语池当前展示的未配置标签，逐条复核后再应用到作品。</span>
      </div>

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
          onBulkImport={() => setBulkOpen(true)}
          onSelect={selectCandidate}
          onPage={setOffset}
          onLimit={(value) => {
            setOffset(0);
            setLimit(value);
          }}
        />
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
      </div>

      <DictionaryEvidencePanel evidence={evidence} loading={evidenceLoading} preview={preview} form={form} />

      <Presence>
        {bulkOpen ? (
          <FadeInOut
            key="bulk-modal"
            className="preview-backdrop"
            role="dialog"
            aria-modal="true"
            onMouseDown={() => setBulkOpen(false)}
          >
            <FadeInOut
              className="dictionary-modal-motion"
              y={12}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="dictionary-modal">
                <button className="modal-close" type="button" onClick={() => setBulkOpen(false)} aria-label="关闭批量导入">
                  <X size={18} />
                </button>
                <BulkImportPanel onImported={refreshList} />
              </div>
            </FadeInOut>
          </FadeInOut>
        ) : null}
      </Presence>
    </section>
  );
}

function candidateKey(candidate: DictionaryCandidate | null) {
  if (!candidate) return null;
  return candidate.id ? `remote-${candidate.id}` : `dict-${candidate.dictionary_id}`;
}
