import { Plus, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, type LibrarySearchParams, type LibrarySearchResult, type LibraryTag, type LibraryWork, type LibraryWorkGroup, type SavedWorkGroup } from '../../lib/api';
import { useNativeDialog } from '../../lib/useNativeDialog';
import { IconPager } from '../folio/ui/IconPager';
import { WorkCard } from './WorkCard';
import { workTitle } from './libraryHelpers';
import './WorkGroupDialog.css';

type Props = {
  group?: LibraryWorkGroup; createIds?: number[]; filters: LibrarySearchParams; blurCovers: boolean;
  onClose: () => void; onChanged: () => void; onInspect: (work: LibraryWork) => void; onPickTag: (tag: LibraryTag) => void;
};

export function WorkGroupDialog({ group, createIds, filters, blurCovers, onClose, onChanged, onInspect, onPickTag }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(group?.name ?? '');
  const nameDirty = useRef(false);
  const [saved, setSaved] = useState<SavedWorkGroup | null>(null);
  const [data, setData] = useState<LibrarySearchResult | null>(null);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(Boolean(group));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [searchPage, setSearchPage] = useState(1);
  const [searchData, setSearchData] = useState<LibrarySearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [addIds, setAddIds] = useState<Set<number>>(new Set());
  const [confirmDissolve, setConfirmDissolve] = useState(false);
  const dismiss = useNativeDialog(dialog, onClose, true, busy);
  const filtersKey = JSON.stringify(filters);
  useEffect(() => {
    const close = () => { if (!/^#library(?:\?|$)/.test(location.hash)) { dialog.current?.close(); onClose(); } };
    window.addEventListener('hashchange', close);
    return () => window.removeEventListener('hashchange', close);
  }, [onClose]);
  useEffect(() => {
    if (!group) return;
    let alive = true;
    setLoading(true); setError('');
    const request: Promise<LibrarySearchResult & { group?: SavedWorkGroup }> = group.kind === 'manual' && group.id
      ? api.workGroup(group.id, page)
      : api.librarySearch({ ...JSON.parse(filtersKey), group_by: 'author', group_key: group.key, page, per_page: 24 });
    request.then(result => {
      if (!alive) return;
      setData(result);
      if (result.group) { setSaved(result.group); if (!nameDirty.current) setName(result.group.name); }
      if (page > result.num_pages) setPage(result.num_pages);
    }).catch(reason => { if (alive) setError(reason.message); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [group?.key, page, revision, filtersKey]);
  useEffect(() => {
    if (!adding) return;
    let alive = true;
    setSearching(true);
    api.librarySearch({ q: search, page: searchPage, per_page: 12, sort: 'title', group_by: 'none' })
      .then(result => { if (alive) setSearchData(result); }).catch(reason => { if (alive) setError(reason.message); })
      .finally(() => { if (alive) setSearching(false); });
    return () => { alive = false; };
  }, [adding, search, searchPage]);

  async function create() {
    if (!createIds) return;
    setBusy(true); setError('');
    try { await api.createWorkGroup(name.trim(), createIds); onChanged(); onClose(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  }
  async function update(patch: { name?: string; add_ids?: number[]; remove_ids?: number[] }) {
    if (!saved) return;
    setBusy(true); setError('');
    try {
      const result = await api.updateWorkGroup(saved.id, { version: saved.version, ...patch });
      if (patch.name !== undefined) { nameDirty.current = false; setName(result.name); }
      setSaved(result); setAddIds(new Set()); setRevision(value => value + 1); onChanged();
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  }
  async function dissolve() {
    if (!saved) return;
    setBusy(true); setError('');
    try { await api.dissolveWorkGroup(saved.id, saved.version); onChanged(); onClose(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  }
  async function favorite(work: LibraryWork) {
    try { await api.setWorkFavorite(work.id, !work.favorite); setRevision(value => value + 1); onChanged(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  }
  const inspect = (work: LibraryWork) => { onClose(); onInspect(work); };
  return createPortal(<dialog ref={dialog} className={`folio-work-group-dialog${createIds ? ' is-create' : ''}`} aria-label={createIds ? '创建作品分组' : '组内作品'} aria-busy={busy || loading}>
    <header><div><span>{createIds ? '创建分组' : group?.kind === 'author' ? '同作者作品' : '作品分组'}</span><h2>{createIds ? '将作品收进一个分组' : saved?.name ?? group?.name}</h2></div><button type="button" aria-label="关闭分组" disabled={busy} onClick={dismiss}><X size={20} /></button></header>
    <div className="folio-work-group-body">
      {error ? <p className="folio-media-error" role="alert">{error}{group ? <button type="button" className="folio-line-button" disabled={busy} onClick={() => setRevision(value => value + 1)}>刷新分组</button> : null}</p> : null}
      {createIds || saved ? <form className="folio-work-group-name" onSubmit={event => { event.preventDefault(); void (createIds ? create() : update({ name: name.trim() })); }}>
        <label><span>分组名称</span><input data-dialog-focus aria-label="分组名称" value={name} maxLength={120} required disabled={busy} onChange={event => { nameDirty.current = true; setName(event.target.value); }} /></label>
        <button type="submit" className="folio-line-button" disabled={busy || !name.trim() || (createIds && createIds.length > 5000) || (!createIds && name.trim() === saved?.name)}>{createIds ? '创建分组' : '保存名称'}</button>
      </form> : null}
      {createIds ? <p className="folio-media-hint">已选 {createIds.length} 部作品。{createIds.length > 5000 ? '一次最多添加5000部，请减少选择。' : '分组后仍分别保留文件、元数据和阅读记录。'}</p> : <>
        <div className="folio-work-group-tools"><span>{loading ? '读取中…' : `${data?.total ?? 0} 部作品`}</span>{saved ? <button type="button" className="folio-line-button" disabled={busy} aria-expanded={adding} onClick={() => setAdding(value => !value)}>{adding ? '取消添加' : <><Plus size={15} />添加作品</>}</button> : null}</div>
        {adding && saved ? <section className="folio-work-group-add" aria-label="添加组内作品">
          <form onSubmit={event => { event.preventDefault(); setSearch(query.trim()); setSearchPage(1); setAddIds(new Set()); }}><input aria-label="搜索要添加的作品" placeholder="搜索作品" value={query} onChange={event => setQuery(event.target.value)} disabled={busy} /><button type="submit" className="folio-line-button" disabled={busy || searching}><Search size={15} />搜索</button></form>
          <div aria-busy={searching}>{searchData?.result.map(work => <button key={work.id} type="button" aria-pressed={addIds.has(work.id)} disabled={busy || searching || saved.member_ids.includes(work.id)} onClick={() => setAddIds(current => { const next = new Set(current); if (next.has(work.id)) next.delete(work.id); else next.add(work.id); return next; })}><strong>{workTitle(work)}</strong><span>{saved.member_ids.includes(work.id) ? '已在组内' : addIds.has(work.id) ? '已选择' : '选择'}</span></button>)}</div>
          {!searching && searchData?.total === 0 ? <p className="folio-media-hint">没有找到作品</p> : null}
          <IconPager className="folio-library-pager" page={searchPage} totalPages={searchData?.num_pages ?? 1} loading={searching || busy} onPage={setSearchPage} />
          <button type="button" className="folio-line-button" disabled={busy || addIds.size === 0} onClick={() => void update({ add_ids: [...addIds] })}>加入分组{addIds.size ? ` · ${addIds.size}` : ''}</button>
        </section> : null}
        <div className="folio-work-group-grid" aria-busy={loading}>{data?.result.map(work => <div key={work.id}>
          <WorkCard work={work} view="grid" blurCovers={blurCovers} selected={false} onSelect={() => inspect(work)} onPickTag={tag => { onClose(); onPickTag(tag); }} onToggleFavorite={() => void favorite(work)} />
          {saved ? <button className="folio-work-group-remove" type="button" disabled={busy || loading || saved.count < 2} onClick={() => void update({ remove_ids: [work.id] })} aria-label={`移出${workTitle(work)}`}>移出分组</button> : null}
        </div>)}</div>
        {!loading && data?.total === 0 ? <p className="folio-media-hint">当前筛选下没有组内作品</p> : null}
        <IconPager className="folio-library-pager" page={page} totalPages={data?.num_pages ?? 1} loading={loading || busy} onPage={setPage} />
        {saved ? <footer>{confirmDissolve ? <><p>解散后，{saved.count} 部作品将分别展示，文件和阅读记录继续保留。</p><button type="button" className="folio-line-button" disabled={busy} onClick={() => void dissolve()}>确认解散</button><button type="button" className="folio-line-button" disabled={busy} onClick={() => setConfirmDissolve(false)}>取消</button></> : <button type="button" className="folio-line-button" disabled={busy} onClick={() => setConfirmDissolve(true)}>解散分组</button>}</footer> : null}
      </>}
    </div>
  </dialog>, document.querySelector('.folio') ?? document.body);
}
