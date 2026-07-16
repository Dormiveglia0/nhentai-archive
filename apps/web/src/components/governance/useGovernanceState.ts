import { useEffect, useMemo, useState } from "react";

import {
  api,
  DictionaryApplyPayload,
  GovernanceAggregate,
  GovernanceBulkPreview,
  GovernanceBulkResult,
  GovernanceQueue,
  GovernanceTag,
  GovernanceTranslateSuggestion,
} from "../../lib/api";
import { navigate } from "../../lib/navigation";
import { buildInitialEdits, type FieldEdit, normalize } from "./governanceHelpers";

export function useGovernanceState(initialWorkId?: number) {
  const [queue, setQueue] = useState<GovernanceQueue | null>(null);
  const [aggregate, setAggregate] = useState<GovernanceAggregate | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(initialWorkId ?? null);
  const [loading, setLoading] = useState(true);
  const [aggregateLoading, setAggregateLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [edits, setEdits] = useState<Record<string, FieldEdit>>({});
  const [onlyDiff, setOnlyDiff] = useState(true);
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translationSuggestions, setTranslationSuggestions] = useState<GovernanceTranslateSuggestion[]>([]);
  const [dictionaryApplyingId, setDictionaryApplyingId] = useState<number | null>(null);
  const [writeBack, setWriteBack] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [reviewNote, setReviewNote] = useState("");

  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkFill, setBulkFill] = useState(true);
  const [bulkWriteBack, setBulkWriteBack] = useState(false);
  const [bulkConfirmTerms, setBulkConfirmTerms] = useState(false);
  const [bulkPreview, setBulkPreview] = useState<GovernanceBulkPreview | null>(null);
  const [bulkResult, setBulkResult] = useState<GovernanceBulkResult | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    setSelectedId(initialWorkId ?? null);
  }, [initialWorkId]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    api
      .governanceQueue()
      .then((payload) => {
        if (!alive) return;
        setQueue(payload);
        if (!selectedId && payload.result.length) {
          setSelectedId(payload.result[0].work.id);
        }
      })
      .catch((err: Error) => alive && setError(err.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // Initial queue load only; selection is seeded inside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setAggregate(null);
      return;
    }
    let alive = true;
    setAggregateLoading(true);
    setError(null);
    api
      .workGovernance(selectedId)
      .then((payload) => alive && setAggregate(payload))
      .catch((err: Error) => alive && setError(err.message))
      .finally(() => alive && setAggregateLoading(false));
    return () => {
      alive = false;
    };
  }, [selectedId]);

  const initialEdits = useMemo(
    () => (aggregate ? buildInitialEdits(aggregate.metadata.fields) : {}),
    [aggregate]
  );
  useEffect(() => {
    setEdits(initialEdits);
    setTranslationSuggestions([]);
    setReviewNote("");
  }, [initialEdits]);

  const changedFields = aggregate
    ? aggregate.metadata.fields.filter((field) => {
        const edit = edits[field.field];
        return edit && (normalize(edit.value) !== normalize(field.working_value) || edit.source !== field.working_source);
      })
    : [];

  const changeField = (field: string, edit: FieldEdit) =>
    setEdits((current) => ({ ...current, [field]: edit }));

  const reload = async () => {
    setNotice(null);
    setError(null);
    setAggregateLoading(Boolean(selectedId));
    try {
      const [queuePayload, aggregatePayload] = await Promise.all([
        api.governanceQueue(),
        selectedId ? api.workGovernance(selectedId) : Promise.resolve(null),
      ]);
      setQueue(queuePayload);
      setAggregate(aggregatePayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAggregateLoading(false);
    }
  };

  const saveMetadata = async () => {
    if (!aggregate || (!changedFields.length && !writeBack)) {
      setNotice("没有需要保存的修改。");
      return;
    }
    if (writeBack && !window.confirm("将就地改写源 CBZ 的 ComicInfo，此操作不可撤销。是否继续？")) {
      return;
    }
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      const changed = changedFields.map((field) => ({
        field: field.field,
        value: edits[field.field].value.trim() || null,
        source: edits[field.field].source,
      }));
      const result = await api.applyWorkGovernance(aggregate.work.id, {
        metadata: changed,
        write_back: writeBack,
      });
      setAggregate(result.governance);
      setQueue(await api.governanceQueue());
      if (result.write_back?.error) {
        setNotice(`已保存 ${result.saved} 个字段，但回写源文件失败：${result.write_back.error}`);
      } else if (result.write_back?.written) {
        setNotice(`已保存 ${result.saved} 个字段，并回写 ComicInfo 到源文件。`);
      } else {
        setNotice(`已保存 ${result.saved} 个字段。`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const translateMetadata = async (fields: string[]) => {
    if (!aggregate) return;
    if (!fields.length) {
      setNotice("请至少选择一个需要生成中文建议的字段。");
      return;
    }
    setTranslating(true);
    setNotice(null);
    setError(null);
    try {
      const out = await api.translateWorkGovernance(aggregate.work.id, fields);
      if (!out.result.length) {
        setTranslationSuggestions([]);
        setNotice("没有生成可用建议：所选字段为空，或翻译结果与原文相同。");
        return;
      }
      setTranslationSuggestions(out.result);
      setNotice(`已生成 ${out.result.length} 条中文建议（${out.provider ?? "机翻"}）；尚未采纳或保存。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setTranslating(false);
    }
  };

  const acceptTranslation = (suggestion: GovernanceTranslateSuggestion) => {
    changeField(suggestion.field, { value: suggestion.suggestion, source: "manual" });
    setTranslationSuggestions((current) => current.filter((item) => item.field !== suggestion.field));
  };

  const acceptAllTranslations = () => {
    setEdits((current) => {
      const next = { ...current };
      translationSuggestions.forEach((item) => {
        next[item.field] = { value: item.suggestion, source: "manual" };
      });
      return next;
    });
    setTranslationSuggestions([]);
    setNotice("中文建议已放入本地最终值；仍需点击保存才会写入数据库。");
  };

  const dismissTranslation = (field: string) =>
    setTranslationSuggestions((current) => current.filter((item) => item.field !== field));

  const applyDictionaryTag = async (tag: GovernanceTag, zhName: string) => {
    if (!aggregate || !tag.remote_tag_id || dictionaryApplyingId !== null) return;
    const original = tag.name || tag.slug || tag.display;
    const cleanName = zhName.trim();
    if (!cleanName) {
      setNotice("请先填写本地显示名。");
      return;
    }
    const payload: DictionaryApplyPayload = {
      original_text: original,
      zh_name: cleanName,
      tag_type: tag.type || "tag",
      remote_tag_id: tag.remote_tag_id,
      status: "configured",
    };
    setDictionaryApplyingId(tag.id);
    setNotice(null);
    setError(null);
    try {
      const preview = await api.dictionaryPreviewApply(payload);
      if (preview.conflicts.length) {
        setError(`词典预览发现 ${preview.conflicts.length} 个冲突，请到词典页处理。`);
        return;
      }
      const result = await api.applyWorkGovernance(aggregate.work.id, { metadata: [], dictionary_apply: [payload] });
      setAggregate(result.governance);
      setQueue(await api.governanceQueue());
      setNotice(`已建立词典映射：${original} → ${cleanName}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDictionaryApplyingId(null);
    }
  };

  const reviewDictionaryTag = async (tag: GovernanceTag) => {
    if (!aggregate || !tag.dictionary_id || dictionaryApplyingId !== null) return;
    setDictionaryApplyingId(tag.id);
    setNotice(null);
    setError(null);
    try {
      await api.dictionaryReview(tag.dictionary_id);
      const [nextAggregate, nextQueue] = await Promise.all([
        api.workGovernance(aggregate.work.id),
        api.governanceQueue(),
      ]);
      setAggregate(nextAggregate);
      setQueue(nextQueue);
      setNotice(`已确认词典译名：${tag.display}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDictionaryApplyingId(null);
    }
  };

  const reviewWork = async (action: "approve" | "reopen") => {
    if (!aggregate) return;
    if (action === "approve" && changedFields.length) {
      setNotice("请先保存字段修改，再核对当前版本。");
      return;
    }
    setReviewing(true);
    setNotice(null);
    setError(null);
    try {
      const result = await api.reviewWorkGovernance(aggregate.work.id, action, reviewNote);
      setAggregate(result.governance);
      setQueue(await api.governanceQueue());
      setReviewNote("");
      setNotice(action === "approve" ? "已记录本版本的人工核对；字段、词典或文件变化后会自动失效。" : "已撤销人工核对，作品重新进入待核对队列。");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setReviewing(false);
    }
  };

  const selectWork = (id: number) => {
    setSelectedId(id);
    navigate({ name: "governance", workId: id });
  };

  const toggleBulkMode = () => {
    setBulkMode((on) => !on);
    setSelectedIds(new Set());
    setBulkPreview(null);
    setBulkResult(null);
  };

  const clearBulkPreview = () => {
    setBulkPreview(null);
    setBulkResult(null);
  };

  const toggleSelected = (id: number) =>
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      clearBulkPreview();
      return next;
    });

  const changeBulkFill = (value: boolean) => {
    setBulkFill(value);
    clearBulkPreview();
  };

  const changeBulkWriteBack = (value: boolean) => {
    setBulkWriteBack(value);
    clearBulkPreview();
  };

  const changeBulkConfirmTerms = (value: boolean) => {
    setBulkConfirmTerms(value);
    clearBulkPreview();
  };

  const runBulkPreview = async () => {
    if (!selectedIds.size) {
      setNotice("请先勾选要批量处理的作品。");
      return;
    }
    if (!bulkFill && !bulkWriteBack && !bulkConfirmTerms) {
      setNotice("请至少选择一个批量动作。");
      return;
    }
    setBulkBusy(true);
    setError(null);
    setNotice(null);
    setBulkResult(null);
    try {
      setBulkPreview(
        await api.governanceBulkPreview([...selectedIds], {
          fill_missing_metadata: bulkFill,
          write_back: bulkWriteBack,
          confirm_dictionary_terms: bulkConfirmTerms,
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBulkBusy(false);
    }
  };

  const runBulkApply = async () => {
    if (!selectedIds.size) return;
    if (!bulkFill && !bulkWriteBack && !bulkConfirmTerms) {
      setNotice("请至少选择一个批量动作。");
      return;
    }
    if (bulkWriteBack && !window.confirm("将就地改写所选作品源 CBZ 的 ComicInfo，此操作不可撤销。是否继续？")) {
      return;
    }
    setBulkBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.governanceBulkApply([...selectedIds], {
        fill_missing_metadata: bulkFill,
        write_back: bulkWriteBack,
        confirm_dictionary_terms: bulkConfirmTerms,
      });
      setBulkResult(result);
      setBulkPreview(null);
      setQueue(await api.governanceQueue());
      const { filled_fields, written, errors, dictionary_terms_confirmed } = result.summary;
      setNotice(
        `批量完成：补全 ${filled_fields} 个字段，确认 ${dictionary_terms_confirmed} 个词条，回写 ${written} 个文件${errors ? `，${errors} 个失败` : ""}。`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBulkBusy(false);
    }
  };

  return {
    queue,
    aggregate,
    selectedId,
    loading,
    aggregateLoading,
    error,
    notice,
    edits,
    onlyDiff,
    setOnlyDiff,
    saving,
    writeBack,
    setWriteBack,
    changedFields,
    changeField,
    reload,
    saveMetadata,
    translating,
    translationSuggestions,
    acceptTranslation,
    acceptAllTranslations,
    dismissTranslation,
    dictionaryApplyingId,
    translateMetadata,
    applyDictionaryTag,
    reviewDictionaryTag,
    reviewing,
    reviewNote,
    setReviewNote,
    reviewWork,
    selectWork,
    bulkMode,
    toggleBulkMode,
    selectedIds,
    toggleSelected,
    bulkFill,
    setBulkFill: changeBulkFill,
    bulkWriteBack,
    setBulkWriteBack: changeBulkWriteBack,
    bulkConfirmTerms,
    setBulkConfirmTerms: changeBulkConfirmTerms,
    bulkPreview,
    bulkResult,
    bulkBusy,
    runBulkPreview,
    runBulkApply,
  };
}
