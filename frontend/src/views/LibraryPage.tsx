import { BookOpen, FileOutput, Grid2X2, List, RefreshCcw, Search, Tags, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Cover } from '../components/Cover';
import { PageHero, StatStrip } from '../components/Shell';
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
  const [tagState, setTagState] = useState('all');
  const [sort, setSort] = useState('updated');
  const [selected, setSelected] = useState<number[]>([]);
  const [activeWork, setActiveWork] = useState<Work | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const inspected = activeWork || works.find((work) => selectedSet.has(work.id)) || works[0] || null;

  async function load() {
    setBusy('load');
    setError('');
    try {
      const data = await api.works({ q: query, source, tag_state: tagState, sort });
      setWorks(data.works || []);
      setSelected([]);
      setActiveWork(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '库加载失败');
    } finally {
      setBusy('');
    }
  }

  async function bulk(action: string) {
    if (!selected.length) return;
    setBusy(action);
    setError('');
    try {
      const data = await api.bulkWorks(selected, action);
      setWorks(data.works || []);
      setSelected([]);
      await refreshWorks();
    } catch (err) {
      setError(err instanceof Error ? err.message : '批量操作失败');
    } finally {
      setBusy('');
    }
  }

  function toggle(id: number) {
    setSelected((previous) => previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id]);
  }

  return (
    <section className="page library-page">
      <PageHero title="我的库" seal="采藏" subtitle="专属的同人志档案馆，珍藏每一份热爱。" />
      <StatStrip items={[
        { label: '总收藏', value: summary.total_works || works.length || 0, hint: '作品', icon: <BookOpen size={21} /> },
        { label: '已导出', value: summary.exported_works || 0, hint: 'CBZ', icon: <FileOutput size={21} /> },
        { label: '待治理', value: summary.unconfirmed_tags || 0, hint: '标签', icon: <Tags size={21} />, tone: (summary.unconfirmed_tags || 0) ? 'amber' : 'green' },
        { label: '当前显示', value: works.length, hint: selected.length ? `已选 ${selected.length}` : '筛选结果', icon: <Grid2X2 size={21} /> }
      ]} />

      <section className="filter-ribbon">
        <label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' ? load() : undefined} placeholder="标题 / 作者 / 社团 / 画廊 ID / hash" /></label>
        <select value={source} onChange={(event) => setSource(event.target.value)}>
          <option value="all">全部来源</option>
          <option value="nhentai">远端导入</option>
          <option value="local">本地文件</option>
        </select>
        <select value={tagState} onChange={(event) => setTagState(event.target.value)}>
          <option value="all">全部标签</option>
          <option value="open">待治理</option>
          <option value="confirmed">已确认</option>
        </select>
        <select value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="updated">最近更新</option>
          <option value="created">最近加入</option>
          <option value="title">标题</option>
          <option value="pages_desc">页数最多</option>
        </select>
        <button className="primary-button" type="button" onClick={load} disabled={busy === 'load'}><Search size={16} />筛选</button>
        <button className="ghost-button" type="button" onClick={refreshWorks}><RefreshCcw size={16} />刷新</button>
        <button className={`icon-button ${mode === 'grid' ? 'active' : ''}`} type="button" onClick={() => setMode('grid')} title="封面墙"><Grid2X2 size={16} /></button>
        <button className={`icon-button ${mode === 'table' ? 'active' : ''}`} type="button" onClick={() => setMode('table')} title="表格"><List size={16} /></button>
      </section>
      {error ? <p className="notice error">{error}</p> : null}

      <div className="library-layout">
        <main className="paper-panel">
          <header className="panel-head">
            <div><h2>私人馆藏墙</h2><p>选择作品会打开右侧 Inspector；双击封面进入治理。</p></div>
            <div className="row-actions">
              <button className="ghost-button" type="button" onClick={() => setSelected(works.map((work) => work.id))}>选择全部</button>
              <button className="ghost-button" type="button" onClick={() => setSelected([])}>清空</button>
            </div>
          </header>
          {mode === 'grid' ? (
            <div className="manga-grid">
              {works.map((work) => (
                <article className={`work-card ${selectedSet.has(work.id) ? 'selected' : ''}`} key={work.id} onDoubleClick={() => openWork(work)}>
                  <label className="floating-check"><input type="checkbox" checked={selectedSet.has(work.id)} onChange={() => toggle(work.id)} /><span /></label>
                  <button type="button" className="work-cover-button" onClick={() => setActiveWork(work)}>
                    <Cover src={work.cover_url} title={work.display_title} token={api.token} selected={selectedSet.has(work.id)} />
                    <strong>{work.display_title}</strong>
                    <span>{identitySummary(work.tag_preview)} · {work.page_count || '?'}P</span>
                  </button>
                  <TagRail tags={work.tag_preview} />
                </article>
              ))}
              {!works.length ? <Empty title="馆藏为空" text="先从发现页导入，或上传本地 CBZ。" /> : null}
            </div>
          ) : (
            <div className="archive-table">
              <div className="table-head"><span></span><span>作品</span><span>身份</span><span>页数</span><span>待治理</span><span>状态</span></div>
              {works.map((work) => (
                <button type="button" className="table-row" key={work.id} onClick={() => setActiveWork(work)} onDoubleClick={() => openWork(work)}>
                  <span><input type="checkbox" checked={selectedSet.has(work.id)} onChange={(event) => { event.stopPropagation(); toggle(work.id); }} /></span>
                  <strong>{work.display_title}</strong>
                  <span>{identitySummary(work.tag_preview)}</span>
                  <span>{work.page_count || '?'}P</span>
                  <span>{work.unconfirmed_tag_count || 0}</span>
                  <span>{work.status}</span>
                </button>
              ))}
            </div>
          )}
        </main>

        <Inspector api={api} work={inspected} selectedCount={selected.length} openWork={openWork} />
      </div>

      {selected.length ? (
        <aside className="selection-bar">
          <strong>已选择 {selected.length} 项</strong>
          <button type="button" onClick={() => bulk('apply_dictionary')} disabled={Boolean(busy)}><Tags size={15} />应用词典</button>
          <button type="button" onClick={() => bulk('export')} disabled={Boolean(busy)}><FileOutput size={15} />批量导出</button>
          <button type="button" onClick={() => bulk('reparse')} disabled={Boolean(busy)}><RefreshCcw size={15} />重新解析</button>
          <button type="button" className="danger" onClick={() => bulk('delete')} disabled={Boolean(busy)}><Trash2 size={15} />删除记录</button>
        </aside>
      ) : null}
    </section>
  );
}

