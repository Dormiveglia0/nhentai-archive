import { useEffect, useId, useState } from "react";
import { api, type DictionaryCandidate } from "../../lib/api";

const separator = /\s+\/\s+|[,，;；\n]/;
const languageNames: Record<string, string> = { chinese: '中文', japanese: '日文', english: '英文' };
const languageAliases: Record<string, string> = { zh: 'chinese', 'zh-cn': 'chinese', 'zh-tw': 'chinese', '中文': 'chinese', ja: 'japanese', jp: 'japanese', '日文': 'japanese', '日语': 'japanese', en: 'english', '英文': 'english', '英语': 'english' };

export function DictionaryFieldInput({ kind, value, onChange, label }: { kind: string; value: string; onChange: (value: string) => void; label: string }) {
  const [items, setItems] = useState<DictionaryCandidate[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [error, setError] = useState('');
  const id = useId();
  const token = value.split(separator).slice(-1)[0]?.trim() ?? '';
  useEffect(() => {
    if (!token) { setItems([]); return; }
    let alive = true;
    const timer = window.setTimeout(() => {
      api.dictionaryCandidates({ q: token, type: kind, limit: 12 }).then(result => {
        if (alive) { setItems(result.result); setActive(0); setError(''); }
      }).catch(() => { if (alive) { setItems([]); setError('词典建议暂时不可用，可继续手动填写'); } });
    }, 180);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [token, kind]);
  function pick(item: DictionaryCandidate) {
    const parts = value.split(separator).map(part => part.trim());
    parts[parts.length - 1] = item.name || item.slug || item.display || '';
    onChange([...new Set(parts.filter(Boolean))].join(' / '));
    setOpen(false);
  }
  return <div className="folio-governance-suggest">
    <textarea className="folio-governance-field-input" aria-label={label} value={value} rows={2} role="combobox" aria-autocomplete="list" aria-expanded={open && items.length > 0} aria-controls={id} aria-activedescendant={open && items[active] ? `${id}-${active}` : undefined}
      onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onChange={event => { onChange(event.target.value); setItems([]); setActive(0); setOpen(true); }}
      onKeyDown={event => {
        if (event.key === 'Escape') { setOpen(false); return; }
        if (!open || !items.length) return;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setActive(index => (index + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length); }
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); pick(items[active]); }
      }} />
    {open && items.length ? <div className="folio-governance-suggestions" id={id} role="listbox" aria-label="词典建议">{items.map((item, index) => <button type="button" id={`${id}-${index}`} key={`${item.dictionary_id}-${item.id}-${index}`} role="option" aria-selected={active === index} onPointerDown={event => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => pick(item)}><strong>{item.display || item.name}</strong>{item.display !== item.name ? <span>{item.name}</span> : null}</button>)}</div> : null}
    {error ? <small role="status">{error}</small> : null}
  </div>;
}

export function LanguageFieldInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [known, setKnown] = useState<DictionaryCandidate[]>([]);
  useEffect(() => {
    let alive = true;
    api.dictionaryCandidates({ type: 'language', limit: 50 }).then(result => { if (alive) setKnown(result.result); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const selected = [...new Set(value.split(separator).map(value => value.trim().toLowerCase()).filter(value => value && !value.startsWith('translat')).map(value => languageAliases[value] || value))];
  const options = new Map(Object.entries(languageNames));
  known.forEach(item => { const name = item.name || item.slug; if (name && !item.ignored && !name.toLowerCase().startsWith('translat')) options.set(languageAliases[name.toLowerCase()] || name.toLowerCase(), item.display || name); });
  selected.forEach(value => { if (!options.has(value)) options.set(value, value); });
  return <div className="folio-governance-language-options" role="group" aria-label="本地最终值：语言（可多选）">{[...options].map(([key, label]) => <button key={key} type="button" aria-pressed={selected.includes(key)} onClick={() => onChange((selected.includes(key) ? selected.filter(value => value !== key) : [...selected, key]).join(' / '))}>{label}</button>)}</div>;
}
