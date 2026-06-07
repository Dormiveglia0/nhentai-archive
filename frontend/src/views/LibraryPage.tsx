import { BookOpen, FileOutput, Grid2X2, List, RefreshCcw, RotateCcw, Search, Tags, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Cover } from '../components/Cover';
import { PageHeader } from '../components/Shell';
import type { ApiClient, Work, WorkTagPreview } from '../lib/api';

type Mode = 'grid' | 'table';

export function LibraryPage({
  api,
  works,
  setWorks,
  summary,
  refreshWorks,
  openWork
}: {
  api: ApiClient;
  works: Work[];
  setWorks: (works: Work[]) => void;
  summary: Record<string, number>;
  refreshWorks: () => Promise<void>;
  openWork: (work: Work) => void;
}) {
  const [mode, setMode] = useState<Mode>('grid');
  const [query, setQuery] = useState('');
  const [source, setSource] = useState('all');
  const [status, setStatus] = useState('all');
  const [tagState, setTagState] = useState('all');
  const [sort, setSort] = useState('updated');
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const inspectedWork = useMemo(() => works.find((work) => selectedSet.has(work.id)) || works[0] || null, [selectedSet, works]);

  async function search(next: Partial<Record<'query' | 'source' | 'status' | 'tagState' | 'sort', string>> = {}) {
    setBusy(true);
    setError('');
    const payload = {
      q: next.query ?? query,
      source: next.source ?? source,
      status: next.status ?? status,
      tag_state: next.tagState ?? tagState,
      sort: next.sort ?? sort
    };
    try {
      const data = await api.works(payload);
      setWorks(data.works || []);
      setSelected([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '库搜索失败');
    } finally {
      setBusy(false);
    }
  }

  async function resetFilters() {
    setQuery('');
    setSource('all');
    setStatus('all');
    setTagState('all');
    setSort('updated');
    await search({ query: '', source: 'all', status: 'all', tagState: 'all', sort: 'updated' });
  }

  async function bulk(action: string) {
    if (!selected.length) {
      setError('请选择作品');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const data = await api.bulkWorks(selected, action);
      setWorks(data.works || []);
      setSelected([]);
      setMessage(`批量操作完成：更新 ${data.result.updated || 0}，失败 ${data.result.failed || 0}`);
      await refreshWorks();
    } catch (err) {
      setError(err instanceof Error ? err.message : '批量操作失败');
    } finally {
      setBusy(false);
    }
  }

  function toggle(id: number) {
    setSelected((previous) => previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id]);
  }

  function selectAllVisible() {
    setSelected(works.map((work) => work.id));
  }

  return (
    <section className="page library-page manga-library">
      <PageHeader
        title="我的库"
        subtitle={`共 ${summary.total_works || works.length || 0} 部作品。这里按同人志归档逻辑整理 CBZ、标签和导出。`}
        action={<button className="ghost-button" type="button" onClick={refreshWorks}><RefreshCcw size={16} />刷新</button>}
      />

      <section className="library-filter-shelf" aria-label="库筛选">
        <div className="filter-search manga-search-field">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' ? search() : undefined} placeholder="标题 / 作者 / 社团 / 画廊 ID / hash" />
        </div>
        <select value={source} onChange={(event) => { setSource(event.target.value); search({ source: event.target.value }); }}>
          <option value="all">全部来源</option>
          <option value="nhentai">nhentai 导入</option>
          <option value="local">本地文件</option>
        </select>
        <select value={status} onChange={(event) => { setStatus(event.target.value); search({ status: event.target.value }); }}>
          <option value="all">全部状态</option>
          <option value="ready">可编辑</option>
          <option value="exported">有导出文件</option>
          <option value="failed">失败</option>
        </select>
        <select value={tagState} onChange={(event) => { setTagState(event.target.value); search({ tagState: event.target.value }); }}>
          <option value="all">全部标签</option>
          <option value="open">待整理标签</option>
          <option value="confirmed">标签已确认</option>
        </select>
        <select value={sort} onChange={(event) => { setSort(event.target.value); search({ sort: event.target.value }); }}>
          <option value="updated">最近更新</option>
          <option value="created">最近加入</option>
          <option value="title">标题 A-Z</option>
          <option value="pages_desc">页数最多</option>
        </select>
        <button className="primary-button" type="button" onClick={() => search()} disabled={busy}><Search size={16} />搜索</button>
        <button className="ghost-button" type="button" onClick={resetFilters}><RotateCcw size={16} />重置</button>
        <div className="view-switch">
          <button className={`icon-button ${mode === 'grid' ? 'active' : ''}`} type="button" onClick={() => setMode('grid')} title="封面墙"><Grid2X2 size={16} /></button>
          <button className={`icon-button ${mode === 'table' ? 'active' : ''}`} type="button" onClick={() => setMode('table')} title="表格"><List size={16} /></button>
        </div>
      </section>

      {error ? <p className="notice error">{error}</p> : null}
      {message ? <p className="notice success">{message}</p> : null}

      <div className="library-workspace">
        <main className="library-shelf" aria-label="漫画封面墙">
          <div className="library-shelf-head">
            <div>
              <strong>{works.length ? `当前显示 ${works.length} 部` : '暂无作品'}</strong>
              <span>内容标签只显示普通内容标签，作者/社团/分类固定在身份信息里。</span>
            </div>
            <div className="shelf-actions">
              <button type="button" onClick={selectAllVisible} disabled={!works.length}>选择当前页</button>
              <button type="button" onClick={() => setSelected([])} disabled={!selected.length}>取消选择</button>
            </div>
          </div>

          {mode === 'grid' ? (
            <div className="manga-cover-wall">
              {works.map((work) => (
                <MangaWorkCard
                  api={api}
                  key={work.id}
                  work={work}
                  selected={selectedSet.has(work.id)}
                  toggle={() => toggle(work.id)}
                  open={() => openWork(work)}
                />
              ))}
              {!works.length ? <EmptyLibrary /> : null}
            </div>
          ) : (
            <div className="work-table manga-table">
              <div className="work-table-head"><span></span><span>标题</span><span>身份信息</span><span>内容标签</span><span>状态</span><span>更新时间</span></div>
              {works.map((work) => (
                <div className="work-table-row" key={work.id}>
                  <input type="checkbox" checked={selectedSet.has(work.id)} onChange={() => toggle(work.id)} />
                  <button type="button" onClick={() => openWork(work)}>{work.display_title}</button>
                  <span>{identitySummary(work)}</span>
                  <ContentTagRail tags={work.tag_preview || []} compact />
                  <span className={`status-chip ${work.status}`}>{statusName(work.status)}</span>
                  <span>{formatDate(work.updated_at)}</span>
                </div>
              ))}
            </div>
          )}
        </main>

        <LibraryInspector api={api} work={inspectedWork} openWork={openWork} selectedCount={selected.length} />
      </div>

      {selected.length ? (
        <div className="bulk-command-bar library-floating-bulk">
          <strong>{selected.length} 部已选择</strong>
          <button type="button" onClick={() => bulk('apply_dictionary')} disabled={busy}><Tags size={15} />套用词典</button>
          <button type="button" onClick={() => bulk('export')} disabled={busy}><FileOutput size={15} />生成导出</button>
          <button type="button" onClick={() => bulk('reparse')} disabled={busy}><RefreshCcw size={15} />重解析</button>
          <button type="button" className="danger" onClick={() => bulk('delete')} disabled={busy}><Trash2 size={15} />删除记录</button>
        </div>
      ) : null}
    </section>
  );
}

