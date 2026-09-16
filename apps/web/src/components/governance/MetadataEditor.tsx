import { ArrowRight } from "lucide-react";
import { useEffect, useLayoutEffect, useRef } from "react";

import type { GovernanceAggregate, GovernanceTranslateSuggestion, MetadataFieldDiff } from "../../lib/api";
import { Stagger, StaggerItem, usePrefersReducedMotion } from "../../lib/motion";
import { GovernanceTranslationPanel } from "./GovernanceTranslationPanel";
import { normalize, type FieldEdit, sourceLabel, splitValues, toEditableSource } from "./governanceHelpers";

type Props = {
  aggregate: GovernanceAggregate;
  edits: Record<string, FieldEdit>;
  onChange: (field: string, edit: FieldEdit) => void;
  onlyDiff: boolean;
  onToggleDiff: () => void;
  onTranslate: (fields: string[]) => void;
  translating: boolean;
  translationSuggestions: GovernanceTranslateSuggestion[];
  onAcceptTranslation: (suggestion: GovernanceTranslateSuggestion) => void;
  onAcceptAllTranslations: () => void;
  onDismissTranslation: (field: string) => void;
};

const REQUIRED_FIELDS = new Set(["title", "language"]);

export function MetadataEditor({
  aggregate,
  edits,
  onChange,
  onlyDiff,
  onToggleDiff,
  onTranslate,
  translating,
  translationSuggestions,
  onAcceptTranslation,
  onAcceptAllTranslations,
  onDismissTranslation,
}: Props) {
  const changed = (field: MetadataFieldDiff) => isChanged(field, edits[field.field]);
  const needsDecision = (field: MetadataFieldDiff) =>
    changed(field) ||
    (!normalize(field.working_value) && REQUIRED_FIELDS.has(field.field)) ||
    (Boolean(normalize(field.source_value)) && field.differs_from_source);
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
          <h2>字段决策</h2>
        </div>
        <div className="folio-governance-section-tools">
          <button type="button" className="folio-line-button" onClick={adoptAllSources} disabled={!adoptable.length}>
            补全空字段{adoptable.length ? ` (${adoptable.length})` : ""}
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
      <GovernanceTranslationPanel
        suggestions={translationSuggestions}
        translating={translating}
        onGenerate={onTranslate}
        onAccept={onAcceptTranslation}
        onAcceptAll={onAcceptAllTranslations}
        onDismiss={onDismissTranslation}
      />
      <Stagger className="folio-governance-field-grid">
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
  const missingRequired = !normalize(field.working_value) && REQUIRED_FIELDS.has(field.field);
  const needsDecision = missingRequired || (Boolean(normalize(field.source_value)) && field.differs_from_source);
  const root = useRef<HTMLElement>(null), source = useRef<HTMLDivElement>(null), current = useRef<HTMLDivElement>(null);
  const motion = useRef<Animation>(), copy = useRef<HTMLElement>();
  const reduced = usePrefersReducedMotion();
  const clearTransfer = () => { motion.current?.cancel(); copy.current?.remove(); };
  useEffect(() => clearTransfer, []);

  function adopt(from: HTMLElement | null, next: FieldEdit) {
    clearTransfer();
    const target = root.current?.querySelector("textarea");
    if (!reduced && from && target && root.current && next.value) {
      const bounds = root.current.getBoundingClientRect(), start = from.getBoundingClientRect(), end = target.getBoundingClientRect();
      const value = document.createElement("span");
      value.className = "governance-transfer-copy";
      value.textContent = next.value;
      value.setAttribute("aria-hidden", "true");
      Object.assign(value.style, { left: `${start.x - bounds.x}px`, top: `${start.y - bounds.y}px`, width: `${start.width}px` });
      root.current.append(value);
      copy.current = value;
      const animation = value.animate([
        { transform: "translate(0,0)", opacity: .9 },
        { transform: `translate(${end.x - start.x}px,${end.y - start.y}px)`, opacity: .65, offset: .7 },
        { transform: `translate(${end.x - start.x}px,${end.y - start.y}px)`, opacity: 0 },
      ], { duration: 480, easing: "cubic-bezier(.22,1,.36,1)" });
      motion.current = animation;
      void animation.finished.then(() => value.remove(), () => value.remove());
    }
    onChange(next);
  }

  return <article ref={root} className={`folio-governance-field-card${needsDecision ? " is-review" : ""}${changed ? " is-changed" : ""}`}>
    <div className="folio-governance-field-head"><strong>{field.label}</strong>{field.differs_from_source ? <span>来源不同</span> : null}{missingRequired ? <em>必填缺失</em> : null}{changed ? <em className="is-changed">待保存</em> : null}</div>
    <div className="governance-comparison-current">
      <span className="folio-governance-field-label">当前值</span><div ref={current}><ValueChips value={field.current_value} empty="未设置" /></div>
      <button type="button" onClick={() => adopt(current.current, {value:field.current_value || "",source:"current"})}>恢复当前</button>
    </div>
    <div className="governance-comparison-source">
      <span className="folio-governance-field-label">{field.source_value ? sourceLabel(field.source) : "来源值"}</span><div ref={source}><ValueChips value={field.source_value} empty="未解析" accent /></div>
      <button type="button" disabled={!field.source_value} onClick={() => adopt(source.current, {value:field.source_value || "",source:sourceAllowed})}>采用来源值<ArrowRight size={15}/></button>
    </div>
    <div className="folio-governance-field-final">
      <span className="folio-governance-field-label">本地最终值</span>
      <AutoGrowTextarea label={`本地最终值：${field.label}`} value={edit?.value ?? ""} onChange={value => {clearTransfer();onChange({value,source:"manual"});}} placeholder="未设置"/>
      <div className="governance-value-transfer" aria-hidden="true"><span>{changed ? "待保存" : "当前生效"}</span></div>
    </div>
  </article>;
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
