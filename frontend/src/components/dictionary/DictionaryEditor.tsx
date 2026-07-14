import { Languages, Plus, X } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useEffect, useId, useState } from "react";

import type { DictionaryApplyPayload } from "../../lib/api";
import { FadeIn } from "../../lib/motion";
import { FolioSelect } from "../folio/ui/FolioPrimitives";

type Props = {
  value: DictionaryApplyPayload;
  dictionaryId?: number | null;
  loading: boolean;
  translating: boolean;
  mtError: string | null;
  onChange: (value: DictionaryApplyPayload) => void;
  onNew: () => void;
  onTranslate: () => void;
};

const TYPE_OPTIONS = [
  { value: "tag", label: "标签" },
  { value: "artist", label: "作者" },
  { value: "group", label: "社团" },
  { value: "character", label: "角色" },
  { value: "parody", label: "原作" },
  { value: "language", label: "语言" },
  { value: "category", label: "分类" },
] as const;

export function DictionaryEditor({ value, dictionaryId, loading, translating, mtError, onChange, onNew, onTranslate }: Props) {
  const [aliasDraft, setAliasDraft] = useState("");
  const [scopeDraft, setScopeDraft] = useState("");
  const editorKey = String(dictionaryId ?? value.remote_tag_id ?? "new");

  useEffect(() => {
    setAliasDraft("");
    setScopeDraft("");
  }, [editorKey]);

  function update(next: Partial<DictionaryApplyPayload>) {
    onChange({ ...value, ...next });
  }

  function addChip(field: "aliases" | "scope", draft: string, clear: () => void) {
    const item = draft.trim();
    if (!item) return;
    const current = value[field] ?? [];
    if (!current.includes(item)) update({ [field]: [...current, item] });
    clear();
  }

  function removeChip(field: "aliases" | "scope", item: string) {
    update({ [field]: (value[field] ?? []).filter((chip) => chip !== item) });
  }

  return (
    <section className="folio-dictionary-editor" aria-labelledby="folio-dictionary-editor-title">
      <header className="folio-dictionary-panel-head">
        <div>
          <span>Term editor</span>
          <h2 id="folio-dictionary-editor-title">术语编辑器</h2>
          <p>{value.remote_tag_id ? `远端标签 #${value.remote_tag_id}` : "本地自定义词条"}</p>
        </div>
        <button className="folio-line-button" type="button" onClick={onNew}>
          <Plus size={15} />
          新建本地词条
        </button>
      </header>

      <FadeIn key={editorKey} className="folio-dictionary-editor-motion" y={8}>
        <div className="folio-dictionary-form">
          <DictionaryField label="原文 *" wide>
            <input value={value.original_text} onChange={(event) => update({ original_text: event.target.value })} />
          </DictionaryField>

          <DictionaryField label="中文名 *">
            <input value={value.zh_name} onChange={(event) => update({ zh_name: event.target.value })} />
          </DictionaryField>

          <div className="folio-dictionary-field">
            <FolioSelect label="类型 *" value={value.tag_type} options={TYPE_OPTIONS} onChange={(tagType) => update({ tag_type: tagType })} />
          </div>

          <ChipEditor
            label="别名"
            placeholder="输入别名后回车"
            chips={value.aliases ?? []}
            draft={aliasDraft}
            onDraft={setAliasDraft}
            onAdd={() => addChip("aliases", aliasDraft, () => setAliasDraft(""))}
            onRemove={(item) => removeChip("aliases", item)}
          />
          <ChipEditor
            label="适用范围"
            placeholder="标题、系列名或作品名"
            chips={value.scope ?? []}
            draft={scopeDraft}
            onDraft={setScopeDraft}
            onAdd={() => addChip("scope", scopeDraft, () => setScopeDraft(""))}
            onRemove={(item) => removeChip("scope", item)}
          />

          <DictionaryField label="备注" wide>
            <textarea value={value.note ?? ""} onChange={(event) => update({ note: event.target.value })} rows={5} />
          </DictionaryField>
        </div>

        <div className="folio-dictionary-translate-row">
          <button type="button" onClick={onTranslate} disabled={loading || translating || !value.original_text.trim()}>
            <Languages size={15} />
            {translating ? "翻译中…" : "机翻填入中文名"}
          </button>
          <p>机器结果只填入编辑器，仍需预览并人工确认后保存。</p>
        </div>
        {mtError ? <p className="folio-dictionary-mt-error" role="alert">{mtError}</p> : null}
      </FadeIn>
    </section>
  );
}

function DictionaryField({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <label className={`folio-dictionary-field${wide ? " is-wide" : ""}`}>
      <span>{label}</span>
      {children}
      <i aria-hidden="true" />
    </label>
  );
}

function ChipEditor({
  label,
  placeholder,
  chips,
  draft,
  onDraft,
  onAdd,
  onRemove,
}: {
  label: string;
  placeholder: string;
  chips: string[];
  draft: string;
  onDraft: (value: string) => void;
  onAdd: () => void;
  onRemove: (value: string) => void;
}) {
  const labelId = useId();

  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      onAdd();
    }
  }

  return (
    <div className="folio-dictionary-field is-wide folio-dictionary-chip-field" role="group" aria-labelledby={labelId}>
      <span id={labelId}>{label}</span>
      <div>
        {chips.map((chip) => (
          <button key={chip} type="button" onClick={() => onRemove(chip)} title={`移除 ${chip}`}>
            {chip}
            <X size={12} />
          </button>
        ))}
        <input aria-label={label} value={draft} onChange={(event) => onDraft(event.target.value)} onKeyDown={keyDown} onBlur={onAdd} placeholder={placeholder} />
      </div>
      <i aria-hidden="true" />
    </div>
  );
}