function MangaWorkCard({ api, work, selected, toggle, open }: { api: ApiClient; work: Work; selected: boolean; toggle: () => void; open: () => void }) {
  const identity = identityFromPreview(work.tag_preview || []);
  return (
    <article className={`manga-work-card ${selected ? 'selected' : ''}`}>
      <label className="select-box work-select" onClick={(event) => event.stopPropagation()}>
        <input type="checkbox" checked={selected} onChange={toggle} />
        <span />
      </label>
      <button type="button" onClick={open} className="manga-card-open">
        <Cover src={work.cover_url} title={work.display_title} token={api.token} />
        <strong>{work.display_title}</strong>
        <div className="manga-card-identity">
          <span>作者 {identity.artist}</span>
          <span>社团 {identity.group}</span>
          <span>分类 {identity.category}</span>
          <span>语言 {identity.language}</span>
        </div>
        <ContentTagRail tags={work.tag_preview || []} />
      </button>
      <footer>
        <span className={`status-chip ${work.status}`}>{statusName(work.status)}</span>
        <span>{work.page_count || '?'} 页</span>
      </footer>
    </article>
  );
}

function LibraryInspector({ api, work, openWork, selectedCount }: { api: ApiClient; work: Work | null; openWork: (work: Work) => void; selectedCount: number }) {
  if (!work) {
    return (
      <aside className="library-inspector empty-inspector">
        <BookOpen size={28} />
        <h2>选择一本漫画</h2>
        <p>右侧会显示身份信息、内容标签和元数据整理入口。</p>
      </aside>
    );
  }
  const identity = identityFromPreview(work.tag_preview || []);
  return (
    <aside className="library-inspector">
      <Cover src={work.cover_url} title={work.display_title} token={api.token} />
      <div className="inspector-title">
        <span>{selectedCount ? `已选择 ${selectedCount} 部` : sourceName(work.source_type)}</span>
        <h2>{work.display_title}</h2>
      </div>
      <div className="identity-list">
        <Info label="作者" value={identity.artist} />
        <Info label="社团" value={identity.group} />
        <Info label="分类" value={identity.category} />
        <Info label="语言" value={identity.language} />
        <Info label="来源 ID" value={work.source_id || '本地文件'} />
        <Info label="页数" value={String(work.page_count || '?')} />
      </div>
      <section className="inspector-section">
        <h3>内容标签</h3>
        <ContentTagRail tags={work.tag_preview || []} />
      </section>
      <div className="inspector-actions">
        <button type="button" className="primary-button" onClick={() => openWork(work)}>打开详情</button>
        <span>{work.unconfirmed_tag_count || 0} 个待整理标签</span>
      </div>
    </aside>
  );
}