function Inspector({ api, work, selectedCount, openWork }: { api: ApiClient; work: Work | null; selectedCount: number; openWork: (work: Work) => void }) {
  if (!work) return <aside className="paper-panel inspector-panel"><Empty title="未选择" text="选择一本作品查看路径、标签和操作。" /></aside>;
  return (
    <aside className="paper-panel inspector-panel sticky">
      <Cover src={work.cover_url} title={work.display_title} token={api.token} />
      <span className="muted">{selectedCount ? `已选择 ${selectedCount} 项` : sourceName(work.source_type)}</span>
      <h2>{work.display_title}</h2>
      <dl className="meta-list">
        <div><dt>来源 ID</dt><dd>{work.source_id || '本地'}</dd></div>
        <div><dt>页数</dt><dd>{work.page_count || '?'}</dd></div>
        <div><dt>待治理</dt><dd>{work.unconfirmed_tag_count || 0}</dd></div>
        <div><dt>导出次数</dt><dd>{work.export_count || 0}</dd></div>
      </dl>
      <TagRail tags={work.tag_preview} />
      <button type="button" className="primary-button full" onClick={() => openWork(work)}>进入治理</button>
    </aside>
  );
}

function TagRail({ tags = [] }: { tags?: WorkTagPreview[] }) {
  const visible = tags.filter((tag) => tag.value).slice(0, 10);
  return <div className="tag-cloud compact">{visible.map((tag, index) => <span className={tag.confirmed ? 'confirmed' : ''} key={`${tag.type}-${tag.value}-${index}`}>{tag.value}</span>)}</div>;
}

function identitySummary(tags: WorkTagPreview[] = []) {
  const get = (type: string) => tags.find((tag) => tag.type === type)?.value;
  return [get('artist'), get('group'), get('language')].filter(Boolean).join(' / ') || '身份未整理';
}

function sourceName(value: string) {
  return value === 'local' ? '本地文件' : value || '未知来源';
}

function Empty({ title, text }: { title: string; text: string }) {
  return <div className="empty-panel"><strong>{title}</strong><span>{text}</span></div>;
}
