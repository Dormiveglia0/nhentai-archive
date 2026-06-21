import { Ban, Languages, Plus, RotateCcw, Save, SearchCheck, Trash2 } from "lucide-react";
import { KeyboardEvent, useState } from "react";

import { api, DictionaryApplyPayload } from "../../lib/api";
import { FadeIn } from "../../lib/motion";

type Props = {
  value: DictionaryApplyPayload;
  dictionaryId?: number | null;
  loading: boolean;
  onChange: (value: DictionaryApplyPayload) => void;
  onNew: () => void;
  onPreview: () => void;
  onApply: () => void;
  onIgnore: () => void;
  onReview: () => void;
  onDelete: () => void;
};

const TYPES = [
  ["tag", "标签"],
  ["artist", "作者"],
  ["group", "社团"],
  ["character", "角色"],
  ["parody", "原作"],
  ["language", "语言"],
  ["category", "分类"],
] as const;

export function DictionaryEditor({ value, dictionaryId, loading, onChange, onNew, onPreview, onApply, onIgnore, onReview, onDelete }: Props) {
  const [aliasDraft, setAliasDraft] = useState("");
  const [scopeDraft, setScopeDraft] = useState("");
  const editorKey = String(dictionaryId ?? value.remote_tag_id ?? "new");

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

  const [translating, setTranslating] = useState(false);
  const [mtError, setMtError] = useState<string | null>(null);

  async function machineTranslate() {
    const text = value.original_text.trim();
    if (!text) return;
    setTranslating(true);
    setMtError(null);
    try {
      const result = await api.dictionaryTranslate(text);
      if (result.translation) update({ zh_name: result.translation });
      else setMtError("机翻返回为空");
    } catch (exc) {
      setMtError(exc instanceof Error ? exc.message : String(exc));
    } finally {
      setTranslating(false);
    }
  }

  return (
    <section className="dictionary-pane dictionary-editor">
      <header className="dictionary-pane-head">
        <div>
          <h2>术语编辑器</h2>
          <span>{value.remote_tag_id ? `远端 tag #${value.remote_tag_id}` : "本地自定义词条"}</span>
        </div>
        <button type="button" className="head-action" onClick={onNew}>
          <Plus size={15} />
          新建本地词条
        </button>
      </header>

      <FadeIn key={editorKey} className="dictionary-editor-motion" y={8}>
        <div className="dictionary-form">
          <label className="wide">
            <span>原文 *</span>
            <input value={value.original_text} onChange={(event) => update({ original_text: event.target.value })} />
          </label>
          <label>
            <span>中文名 *</span>
            <input value={value.zh_name} onChange={(event) => update({ zh_name: event.target.value })} />
          </label>
          <label>
            <span>类型 *</span>
            <select value={value.tag_type} onChange={(event) => update({ tag_type: event.target.value })}>
              {TYPES.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>

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
            placeholder="标题、系列名、作品名"
            chips={value.scope ?? []}
            draft={scopeDraft}
            onDraft={setScopeDraft}
            onAdd={() => addChip("scope", scopeDraft, () => setScopeDraft(""))}
            onRemove={(item) => removeChip("scope", item)}
          />

          <label className="wide">
            <span>备注</span>
            <textarea value={value.note ?? ""} onChange={(event) => update({ note: event.target.value })} rows={5} />
          </label>
        </div>

        {mtError ? <p className="dictionary-mt-error">{mtError}</p> : null}

        <footer className="dictionary-actions">
          <button
            type="button"
            onClick={() => void machineTranslate()}
            disabled={loading || translating || !value.original_text.trim()}
            title="用设置中的机翻服务翻译原文并填入中文名"
          >
            <Languages size={16} />
            {translating ? "翻译中…" : "机翻中文名"}
          </button>
          <button type="button" onClick={onPreview} disabled={loading || !value.original_text || !value.zh_name}>
            <SearchCheck size={16} />
            预览影响
          </button>
          <button type="button" className="primary" onClick={onApply} disabled={loading || !value.original_text || !value.zh_name}>
            <Save size={16} />
            {dictionaryId ? "保存修改" : "写入词典"}
          </button>
          <button
            type="button"
            onClick={onIgnore}
            disabled={loading || !value.original_text.trim() || value.ignored}
            title="保留原文、不翻译；适用于无需中文名的标签"
          >
            <Ban size={16} />
            忽略
          </button>
          <button type="button" onClick={onReview} disabled={loading || !dictionaryId}>
            <RotateCcw size={16} />
            加入复核
          </button>
          <button type="button" className="danger" onClick={onDelete} disabled={loading || !dictionaryId}>
            <Trash2 size={16} />
            删除
          </button>
        </footer>
      </FadeIn>
    </section>
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
  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      onAdd();
    }
  }

  return (
    <label className="wide chip-field">
      <span>{label}</span>
      <div>
        {chips.map((chip) => (
          <button key={chip} type="button" onClick={() => onRemove(chip)}>
            {chip}
            <b>×</b>
          </button>
        ))}
        <input value={draft} onChange={(event) => onDraft(event.target.value)} onKeyDown={keyDown} onBlur={onAdd} placeholder={placeholder} />
      </div>
    </label>
  );
}
