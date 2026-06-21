import { useEffect, useMemo, useState } from "react";

import {
  api,
  DictionaryApplyPayload,
  GovernanceAggregate,
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
    if (!aggregate || !changedFields.length) {
      setNotice("没有需要保存的修改。");
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
      const result = await api.applyWorkGovernance(aggregate.work.id, { metadata: changed });
      setAggregate(result.governance);
      setQueue(await api.governanceQueue());
      setNotice(`已保存 ${result.saved} 个字段。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
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
    changedFields,
    changeField,
    reload,
    saveMetadata,
    applyDictionaryTag,
    selectWork,
  };
}
