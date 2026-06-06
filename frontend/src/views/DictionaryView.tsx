import { Check, Lightbulb, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ApiClient, AppSettings, DictionaryEntry, Suggestion } from '../lib/api';

type Props = {
  api: ApiClient;
};

export function DictionaryView({ api }: Props) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [sourceType, setSourceType] = useState('tag');
  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    setSettings(await api.request<AppSettings>('/api/settings'));
    setEntries(await api.request<DictionaryEntry[]>('/api/dictionary'));
    setSuggestions(await api.request<Suggestion[]>('/api/suggestions'));
  }

  useEffect(() => {
    load();
  }, []);

  async function saveSettings(next: Partial<AppSettings>) {
    const updated = await api.request<AppSettings>('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify(next)
    });
    setSettings(updated);
  }

  async function addEntry() {
    await api.request('/api/dictionary', {
      method: 'POST',
      body: JSON.stringify({ source_type: sourceType, source_text: sourceText, translated_text: translatedText, enabled: true })
    });
    setSourceText('');
    setTranslatedText('');
    await load();
  }

  async function suggest() {
    setMessage('');
    try {
      await api.request('/api/suggestions', {
        method: 'POST',
        body: JSON.stringify({ provider: settings?.translation_provider, items: [{ source_type: sourceType, source_text: sourceText }] })
      });
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '生成建议失败');
    }
  }

  async function accept(id: number) {
    await api.request(`/api/suggestions/${id}/accept`, { method: 'POST' });
    await load();
  }

  async function remove(id: number) {
    await api.request(`/api/dictionary/${id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <section className="view">
      <header className="view-header">
        <h1>词典与翻译</h1>
      </header>
      <div className="settings-strip">
        <label className="checkbox-line">
          <input
            type="checkbox"
            checked={settings?.translate_tags || false}
            onChange={(event) => saveSettings({ translate_tags: event.target.checked })}
          />
          <span>写入翻译 tag</span>
        </label>
        <label className="checkbox-line">
          <input
            type="checkbox"
            checked={settings?.translate_titles || false}
            onChange={(event) => saveSettings({ translate_titles: event.target.checked })}
          />
          <span>写入翻译标题</span>
        </label>
        <select
          value={settings?.translation_provider || 'none'}
          onChange={(event) => saveSettings({ translation_provider: event.target.value as AppSettings['translation_provider'] })}
        >
          <option value="none">无机器翻译</option>
          <option value="deepl">DeepL</option>
          <option value="google">Google</option>
        </select>
      </div>
      <div className="dictionary-grid">
        <div className="panel">
          <h2>添加词条</h2>
          <div className="inline-form">
            <select value={sourceType} onChange={(event) => setSourceType(event.target.value)}>
              <option value="tag">tag</option>
              <option value="title">title</option>
              <option value="artist">artist</option>
              <option value="group">group</option>
              <option value="character">character</option>
              <option value="parody">parody</option>
              <option value="language">language</option>
              <option value="category">category</option>
            </select>
            <input value={sourceText} onChange={(event) => setSourceText(event.target.value)} placeholder="原文" />
            <input value={translatedText} onChange={(event) => setTranslatedText(event.target.value)} placeholder="译文" />
          </div>
          <div className="actions">
            <button className="primary-button" onClick={addEntry}>
              <Plus size={18} />
              <span>保存</span>
            </button>
            <button className="ghost-button" onClick={suggest}>
              <Lightbulb size={18} />
              <span>建议</span>
            </button>
          </div>
          {message ? <p className="status-message">{message}</p> : null}
        </div>
        <div className="panel">
          <h2>机器建议</h2>
          <div className="compact-list">
            {suggestions.map((item) => (
              <div className="compact-row" key={item.id}>
                <span>{item.source_type}</span>
                <strong>{item.source_text}</strong>
                <span>{item.suggested_text}</span>
                <button className="icon-button" onClick={() => accept(item.id)} title="接受建议">
                  <Check size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="table">
        <div className="table-head dict-grid">
          <span>类型</span>
          <span>原文</span>
          <span>译文</span>
          <span>操作</span>
        </div>
        {entries.map((entry) => (
          <div className="table-row dict-grid" key={entry.id}>
            <span>{entry.source_type}</span>
            <strong>{entry.source_text}</strong>
            <span>{entry.translated_text}</span>
            <button className="icon-button danger" onClick={() => remove(entry.id)} title="删除词条">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
