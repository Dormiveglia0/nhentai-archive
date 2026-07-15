import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  api,
  type DictionaryApplyPayload,
  type DictionaryCandidate,
  type DictionaryEvidence,
  type DictionaryPreview,
  type DictionarySummary,
} from "../../lib/api";

export const EMPTY_DICTIONARY_FORM: DictionaryApplyPayload = {
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

export function useDictionaryState() {
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
  const [form, setForm] = useState<DictionaryApplyPayload>(EMPTY_DICTIONARY_FORM);
  const [preview, setPreview] = useState<DictionaryPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [mtError, setMtError] = useState<string | null>(null);
  const listRequestRef = useRef(0);
  const evidenceRequestRef = useRef(0);
  const previewRequestRef = useRef(0);

  const batchRemoteTagIds = useMemo(
    () =>
      candidates
        .filter((candidate) => candidate.id != null && (candidate.type ?? "tag") === "tag" && !candidate.configured && !candidate.ignored)
        .map((candidate) => Number(candidate.id)),
    [candidates]
  );

  const selectedKey = useMemo(() => candidateKey(selected), [selected]);

  const refreshList = useCallback(async () => {
    const requestId = ++listRequestRef.current;
    setLoading(true);
    setMessage(null);
    try {
      const [summaryPayload, candidatePayload] = await Promise.all([
        api.dictionarySummary(),
        api.dictionaryCandidates({ q: query, type: typeFilter, status, limit, offset }),
      ]);
      if (requestId !== listRequestRef.current) return;
      setSummary(summaryPayload);
      setCandidates(candidatePayload.result);
    } catch (exc) {
      if (requestId === listRequestRef.current) setMessage(errorMessage(exc));
    } finally {
      if (requestId === listRequestRef.current) setLoading(false);
    }
  }, [limit, offset, query, status, typeFilter]);

  useEffect(() => {
    const handle = window.setTimeout(() => void refreshList(), 180);
    return () => window.clearTimeout(handle);
  }, [refreshList]);

  const loadEvidence = useCallback(async (candidate: DictionaryCandidate, nextDictionaryId = candidate.dictionary_id ?? null) => {
    const requestId = ++evidenceRequestRef.current;
    setEvidenceLoading(true);
    try {
      const payload = await api.dictionaryEvidence({ remote_tag_id: candidate.id ?? null, dictionary_id: nextDictionaryId });
      if (requestId !== evidenceRequestRef.current) return;
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
      if (requestId === evidenceRequestRef.current) setMessage(errorMessage(exc));
    } finally {
      if (requestId === evidenceRequestRef.current) setEvidenceLoading(false);
    }
  }, []);

  function selectCandidate(candidate: DictionaryCandidate) {
    previewRequestRef.current += 1;
    setSelected(candidate);
    setDictionaryId(candidate.dictionary_id ?? null);
    setPreview(null);
    setEvidence(null);
    setMtError(null);
    setForm({
      ...EMPTY_DICTIONARY_FORM,
      original_text: candidate.name || candidate.slug || String(candidate.id),
      zh_name: candidate.configured && candidate.display ? candidate.display : "",
      tag_type: candidate.type || "tag",
      remote_tag_id: candidate.id ?? null,
    });
    void loadEvidence(candidate);
  }

  function newLocalTerm() {
    evidenceRequestRef.current += 1;
    previewRequestRef.current += 1;
    setSelected(null);
    setDictionaryId(null);
    setEvidence(null);
    setEvidenceLoading(false);
    setPreview(null);
    setMtError(null);
    setForm({ ...EMPTY_DICTIONARY_FORM });
  }

  function updateForm(value: DictionaryApplyPayload) {
    previewRequestRef.current += 1;
    setForm(value);
    setPreview(null);
    setMtError(null);
  }

  function updateQuery(value: string) {
    setOffset(0);
    setQuery(value);
  }

  function updateTypeFilter(value: string) {
    setOffset(0);
    setTypeFilter(value);
  }

  function updateStatus(value: string) {
    setOffset(0);
    setStatus(value);
  }

  function updateLimit(value: number) {
    setOffset(0);
    setLimit(value);
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
      const batchLimit = settings.machine_translation?.batch_limit ?? 20;
      const result = await api.dictionarySuggestBatch(batchLimit, batchRemoteTagIds);
      setMessage(
        result.generated > 0
          ? `已为当前候选生成 ${result.generated} 条机翻建议，请按「机器建议」筛选并逐条复核。`
          : "当前候选池没有可生成建议的未配置标签。"
      );
      if (result.generated > 0) {
        setStatus("suggested");
        setOffset(0);
        setSummary(await api.dictionarySummary());
      } else {
        await refreshList();
      }
    } catch (exc) {
      setMessage(errorMessage(exc));
    } finally {
      setSuggesting(false);
    }
  }

  async function machineTranslate() {
    const text = form.original_text.trim();
    if (!text) return;
    setTranslating(true);
    setMtError(null);
    try {
      const result = await api.dictionaryTranslate(text);
      if (result.translation) {
        previewRequestRef.current += 1;
        setForm((current) => ({ ...current, zh_name: result.translation }));
        setPreview(null);
      }
      else setMtError("机翻返回为空。");
    } catch (exc) {
      setMtError(errorMessage(exc));
    } finally {
      setTranslating(false);
    }
  }

  async function previewApply() {
    const requestId = ++previewRequestRef.current;
    setLoading(true);
    setMessage(null);
    try {
      const result = await api.dictionaryPreviewApply(form);
      if (requestId === previewRequestRef.current) setPreview(result);
    } catch (exc) {
      if (requestId === previewRequestRef.current) setMessage(errorMessage(exc));
    } finally {
      setLoading(false);
    }
  }

  async function apply() {
    if (!preview) {
      setMessage("请先预览影响，确认冲突与关联作品后再写入。");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const result = await api.dictionaryApply({ ...form, status: "configured", ignored: false });
      setDictionaryId(result.dictionary.id);
      previewRequestRef.current += 1;
      setPreview(null);
      setMessage(`已写入：${result.dictionary.zh_name}`);
      await refreshList();
      if (selected) await loadEvidence(selected, result.dictionary.id);
    } catch (exc) {
      setMessage(errorMessage(exc));
    } finally {
      setLoading(false);
    }
  }

  async function ignore() {
    if (!form.original_text.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      if (dictionaryId) await api.dictionaryIgnore(dictionaryId);
      else await api.dictionaryApply({ ...form, status: "ignored", ignored: true });
      setMessage("已忽略该标签，保留原文不翻译。");
      newLocalTerm();
      await refreshList();
    } catch (exc) {
      setMessage(errorMessage(exc));
    } finally {
      setLoading(false);
    }
  }

  async function review() {
    if (!dictionaryId) return;
    setLoading(true);
    setMessage(null);
    try {
      await api.dictionaryReview(dictionaryId);
      setMessage("已加入复核。");
      await refreshList();
      if (selected) await loadEvidence(selected, dictionaryId);
    } catch (exc) {
      setMessage(errorMessage(exc));
    } finally {
      setLoading(false);
    }
  }

  async function deleteTerm() {
    if (!dictionaryId || !window.confirm("删除后会解除相关作品的词典映射，是否继续？")) return;
    setLoading(true);
    setMessage(null);
    try {
      await api.dictionaryDelete(dictionaryId);
      setMessage("已删除该词条，并解除相关作品标签映射。");
      newLocalTerm();
      await refreshList();
    } catch (exc) {
      setMessage(errorMessage(exc));
    } finally {
      setLoading(false);
    }
  }

  return {
    query,
    typeFilter,
    status,
    offset,
    limit,
    summary,
    candidates,
    selectedKey,
    dictionaryId,
    evidence,
    form,
    preview,
    loading,
    evidenceLoading,
    message,
    bulkOpen,
    suggesting,
    translating,
    mtError,
    batchCount: batchRemoteTagIds.length,
    setBulkOpen,
    setOffset,
    updateQuery,
    updateTypeFilter,
    updateStatus,
    updateLimit,
    updateForm,
    refreshList,
    selectCandidate,
    newLocalTerm,
    suggestBatch,
    machineTranslate,
    previewApply,
    apply,
    ignore,
    review,
    deleteTerm,
  };
}

function candidateKey(candidate: DictionaryCandidate | null) {
  if (!candidate) return null;
  if (candidate.id != null) return `remote-${candidate.id}`;
  if (candidate.dictionary_id != null) return `dict-${candidate.dictionary_id}`;
  return `${candidate.type ?? "tag"}:${candidate.name ?? candidate.slug ?? "unknown"}`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
