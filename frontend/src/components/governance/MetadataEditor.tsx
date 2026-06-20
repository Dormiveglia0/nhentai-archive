import { useLayoutEffect, useRef } from "react";

import type { GovernanceAggregate, MetadataFieldDiff } from "../../lib/api";
import { Stagger, StaggerItem } from "../../lib/motion";
import { type FieldEdit, sourceLabel, splitValues } from "./governanceHelpers";

type Props = {
  aggregate: GovernanceAggregate;
  edits: Record<string, FieldEdit>;
  onChange: (field: string, edit: FieldEdit) => void;
  onlyDiff: boolean;
  onToggleDiff: () => void;
};

export function MetadataEditor({ aggregate, edits, onChange, onlyDiff, onToggleDiff }: Props) {
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
      <Stagger key={`${aggregate.work.id}-${onlyDiff}`} className="metadata-cards">
        {fields.length ? (
          fields.map((field) => (
            <StaggerItem key={field.field} className="metadata-cell">
              <MetadataCard field={field} edit={edits[field.field]} onChange={(edit) => onChange(field.field, edit)} />
            </StaggerItem>
          ))
        ) : (
          <p className="empty-inline">当前没有与来源值存在差异的字段。</p>
        )}
      </Stagger>
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
  return (
    <article className={`metadata-card ${field.differs_from_source ? "diff" : ""}`}>
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
