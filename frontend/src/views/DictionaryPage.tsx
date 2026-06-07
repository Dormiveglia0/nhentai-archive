import { Ban, Check, Download, Eye, Languages, Plus, RefreshCcw, Save, Search, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Cover } from '../components/Cover';
import { PageHeader } from '../components/Shell';
import type { ApiClient, DictionaryEntry, DictionaryTagItem, Work } from '../lib/api';

const tagTypes = ['tag', 'artist', 'group', 'category', 'parody', 'character', 'language', 'other'];
const modes = [
  { id: 'all', label: '全部库内标签' },
  { id: 'unconfigured', label: '未配置词典' },
  { id: 'configured', label: '已配置词典' },
  { id: 'manual', label: '手动词条' }
];

export function DictionaryPage({ api }: { api: ApiClient }) {
  const [mode, setMode] = useState('unconfigured');
  const [type, setType] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('count');
  const [tags, setTags] = useState<DictionaryTagItem[]>([]);
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<DictionaryTagItem | null>(null);
  const [related, setRelated] = useState<Work[]>([]);
  const [drawer, setDrawer] = useState<'tag' | 'manual' | 'bulk' | null>(null);
  const [draftTranslation, setDraftTranslation] = useState('');
  const [manualType, setManualType] = useState('tag');
  const [manualSource, setManualSource] = useState('');
  const [manualTranslated, setManualTranslated] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [bulkType, setBulkType] = useState('tag');
  const [overwrite, setOverwrite] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selectedItems = useMemo(() => tags.filter((tag) => selected.has(tagKey(tag))), [tags, selected]);
  const manualFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((entry) => {
      const typeHit = type === 'all' || entry.source_type === type;
      const queryHit = !q || `${entry.source_type} ${entry.source_text} ${entry.translated_text}`.toLowerCase().includes(q);
      return typeHit && queryHit;
    });
  }, [entries, query, type]);

  async function load() {
    setError('');
    if (mode === 'manual') {
      const next = await api.dictionary();
      setEntries(next);
      setTotal(next.length);
      setTags([]);
      setActive(null);
      setRelated([]);
      return;
    }
    const params: Record<string, string> = { sort };
    if (mode !== 'all') params.state = mode;
    if (type !== 'all') params.type = type;
    if (query.trim()) params.q = query.trim();
    const data = await api.dictionaryTags(params);
    setTags(data.items);
    setTotal(data.total);
    setActive((previous) => {
      if (previous && data.items.some((item) => tagKey(item) === tagKey(previous))) return previous;
      return data.items[0] || null;
    });
    setSelected(new Set());
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : '词典数据加载失败'));
  }, [mode, type, sort]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load().catch((err) => setError(err instanceof Error ? err.message : '词典数据加载失败'));
    }, 260);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!active) {
      setRelated([]);
      return;
    }
    api.dictionaryTagWorks(active.type, active.original)
      .then((data) => setRelated(data.works))
      .catch(() => setRelated(active.example_works || []));
  }, [active?.type, active?.original]);

  function toggle(item: DictionaryTagItem) {
    setSelected((previous) => {
      const next = new Set(previous);
      const key = tagKey(item);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function openTagDrawer(item: DictionaryTagItem) {
    setActive(item);
    setDraftTranslation(item.current_translation || item.machine_suggestion || '');
    setDrawer('tag');
  }

  async function saveTag(item = active, translation = draftTranslation) {
    if (!item) return;
    setBusy('save-tag');
    setError('');
    setMessage('');
    try {
      await api.upsertDictionaryTags([{ type: item.type, original: item.original, translation }]);
      setMessage(`已写入词典：${item.original}`);
      setDrawer(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '写入词典失败');
    } finally {
      setBusy('');
    }
  }

  async function suggest(items: DictionaryTagItem[]) {
    if (!items.length) return;
    setBusy('suggest');
    setError('');
    setMessage('');
    try {
      const result = await api.suggestDictionaryTags(items.map((item) => ({ type: item.type, original: item.original })));
      setMessage(`已生成 ${result.suggestions.length} 条机翻建议${result.errors.length ? `，${result.errors.length} 条失败` : ''}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '机翻建议生成失败');
    } finally {
      setBusy('');
    }
  }

  async function ignore(items: DictionaryTagItem[]) {
    if (!items.length) return;
    setBusy('ignore');
    setError('');
    setMessage('');
    try {
      const result = await api.ignoreDictionaryTags(items.map((item) => ({ type: item.type, original: item.original })));
      setMessage(`已忽略 ${result.ignored} 个 tag`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '忽略失败');
    } finally {
      setBusy('');
    }
  }

  async function saveManual() {
    setBusy('manual');
    setError('');
    try {
      await api.saveDictionary({ source_type: manualType, source_text: manualSource, translated_text: manualTranslated, enabled: true });
      setManualSource('');
      setManualTranslated('');
      setDrawer(null);
      setMessage('手动词条已保存');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setBusy('');
    }
  }

  async function importBulk() {
    setBusy('bulk');
    setError('');
    try {
      const result = await api.importDictionary(bulkText, bulkType, overwrite);
      setMessage(`导入 ${result.imported} 条，跳过 ${result.skipped} 条`);
      setBulkText('');
      setDrawer(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '批量导入失败');
    } finally {
      setBusy('');
    }
  }

  async function remove(entry: DictionaryEntry) {
    if (!window.confirm(`删除词条「${entry.source_text}」？`)) return;
    await api.deleteDictionary(entry.id);
    await load();
  }

  return (
    <section className="page dictionary-workbench">
      <PageHeader
        title="词典管理"
        subtitle="从本地库实际出现的 tag 出发配置译名；机器翻译只生成建议，不自动写入。"
        action={<div className="row-actions"><button className="ghost-button" type="button" onClick={() => api.download('/api/dictionary/export', 'dictionary.json')}><Download size={16} />导出</button><button className="primary-button" type="button" onClick={() => setDrawer('manual')}><Plus size={16} />手动新增</button></div>}
      />
      {message ? <p className="notice success">{message}</p> : null}
      {error ? <p className="notice error">{error}</p> : null}

      <div className="dictionary-layout">
        <aside className="dictionary-sidebar">
          <div className="side-title">治理范围</div>
          {modes.map((item) => (
            <button key={item.id} type="button" className={mode === item.id ? 'active' : ''} onClick={() => setMode(item.id)}>{item.label}</button>
          ))}
          <div className="side-title">类型</div>
          <button type="button" className={type === 'all' ? 'active' : ''} onClick={() => setType('all')}>全部类型</button>
          {tagTypes.map((item) => (
            <button key={item} type="button" className={type === item ? 'active' : ''} onClick={() => setType(item)}>{typeName(item)}</button>
          ))}
        </aside>

        <main className="dictionary-main">
          <div className="dictionary-commandbar">
            <div className="filter-search">
              <Search size={17} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索原文、译文或建议" />
            </div>
            <select value={sort} onChange={(event) => setSort(event.target.value)} disabled={mode === 'manual'}>
              <option value="count">出现次数优先</option>
              <option value="works">关联作品优先</option>
              <option value="name">名称 A-Z</option>
            </select>
            <button className="ghost-button" type="button" onClick={() => load()}><RefreshCcw size={16} />刷新</button>
          </div>

          {mode === 'manual' ? (
            <ManualDictionaryTable entries={manualFiltered} remove={remove} openBulk={() => setDrawer('bulk')} />
          ) : (
            <>
              <div className="bulk-action-bar compact">
                <span>共 {total} 个库内 tag，已选 {selectedItems.length} 个</span>
                <button className="ghost-button" type="button" onClick={() => setSelected(new Set(tags.map(tagKey)))}>选择当前页</button>
                <button className="ghost-button" type="button" onClick={() => setSelected(new Set())}>取消选择</button>
                <button className="ghost-button" type="button" disabled={!selectedItems.length || busy === 'suggest'} onClick={() => suggest(selectedItems)}><Sparkles size={16} />生成机翻</button>
                <button className="ghost-button" type="button" disabled={!selectedItems.length || busy === 'ignore'} onClick={() => ignore(selectedItems)}><Ban size={16} />忽略</button>
              </div>

              <div className="dictionary-table">
                <div className="dictionary-table-head">
                  <span></span><span>原始项</span><span>出现</span><span>关联作品</span><span>当前译名</span><span>机翻建议</span><span>状态</span><span>操作</span>
                </div>
                {tags.map((item) => (
                  <div className={`dictionary-row ${active && tagKey(active) === tagKey(item) ? 'active' : ''}`} key={tagKey(item)} role="button" tabIndex={0} onClick={() => setActive(item)} onKeyDown={(event) => { if (event.key === 'Enter') setActive(item); }}>
                    <span onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={selected.has(tagKey(item))} onChange={() => toggle(item)} /></span>
                    <span className="tag-name-cell"><em>{typeName(item.type)}</em><strong>{item.original}</strong></span>
                    <span>{item.count}</span>
                    <span>{item.work_count}</span>
                    <span className="truncate">{item.current_translation || '-'}</span>
                    <span className="truncate">{item.machine_suggestion || '-'}</span>
                    <span><StateChip state={item.state} /></span>
                    <span className="row-actions" onClick={(event) => event.stopPropagation()}>
                      {item.machine_suggestion ? <button className="icon-button" type="button" title="采用机翻建议" onClick={() => saveTag(item, item.machine_suggestion)}><Check size={15} /></button> : <button className="icon-button" type="button" title="生成机翻建议" onClick={() => suggest([item])}><Sparkles size={15} /></button>}
                      <button className="icon-button" type="button" title="编辑译名" onClick={() => openTagDrawer(item)}><Languages size={15} /></button>
                    </span>
                  </div>
                ))}
                {!tags.length ? <p className="empty">当前筛选下没有库内 tag。导入或扫描 CBZ 后会自动聚合。</p> : null}
              </div>
            </>
          )}
        </main>

        {mode !== 'manual' ? <TagInspector item={active} works={related} openWorkHint={() => undefined} onSuggest={() => active && suggest([active])} onEdit={() => active && openTagDrawer(active)} onIgnore={() => active && ignore([active])} /> : null}
      </div>

      {drawer ? (
        <div className="drawer-backdrop" onClick={() => setDrawer(null)}>
          <aside className="side-drawer dictionary-drawer" onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <h2>{drawerTitle(drawer)}</h2>
                <p>{drawer === 'tag' ? '译名会写入词典，并同步到匹配的库内 tag。' : drawer === 'bulk' ? '每行使用 original=translation。' : '新增不依赖库内出现次数的词条。'}</p>
              </div>
              <button className="icon-button" type="button" onClick={() => setDrawer(null)}><X size={18} /></button>
            </header>
            {drawer === 'tag' && active ? (
              <div className="drawer-form">
                <label>类型<input value={typeName(active.type)} readOnly /></label>
                <label>原始项<input value={active.original} readOnly /></label>
                {active.machine_suggestion ? <label>机翻建议<input value={active.machine_suggestion} readOnly /></label> : null}
                <label>最终写入词典<input value={draftTranslation} onChange={(event) => setDraftTranslation(event.target.value)} placeholder="输入中文译名" autoFocus /></label>
                <button className="primary-button" type="button" disabled={busy === 'save-tag'} onClick={() => saveTag()}><Save size={16} />保存到词典</button>
              </div>
            ) : null}
            {drawer === 'manual' ? (
              <div className="drawer-form">
                <label>类型<select value={manualType} onChange={(event) => setManualType(event.target.value)}>{tagTypes.map((item) => <option key={item} value={item}>{typeName(item)}</option>)}</select></label>
                <label>原文<input value={manualSource} onChange={(event) => setManualSource(event.target.value)} placeholder="original" /></label>
                <label>译名<input value={manualTranslated} onChange={(event) => setManualTranslated(event.target.value)} placeholder="中文译名" /></label>
                <button className="primary-button" type="button" disabled={busy === 'manual'} onClick={saveManual}><Save size={16} />保存</button>
              </div>
            ) : null}
            {drawer === 'bulk' ? (
              <div className="drawer-form">
                <label>类型<select value={bulkType} onChange={(event) => setBulkType(event.target.value)}>{tagTypes.map((item) => <option key={item} value={item}>{typeName(item)}</option>)}</select></label>
                <label>内容<textarea value={bulkText} onChange={(event) => setBulkText(event.target.value)} placeholder={'original=translation\nschool uniform=校服'} /></label>
                <label className="checkbox-line"><input type="checkbox" checked={overwrite} onChange={(event) => setOverwrite(event.target.checked)} />覆盖已有冲突词条</label>
                <button className="primary-button" type="button" disabled={busy === 'bulk'} onClick={importBulk}><Upload size={16} />确认导入</button>
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}
    </section>
  );
}

function ManualDictionaryTable({ entries, remove, openBulk }: { entries: DictionaryEntry[]; remove: (entry: DictionaryEntry) => void; openBulk: () => void }) {
  return (
    <>
      <div className="bulk-action-bar compact">
        <span>手动词条 {entries.length} 条</span>
        <button className="ghost-button" type="button" onClick={openBulk}><Upload size={16} />批量导入</button>
      </div>
      <div className="dictionary-table manual">
        <div className="dictionary-table-head manual"><span>类型</span><span>原文</span><span>译名</span><span>状态</span><span>操作</span></div>
        {entries.map((entry) => (
          <div className="dictionary-row manual" key={entry.id}>
            <span>{typeName(entry.source_type)}</span>
            <strong>{entry.source_text}</strong>
            <span>{entry.translated_text}</span>
            <span><span className={`status-chip ${entry.enabled ? 'ready' : 'failed'}`}>{entry.enabled ? '启用' : '停用'}</span></span>
            <span><button className="icon-button danger" type="button" onClick={() => remove(entry)}><Trash2 size={15} /></button></span>
          </div>
        ))}
        {!entries.length ? <p className="empty">暂无手动词条</p> : null}
      </div>
    </>
  );
}

function TagInspector({ item, works, onSuggest, onEdit, onIgnore }: { item: DictionaryTagItem | null; works: Work[]; openWorkHint: () => void; onSuggest: () => void; onEdit: () => void; onIgnore: () => void }) {
  if (!item) {
    return <aside className="dictionary-inspector"><p className="empty">选择一个 tag 查看关联作品和建议。</p></aside>;
  }
  return (
    <aside className="dictionary-inspector">
      <header>
        <span className="type-pill">{typeName(item.type)}</span>
        <h2>{item.original}</h2>
        <StateChip state={item.state} />
      </header>
      <div className="inspector-stats">
        <span><strong>{item.count}</strong>出现次数</span>
        <span><strong>{item.work_count}</strong>关联作品</span>
      </div>
      <dl className="translation-stack">
        <div><dt>当前词典译名</dt><dd>{item.current_translation || '未配置'}</dd></div>
        <div><dt>机翻建议</dt><dd>{item.machine_suggestion || '尚未生成'}</dd></div>
        <div><dt>最终候选</dt><dd>{item.final_value || item.original}</dd></div>
      </dl>
      <div className="split-actions vertical">
        <button className="primary-button" type="button" onClick={onEdit}><Languages size={16} />编辑译名</button>
        <button className="ghost-button" type="button" onClick={onSuggest}><Sparkles size={16} />生成机翻建议</button>
        <button className="ghost-button" type="button" onClick={onIgnore}><Ban size={16} />标记忽略</button>
      </div>
      <section className="related-works">
        <h3>关联作品</h3>
        {works.slice(0, 8).map((work) => (
          <div className="related-work" key={work.id}>
            <Cover src={work.cover_url} title={work.display_title} token={localStorage.getItem('token')} />
            <span><strong>{work.display_title}</strong><small>{work.page_count || '?'} 页 · {work.tag_count || 0} tag</small></span>
          </div>
        ))}
        {!works.length ? <p className="empty">暂无关联作品</p> : null}
      </section>
    </aside>
  );
}

function StateChip({ state }: { state: string }) {
  const map: Record<string, string> = { configured: '已配置', unconfigured: '未配置', ignored: '已忽略' };
  const tone = state === 'configured' ? 'ready' : state === 'ignored' ? 'muted' : 'queued';
  return <span className={`status-chip ${tone}`}>{map[state] || state}</span>;
}

function tagKey(item: DictionaryTagItem) {
  return `${item.type}\u0000${item.original}`;
}

function typeName(value: string) {
  const map: Record<string, string> = { tag: '内容', title: '标题', artist: '作者', group: '社团', parody: '原作', character: '角色', language: '语言', category: '分类', other: '其他' };
  return map[value] || value;
}

function drawerTitle(drawer: 'tag' | 'manual' | 'bulk') {
  if (drawer === 'tag') return '配置库内 tag';
  if (drawer === 'bulk') return '批量导入词典';
  return '新增手动词条';
}
