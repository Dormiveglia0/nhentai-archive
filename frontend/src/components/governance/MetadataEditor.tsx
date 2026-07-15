import { Languages } from "lucide-react";
import { useLayoutEffect, useRef } from "react";

import type { GovernanceAggregate, MetadataFieldDiff } from "../../lib/api";
import { Stagger, StaggerItem } from "../../lib/motion";
import { normalize, type FieldEdit, sourceLabel, splitValues, toEditableSource } from "./governanceHelpers";

type Props = {
  aggregate: GovernanceAggregate;
  edits: Record<string, FieldEdit>;
  onChange: (field: string, edit: FieldEdit) => void;
  onlyDiff: boolean;
  onToggleDiff: () => void;
  onTranslate: () => void;
  translating: boolean;
};

const REQUIRED_FIELDS = new Set(["title", "language"]);

export function MetadataEditor({ aggregate, edits, onChange, onlyDiff, onToggleDiff, onTranslate, translating }: Props) {
  const changed = (field: MetadataFieldDiff) => isChanged(field, edits[field.field]);
  const needsDecision = (field: MetadataFieldDiff) =>
    changed(field) || (!normalize(field.working_value) && REQUIRED_FIELDS.has(field.field));
  const fields = onlyDiff
    ? aggregate.metadata.fields.filter(needsDecision)
    : aggregate.metadata.fields;
  const adoptable = aggregate.metadata.fields.filter(
    (field) => field.source_value && !normalize(edits[field.field]?.value)
  );

  const adoptAllSources = () => {
    adoptable.forEach((field) => {
      onChange(field.field, { value: field.source_value || "", source: toEditableSource(field.source) });
    });
  };

  return (
    <section id="governance-metadata" className="folio-governance-fields">
      <header className="folio-governance-section-head">
        <div>
          <span>Decision table</span>
          <h2>字段决策</h2>
        </div>
        <div className="folio-governance-section-tools">
          <button type="button" className="folio-line-button" onClick={adoptAllSources} disabled={!adoptable.length}>
            补全空字段{adoptable.length ? ` (${adoptable.length})` : ""}
          </button>
          <button type="button" className="folio-line-button" onClick={onTranslate} disabled={translating}>
            <Languages size={14} />
            {translating ? "机翻中…" : "机翻填充中文"}
          </button>
          <button
            type="button"
            className={onlyDiff ? "folio-filter-toggle is-active" : "folio-filter-toggle"}
            aria-pressed={onlyDiff}
            onClick={onToggleDiff}
          >
            {onlyDiff ? "查看全部字段" : "只看待确认"}
          </button>
        </div>
      </header>
      <Stagger key={`${aggregate.work.id}-${onlyDiff}`} className="folio-governance-field-grid">
        {fields.length ? (
          fields.map((field) => (
            <StaggerItem key={field.field} className="folio-governance-field-cell">
              <MetadataCard field={field} edit={edits[field.field]} onChange={(edit) => onChange(field.field, edit)} />
            </StaggerItem>
          ))
        ) : (
          <p className="folio-governance-inline-empty">当前没有待确认字段；可查看全部字段进行人工复核。</p>
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
  const sourceAllowed = toEditableSource(field.source);
  const changed = isChanged(field, edit);
  const needsDecision = !normalize(field.working_value) && REQUIRED_FIELDS.has(field.field);
  return (
    <article className={`folio-governance-field-card${needsDecision ? " is-review" : ""}${changed ? " is-changed" : ""}`}>
      <div className="folio-governance-field-head">
        <strong>{field.label}</strong>
        {field.source_value ? <span>{sourceLabel(field.source)}</span> : null}
        {field.differs_from_source ? <span>来源不同</span> : null}
        {needsDecision ? <em>待确认</em> : null}
        {changed ? <em className="is-changed">待保存</em> : null}
      </div>
      <div className="folio-governance-field-compare">
        <div className="folio-governance-field-column">
          <span className="folio-governance-field-label">当前值（库内）</span>
          <ValueChips value={field.current_value} empty="未设置" />
        </div>
        <div className="folio-governance-field-column">
          <span className="folio-governance-field-label">来源值（解析）</span>
          <ValueChips value={field.source_value} empty="未解析" accent />
        </div>
      </div>
      <div className="folio-governance-field-final">
        <span className="folio-governance-field-label">本地最终值</span>
        <AutoGrowTextarea
          label={`本地最终值：${field.label}`}
          value={edit?.value ?? ""}
          onChange={(value) => onChange({ value, source: "manual" })}
          placeholder="未设置"
        />
      </div>
      <div className="folio-governance-field-actions">
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
  if (!parts.length) return <em className="folio-governance-field-empty">{empty}</em>;
  return (
    <div className="folio-governance-value-chips">
      {parts.map((part, index) => (
        <span key={`${part}-${index}`} className={accent ? "accent" : ""}>
          {part}
        </span>
      ))}
    </div>
  );
}

function AutoGrowTextarea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      className="folio-governance-field-input"
      rows={1}
      aria-label={label}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function isChanged(field: MetadataFieldDiff, edit?: FieldEdit) {
  if (!edit) return false;
  return (
    normalize(edit.value) !== normalize(field.working_value) || edit.source !== field.working_source
  );
}