function ContentTagRail({ tags, compact }: { tags: WorkTagPreview[]; compact?: boolean }) {
  const contentTags = tags.filter((tag) => tag.value && (tag.type === 'tag' || tag.type === 'other'));
  if (!contentTags.length) return <div className={`content-tag-rail ${compact ? 'compact' : ''}`}><span>暂无内容标签</span></div>;
  return (
    <div className={`content-tag-rail ${compact ? 'compact' : ''}`} aria-label="内容标签">
      {contentTags.map((tag, index) => <span className={tag.confirmed ? 'confirmed' : ''} key={`${tag.type}-${tag.value}-${index}`}>{tag.value}</span>)}
    </div>
  );
}

function EmptyLibrary() {
  return (
    <div className="empty-state import-empty">
      <BookOpen size={28} />
      <h2>暂无库记录</h2>
      <p>从“搜索”导入远程作品，或上传/扫描本地 CBZ。</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value || '无'}</strong></div>;
}

function identityFromPreview(tags: WorkTagPreview[]) {
  const first = (type: string) => tags.filter((tag) => tag.type === type && tag.value).map((tag) => tag.value).slice(0, 2).join('、') || '无';
  return {
    artist: first('artist'),
    group: first('group'),
    category: first('category'),
    language: first('language')
  };
}

function identitySummary(work: Work) {
  const identity = identityFromPreview(work.tag_preview || []);
  return `作者 ${identity.artist} / 社团 ${identity.group} / 分类 ${identity.category}`;
}

function sourceName(value: string) {
  if (value === 'nhentai') return 'nhentai';
  if (value === 'local') return '本地文件';
  return value || '未知来源';
}

function statusName(value: string) {
  const map: Record<string, string> = { ready: '可编辑', exported: '有导出', failed: '失败', imported: '已入库' };
  return map[value] || value || '未知';
}

function formatDate(value: string) {
  return value ? new Date(value).toLocaleString() : '无';
}
