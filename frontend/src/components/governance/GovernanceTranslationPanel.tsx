import { Check, Languages, Sparkles, X } from "lucide-react";
import { useState } from "react";

import type { GovernanceTranslateSuggestion } from "../../lib/api";
import { FadeIn, Stagger, StaggerItem } from "../../lib/motion";

const TRANSLATABLE_FIELDS = [
  { id: "title", label: "标题" },
  { id: "title_japanese", label: "副标题" },
  { id: "summary", label: "简介" },
] as const;

type Props = {
  suggestions: GovernanceTranslateSuggestion[];
  translating: boolean;
  onGenerate: (fields: string[]) => void;
  onAccept: (suggestion: GovernanceTranslateSuggestion) => void;
  onAcceptAll: () => void;
  onDismiss: (field: string) => void;
};

export function GovernanceTranslationPanel({
  suggestions,
  translating,
  onGenerate,
  onAccept,
  onAcceptAll,
  onDismiss,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(TRANSLATABLE_FIELDS.map((field) => field.id)));

  const toggleField = (field: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  };

  return (
    <section className="folio-governance-translation" aria-labelledby="governance-translation-title">
      <div className="folio-governance-translation-intro">
        <div className="folio-governance-translation-mark" aria-hidden="true"><Languages size={18} /></div>
        <div>
          <h3 id="governance-translation-title">中文建议</h3>
          <p>只为标题、副标题和简介生成候选译文；不会自动采纳，也不会自动写库。</p>
          <small>作者、社团与标签在词典区治理；语言、页数和日期属于结构化字段，不参与翻译。</small>
        </div>
      </div>
      <div className="folio-governance-translation-controls">
        <div className="folio-governance-translation-fields" role="group" aria-label="选择生成中文建议的字段">
          {TRANSLATABLE_FIELDS.map((field) => (
            <button
              key={field.id}
              type="button"
              className={selected.has(field.id) ? "is-active" : ""}
              aria-pressed={selected.has(field.id)}
              onClick={() => toggleField(field.id)}
            >
              <span>{field.label}</span>
              {selected.has(field.id) ? <Check size={13} /> : null}
            </button>
          ))}
        </div>
        <button
          className="folio-governance-translation-generate"
          type="button"
          disabled={translating || !selected.size}
          onClick={() => onGenerate([...selected])}
        >
          <Sparkles size={15} />
          {translating ? "正在生成…" : "生成建议"}
        </button>
      </div>

      {suggestions.length ? (
        <FadeIn className="folio-governance-translation-results" y={8}>
          <header>
            <div><strong>{suggestions.length} 条建议待决定</strong><span>采纳后只会进入编辑状态</span></div>
            <button type="button" onClick={onAcceptAll}>全部采纳</button>
          </header>
          <Stagger className="folio-governance-translation-list">
            {suggestions.map((suggestion) => (
              <StaggerItem key={suggestion.field}>
                <article className="folio-governance-translation-card">
                  <strong>{suggestion.label}</strong>
                  <div>
                    <span>原文</span>
                    <p>{suggestion.original}</p>
                  </div>
                  <div className="is-suggestion">
                    <span>建议</span>
                    <p>{suggestion.suggestion}</p>
                  </div>
                  <footer>
                    <button type="button" onClick={() => onAccept(suggestion)}><Check size={13} />采纳</button>
                    <button type="button" onClick={() => onDismiss(suggestion.field)}><X size={13} />忽略</button>
                  </footer>
                </article>
              </StaggerItem>
            ))}
          </Stagger>
        </FadeIn>
      ) : null}
    </section>
  );
}
