import { useEffect, useMemo, useState } from "react";

import {
  api,
  DictionaryApplyPayload,
  GovernanceAggregate,
  GovernanceBulkPreview,
  GovernanceBulkResult,
  GovernanceQueue,
  GovernanceTag,
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
  const [onlyDiff, setOnlyDiff] = useState(false);
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [writeBack, setWriteBack] = useState(false);

  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkFill, setBulkFill] = useState(true);
  const [bulkWriteBack, setBulkWriteBack] = useState(false);
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
    const [queuePayload, aggregatePayload] = await Promise.all([
      api.governanceQueue(),
      selectedId ? api.workGovernance(selectedId) : Promise.resolve(null),
    ]);
    setQueue(queuePayload);
    setAggregate(aggregatePayload);
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

  const translateMetadata = async () => {
    if (!aggregate) return;
    setTranslating(true);
    setNotice(null);
    setError(null);
    try {
      const out = await api.translateWorkGovernance(aggregate.work.id);
      if (!out.result.length) {
        setNotice("没有可机翻的字段（来源为空或翻译无变化）。");
        return;
      }
      // 仅预填进编辑框供人工复核;不写库,需用户点击保存才持久化。
      setEdits((current) => {
        const next = { ...current };
        out.result.forEach((item) => {
          next[item.field] = { value: item.suggestion, source: "manual" };
        });
        return next;
      });
      setNotice(`已机翻填充 ${out.result.length} 个字段（${out.provider ?? "机翻"}），请复核后保存。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setTranslating(false);
    }
  };

  const applyDictionaryTag = async (tag: GovernanceTag) => {
    if (!aggregate || !tag.remote_tag_id) return;
    const original = tag.name || tag.slug || tag.display;
    const payload: DictionaryApplyPayload = {
      original_text: original,
      zh_name: tag.display,
      tag_type: tag.type || "tag",
      remote_tag_id: tag.remote_tag_id,
      status: "configured",
    };
    setNotice(null);
    setError(null);
    const preview = await api.dictionaryPreviewApply(payload);
    if (preview.conflicts.length) {
      setError(`词典预览发现 ${preview.conflicts.length} 个冲突，请到词典页处理。`);
      return;
    }
    const result = await api.applyWorkGovernance(aggregate.work.id, { metadata: [], dictionary_apply: [payload] });
    setAggregate(result.governance);
    setQueue(await api.governanceQueue());
    setNotice(`已应用词典映射：${tag.display}`);
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

  const runBulkPreview = async () => {
    if (!selectedIds.size) {
      setNotice("请先勾选要批量处理的作品。");
      return;
    }
    if (!bulkFill && !bulkWriteBack) {
      setNotice("请至少选择一个批量动作。");
      return;
    }
    setBulkBusy(true);
    setError(null);
    setNotice(null);
    setBulkResult(null);
    try {
      setBulkPreview(await api.governanceBulkPreview([...selectedIds], { fill_missing_metadata: bulkFill, write_back: bulkWriteBack }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBulkBusy(false);
    }
  };

  const runBulkApply = async () => {
    if (!selectedIds.size) return;
    if (!bulkFill && !bulkWriteBack) {
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
      const result = await api.governanceBulkApply([...selectedIds], { fill_missing_metadata: bulkFill, write_back: bulkWriteBack });
      setBulkResult(result);
      setBulkPreview(null);
      setQueue(await api.governanceQueue());
      const { filled_fields, written, errors } = result.summary;
      setNotice(`批量完成：补全 ${filled_fields} 个字段，回写 ${written} 个文件${errors ? `，${errors} 个失败` : ""}。`);
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
    translateMetadata,
    applyDictionaryTag,
    selectWork,
    bulkMode,
    toggleBulkMode,
    selectedIds,
    toggleSelected,
    bulkFill,
    setBulkFill: changeBulkFill,
    bulkWriteBack,
    setBulkWriteBack: changeBulkWriteBack,
    bulkPreview,
    bulkResult,
    bulkBusy,
    runBulkPreview,
    runBulkApply,
  };
}
