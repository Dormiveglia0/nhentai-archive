import { Ban, Check, Languages, Plus, RefreshCcw, Save, Search, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Cover } from '../components/Cover';
import { PageHero, StatStrip } from '../components/Shell';
import type { ApiClient, DictionaryTagItem, Work } from '../lib/api';

const modes = [
  ['unconfigured', '未配置'],
  ['configured', '已配置'],
  ['ignored', '已忽略'],
  ['all', '全部']
] as const;

export function DictionaryPage({ api }: { api: ApiClient }) {
  const [mode, setMode] = useState('unconfigured');
  const [type, setType] = useState('all');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<DictionaryTagItem[]>([]);
  const [total, setTotal] = useState(0);
  const [active, setActive] = useState<DictionaryTagItem | null>(null);
  const [related, setRelated] = useState<Work[]>([]);
  const [translation, setTranslation] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const selectedItems = useMemo(() => items.filter((item) => selected.has(keyOf(item))), [items, selected]);

  async function load() {
    setError('');
    const params: Record<string, string> = {};
    if (mode !== 'all') params.state = mode;
    if (type !== 'all') params.type = type;
    if (query.trim()) params.q = query.trim();
    const data = await api.dictionaryTags(params);
    setItems(data.items || []);
    setTotal(data.total || 0);
    const nextActive = data.items?.[0] || null;
    setActive(nextActive);
    setTranslation(nextActive?.current_translation || nextActive?.machine_suggestion || '');
    setSelected(new Set());
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : '词典加载失败'));
  }, [mode, type]);

  useEffect(() => {
    const timer = window.setTimeout(() => load().catch(() => undefined), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!active) {
      setRelated([]);
      return;
    }
    setTranslation(active.current_translation || active.machine_suggestion || '');
    api.dictionaryTagWorks(active.type, active.original)
      .then((data) => setRelated(data.works || []))
      .catch(() => setRelated(active.example_works || []));
  }, [active?.type, active?.original]);

  async function run(label: string, action: () => Promise<void>) {
    setBusy(label);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(label);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : `${label}失败`);
    } finally {
      setBusy('');
    }
  }

  function toggle(item: DictionaryTagItem) {
    setSelected((previous) => {
      const next = new Set(previous);
      const key = keyOf(item);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <section className="page dictionary-page">
      <PageHero title="词典治理" seal="词典" subtitle="统一术语规范，提升检索准确度与标签一致性。" />
      <StatStrip items={[
        { label: '候选术语', value: total, hint: modeName(mode), icon: <Languages size={21} /> },
        { label: '已选择', value: selected.size, hint: '批量处理', icon: <Check size={21} />, tone: selected.size ? 'red' : undefined },
        { label: '关联作品', value: related.length, hint: active?.original || '未选择', icon: <Search size={21} /> },
        { label: '机翻建议', value: items.filter((item) => item.machine_suggestion).length, hint: '当前页', icon: <Sparkles size={21} />, tone: 'amber' }
      ]} />
      {notice ? <p className="notice success">{notice}</p> : null}
      {error ? <p className="notice error">{error}</p> : null}

      <div className="dictionary-layout">
        <aside className="paper-panel dictionary-nav">
          <h2>治理范围</h2>
          {modes.map(([id, label]) => <button key={id} className={mode === id ? 'active' : ''} type="button" onClick={() => setMode(id)}>{label}</button>)}
          <h2>类型</h2>
          {['all', 'tag', 'artist', 'group', 'category', 'parody', 'character', 'language'].map((item) => (
            <button key={item} className={type === item ? 'active' : ''} type="button" onClick={() => setType(item)}>{typeName(item)}</button>
          ))}
        </aside>

        <main className="paper-panel dictionary-pool">
          <header className="panel-head">
            <label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索原文、译文或建议" /></label>
            <div className="row-actions">
              <button type="button" className="ghost-button" onClick={() => setSelected(new Set(items.map(keyOf)))}>全选</button>
              <button type="button" className="ghost-button" onClick={() => run('已生成机翻建议', async () => { await api.suggestDictionaryTags(selectedItems.map((item) => ({ type: item.type, original: item.original }))); })} disabled={!selectedItems.length || Boolean(busy)}><Sparkles size={16} />机翻</button>
              <button type="button" className="ghost-button" onClick={() => run('已忽略术语', async () => { await api.ignoreDictionaryTags(selectedItems.map((item) => ({ type: item.type, original: item.original }))); })} disabled={!selectedItems.length}><Ban size={16} />忽略</button>
            </div>
          </header>
          <div className="archive-table">
            <div className="table-head"><span></span><span>原文</span><span>影响</span><span>当前译名</span><span>机翻建议</span><span>状态</span></div>
            {items.map((item) => (
              <button type="button" className={`table-row ${active && keyOf(active) === keyOf(item) ? 'active' : ''}`} key={keyOf(item)} onClick={() => setActive(item)}>
                <span><input type="checkbox" checked={selected.has(keyOf(item))} onChange={(event) => { event.stopPropagation(); toggle(item); }} /></span>
                <strong>{item.original}<small>{typeName(item.type)}</small></strong>
                <span>{item.work_count} 部 / {item.count} 次</span>
                <span>{item.current_translation || '-'}</span>
                <span>{item.machine_suggestion || '-'}</span>
                <span>{stateName(item.state)}</span>
              </button>
            ))}
          </div>
        </main>

        <aside className="paper-panel inspector-panel sticky">
          <h2>术语编辑器</h2>
          {active ? (
            <>
              <label><span>原文</span><input value={active.original} readOnly /></label>
              <label><span>中文名</span><input value={translation} onChange={(event) => setTranslation(event.target.value)} /></label>
              <button type="button" className="primary-button full" onClick={() => run('已写入词典', async () => { await api.upsertDictionaryTags([{ type: active.type, original: active.original, translation }]); })}><Save size={16} />写入词典</button>
              <h3>关联作品</h3>
              <div className="related-row">
                {related.slice(0, 8).map((work) => <Cover key={work.id} src={work.cover_url} title={work.display_title} token={api.token} />)}
              </div>
            </>
          ) : <p className="empty-panel">选择一个术语开始编辑。</p>}
          <button type="button" className="ghost-button full"><Plus size={16} />手动词条</button>
        </aside>
      </div>
    </section>
  );
}

function keyOf(item: DictionaryTagItem) {
  return `${item.type}:${item.original}`;
}

function typeName(type: string) {
  const map: Record<string, string> = { all: '全部类型', tag: '标签', artist: '作者', group: '社团', category: '分类', parody: '原作', character: '角色', language: '语言', other: '其他' };
  return map[type] || type;
}

function modeName(mode: string) {
  const map: Record<string, string> = { all: '全部', unconfigured: '未配置', configured: '已配置', ignored: '已忽略' };
  return map[mode] || mode;
}

function stateName(state: string) {
  const map: Record<string, string> = { configured: '已配置', unconfigured: '待处理', ignored: '已忽略' };
  return map[state] || state || '未知';
}
