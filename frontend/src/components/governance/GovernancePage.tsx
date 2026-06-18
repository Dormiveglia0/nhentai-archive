import { RefreshCw, Save, Tags } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  api,
  DictionaryApplyPayload,
  GovernanceAggregate,
  GovernanceQueue,
  GovernanceQueueItem,
  GovernanceTag,
  MetadataFieldDiff,
} from "../../lib/api";
import { FadeIn, Stagger, StaggerItem } from "../../lib/motion";
import { navigate } from "../../lib/navigation";
import { formatBytes, workTitle } from "../library/libraryHelpers";

type Props = {
  initialWorkId?: number;
  blurCovers: boolean;
};

type FieldEdit = {
  value: string;
  source: "manual" | "remote" | "comicinfo" | "current";
};

// Fields where the parsed source value is inherited as the local final value by default.
const INHERIT_FIELDS = new Set(["title", "title_japanese", "pretty_title", "artist", "group", "published_at", "summary"]);
// Long-form fields span the full editor width.
const WIDE_FIELDS = new Set(["summary"]);

export function GovernancePage({ initialWorkId, blurCovers }: Props) {
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
    api.governanceQueue()
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
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setAggregate(null);
      return;
    }
    let alive = true;
    setAggregateLoading(true);
    setError(null);
    api.workGovernance(selectedId)
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

  const onSelect = (id: number) => {
    setSelectedId(id);
    navigate({ name: "governance", workId: id });
  };

  return (
    <section className="page governance-page">
      <header className="governance-topbar">
        <div>
          <span className="eyebrow">Metadata</span>
          <h1>元数据编辑</h1>
        </div>
        <p>从队列选一部作品，对照来源核对并写入本地最终元数据。</p>
      </header>

      {error ? <FadeIn key={error} className="notice error" y={6}>{error}</FadeIn> : null}
      {notice ? <FadeIn key={notice} className="notice success" y={6}>{notice}</FadeIn> : null}

      {loading ? <div className="page-panel">正在读取作品队列...</div> : null}

      {!loading && queue && queue.result.length === 0 ? (
        <div className="page-panel boundary-panel">
          <strong>暂无待编辑作品</strong>
          <p>当前本地库没有可编辑元数据的真实作品。导入 CBZ 后这里会显示真实队列。</p>
        </div>
      ) : null}

      {!loading && queue && queue.result.length ? (
        <>
          <GovernanceQueueStrip queue={queue} selectedId={selectedId} onSelect={onSelect} />

          {aggregateLoading ? <div className="page-panel">正在读取作品元数据...</div> : null}
          {!aggregateLoading && aggregate ? (
            <FadeIn key={aggregate.work.id} y={10}>
              <WorkHeader aggregate={aggregate} blurCovers={blurCovers} />

              <MetadataEditor
                aggregate={aggregate}
                edits={edits}
                onChange={(field, edit) => setEdits((current) => ({ ...current, [field]: edit }))}
                onlyDiff={onlyDiff}
                onToggleDiff={() => setOnlyDiff((value) => !value)}
              />

              <TagSection aggregate={aggregate} onApplyDictionaryTag={applyDictionaryTag} />

              <GovernanceActionBar
                changedCount={changedFields.length}
                saving={saving}
                onSave={saveMetadata}
                onReload={reload}
              />
            </FadeIn>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function GovernanceQueueStrip({
  queue,
  selectedId,
  onSelect,
}: {
  queue: GovernanceQueue;
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <section className="governance-queue-strip">
      <div className="governance-queue-strip-head">
        <div className="governance-queue-strip-title">
          <span className="eyebrow">Queue</span>
          <h2>待编辑作品</h2>
          <strong>{queue.summary.total}</strong>
        </div>
      </div>
      <Stagger key={queue.result.map((item) => item.work.id).join("-")} className="governance-queue-track">
        {queue.result.map((item) => (
          <StaggerItem key={item.work.id} className="governance-queue-card-cell">
            <QueueCard item={item} selected={selectedId === item.work.id} onSelect={onSelect} />
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}

function QueueCard({ item, selected, onSelect }: { item: GovernanceQueueItem; selected: boolean; onSelect: (id: number) => void }) {
  return (
    <button className={`governance-queue-card ${selected ? "selected" : ""}`} type="button" onClick={() => onSelect(item.work.id)}>
      <strong>{workTitle(item.work)}</strong>
      <small>{item.work.remote_gallery_id ? `ID ${item.work.remote_gallery_id}` : item.work.source}</small>
      <span className="governance-reason-row">
        {item.reasons.length ? (
          item.reasons.slice(0, 3).map((reason) => (
            <em key={reason.code} className={reason.severity === "danger" ? "danger" : ""}>
              {reason.label}
            </em>
          ))
        ) : (
          <em className="ok">无待办</em>
        )}
      </span>
    </button>
  );
}

function WorkHeader({ aggregate, blurCovers }: { aggregate: GovernanceAggregate; blurCovers: boolean }) {
  const sourceFile = aggregate.files.find((file) => file.kind === "source_cbz");
  return (
    <header className="governance-work-header">
      <div className="governance-cover">
        {aggregate.work.cover_path ? (
          <img className={blurCovers ? "blurred" : ""} src={`/api/works/${aggregate.work.id}/cover`} alt="" />
        ) : (
          <span>无封面</span>
        )}
      </div>
      <div className="governance-title-block">
        <h2>{workTitle(aggregate.work)}</h2>
        <p>{aggregate.work.title_japanese || aggregate.work.pretty_title || "本地最终标题待确认"}</p>
        <dl className="governance-header-facts">
          <div>
            <dt>来源</dt>
            <dd>{aggregate.work.source === "remote" ? "远端入库" : "本地导入"}</dd>
          </div>
          <div>
            <dt>Gallery ID</dt>
            <dd>{aggregate.work.remote_gallery_id || "-"}</dd>
          </div>
          <div>
            <dt>页数</dt>
            <dd>{aggregate.work.page_count}P</dd>
          </div>
          <div>
            <dt>文件大小</dt>
            <dd>{formatBytes(sourceFile?.size_bytes)}</dd>
          </div>
        </dl>
      </div>
    </header>
  );
}

function MetadataEditor({
  aggregate,
  edits,
  onChange,
  onlyDiff,
  onToggleDiff,
}: {
  aggregate: GovernanceAggregate;
  edits: Record<string, FieldEdit>;
  onChange: (field: string, edit: FieldEdit) => void;
  onlyDiff: boolean;
  onToggleDiff: () => void;
}) {
  const fields = onlyDiff
    ? aggregate.metadata.fields.filter((field) => field.differs_from_source || field.dirty)
    : aggregate.metadata.fields;

  return (
    <section className="governance-metadata governance-panel">
      <div className="governance-panel-head">
        <div>
          <span className="eyebrow">ComicInfo / 字段</span>
          <h2>元数据对照编辑</h2>
        </div>
        <label className="governance-check">
          <input type="checkbox" checked={onlyDiff} onChange={onToggleDiff} />
          仅显示有差异
        </label>
      </div>
      <div className="metadata-cards">
        {fields.length ? (
          fields.map((field) => (
            <MetadataCard
              key={field.field}
              field={field}
              edit={edits[field.field]}
              onChange={(edit) => onChange(field.field, edit)}
            />
          ))
        ) : (
          <p className="empty-inline">当前没有与来源值存在差异的字段。</p>
        )}
      </div>
    </section>
  );
}

function MetadataCard({
  field,
  edit,
  onChange,
}: {
  field: MetadataFieldDiff;
  edit: FieldEdit;
  onChange: (edit: FieldEdit) => void;
}) {
  const sourceAllowed = field.source === "remote" || field.source === "comicinfo" ? field.source : "manual";
  const wide = WIDE_FIELDS.has(field.field);
  return (
    <article className={`metadata-card ${field.differs_from_source ? "diff" : ""} ${wide ? "wide" : ""}`}>
      <div className="metadata-card-head">
        <strong>{field.label}</strong>
        {field.source_value ? <span className="metadata-source-badge">{sourceLabel(field.source)}</span> : null}
        {field.differs_from_source ? <em className="metadata-diff-flag">与来源不同</em> : null}
      </div>
      <div className="metadata-compare">
        <div className="metadata-col">
          <span className="metadata-col-label">当前值（库内）</span>
          <ValueChips value={field.current_value} empty="未设置" />
        </div>
        <div className="metadata-col">
          <span className="metadata-col-label">来源值（解析）</span>
          <ValueChips value={field.source_value} empty="未解析" accent />
        </div>
      </div>
      <div className="metadata-final">
        <span className="metadata-col-label">本地最终值</span>
        <AutoGrowTextarea
          value={edit?.value ?? ""}
          onChange={(value) => onChange({ value, source: "manual" })}
          placeholder="未设置"
        />
      </div>
      <div className="metadata-card-actions">
        <button
          type="button"
          disabled={!field.source_value}
          onClick={() => onChange({ value: field.source_value || "", source: sourceAllowed })}
        >
          采用来源值
        </button>
        <button type="button" onClick={() => onChange({ value: field.current_value || "", source: "current" })}>
          恢复当前
        </button>
      </div>
    </article>
  );
}

function ValueChips({ value, empty, accent = false }: { value?: string | null; empty: string; accent?: boolean }) {
  const parts = splitValues(value);
  if (!parts.length) return <em className="metadata-empty-val">{empty}</em>;
  return (
    <div className="value-chips">
      {parts.map((part, index) => (
        <span key={`${part}-${index}`} className={accent ? "accent" : ""}>
          {part}
        </span>
      ))}
    </div>
  );
}

function AutoGrowTextarea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      className="metadata-final-input"
      rows={1}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function TagSection({
  aggregate,
  onApplyDictionaryTag,
}: {
  aggregate: GovernanceAggregate;
  onApplyDictionaryTag: (tag: GovernanceTag) => Promise<void>;
}) {
  return (
    <section className="governance-tags governance-panel">
      <div className="governance-panel-head">
        <div>
          <span className="eyebrow">Tags</span>
          <h2>标签</h2>
        </div>
        <button type="button" onClick={() => navigate({ name: "dictionary" })}>
          管理词典
        </button>
      </div>
      {aggregate.tags.groups.length ? (
        <div className="tag-governance-groups">
          {aggregate.tags.groups.map((group) => (
            <article key={group.key}>
              <h3>{group.label}</h3>
              <div className="governance-tag-wrap">
                {group.tags.map((tag) => (
                  <span key={tag.id} className={`governance-tag ${tag.state === "conflict" ? "conflict" : ""}`}>
                    {tag.display}
                    {tag.state === "conflict" ? (
                      <button type="button" onClick={() => navigate({ name: "dictionary" })}>
                        去词典
                      </button>
                    ) : tag.state === "pending" && tag.remote_tag_id ? (
                      <button type="button" onClick={() => void onApplyDictionaryTag(tag)}>
                        确认
                      </button>
                    ) : null}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-inline">该作品暂无标签。可从词典或重新解析流程补充。</p>
      )}
    </section>
  );
}

function GovernanceActionBar({
  changedCount,
  saving,
  onSave,
  onReload,
}: {
  changedCount: number;
  saving: boolean;
  onSave: () => Promise<void>;
  onReload: () => Promise<void>;
}) {
  return (
    <div className="governance-actionbar">
      <button className="governance-action primary" type="button" onClick={() => void onSave()} disabled={saving || changedCount === 0}>
        <Save size={17} />
        {saving ? "保存中..." : `保存修改${changedCount ? ` (${changedCount})` : ""}`}
      </button>
      <button className="governance-action" type="button" onClick={() => navigate({ name: "dictionary" })}>
        <Tags size={16} />
        管理词典
      </button>
      <button className="governance-action" type="button" onClick={() => void onReload()}>
        <RefreshCw size={16} />
        重新读取
      </button>
    </div>
  );
}

function buildInitialEdits(fields: MetadataFieldDiff[]): Record<string, FieldEdit> {
  return Object.fromEntries(
    fields.map((field) => {
      const hasOverride = field.working_source !== "current";
      if (
        !hasOverride &&
        INHERIT_FIELDS.has(field.field) &&
        field.source_value &&
        normalize(field.source_value) !== normalize(field.working_value)
      ) {
        return [field.field, { value: field.source_value, source: toEditableSource(field.source) }];
      }
      return [field.field, { value: field.working_value || "", source: toEditableSource(field.working_source) }];
    })
  );
}

function toEditableSource(source: string): FieldEdit["source"] {
  return source === "remote" || source === "comicinfo" || source === "current" ? source : "manual";
}

function sourceLabel(source: string): string {
  if (source === "comicinfo") return "ComicInfo";
  if (source === "remote") return "远端缓存";
  if (source === "json") return "JSON";
  return "未解析";
}

function splitValues(value?: string | null): string[] {
  if (!value) return [];
  return value
    .split(" / ")
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalize(value: unknown): string {
  return String(value ?? "").trim();
}
