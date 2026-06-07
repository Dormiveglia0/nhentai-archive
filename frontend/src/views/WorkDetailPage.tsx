import { ArrowLeft, BookOpen, Check, Download, Languages, RefreshCcw, Save, Tags, Wand2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Cover } from '../components/Cover';
import { PageHero, StatStrip } from '../components/Shell';
import type { ApiClient, ComicInfo, WorkDetail, WorkTag } from '../lib/api';

const fields: (keyof ComicInfo)[] = ['Title', 'Series', 'Writer', 'Translator', 'Format', 'Tags', 'LanguageISO', 'Web', 'PageCount', 'Year', 'Month', 'Day', 'AgeRating'];
const groups = [
  ['identity', '作者与社团', ['artist', 'group']],
  ['world', '原作与角色', ['parody', 'character']],
  ['content', '内容标签', ['tag', 'other']],
  ['language', '语言与分类', ['language', 'category']]
] as const;

export function WorkDetailPage({
  api,
  workId,
  back,
  refreshWorks,
  openReader
}: {
  api: ApiClient;
  workId: number;
  back: () => void;
  refreshWorks: () => Promise<void>;
  openReader: (id: number) => void;
}) {
  const [detail, setDetail] = useState<WorkDetail | null>(null);
  const [comicInfo, setComicInfo] = useState<ComicInfo>({});
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  async function load() {
    const next = await api.work(workId);
    setDetail(next);
    setComicInfo(next.metadata?.working?.comic_info || next.metadata?.original?.comic_info || {});
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : '作品加载失败'));
  }, [workId]);

  async function run(label: string, action: () => Promise<void>) {
    setBusy(label);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(label);
      await refreshWorks();
    } catch (err) {
      setError(err instanceof Error ? err.message : `${label}失败`);
    } finally {
      setBusy('');
    }
  }

  if (!detail) {
    return <section className="page"><PageHero title="作品治理" subtitle="正在加载作品..." /><p className="empty-panel">加载中</p></section>;
  }

  const current = detail;
  const grouped = groupTags(current.tags);
  const completion = current.tags.length ? Math.round((current.tags.filter((tag) => tag.is_confirmed).length / current.tags.length) * 100) : 100;

  async function saveMetadata() {
    await run('元数据已保存', async () => {
      const metadata = await api.saveMetadata(current.work.id, comicInfo);
      setDetail({ ...current, metadata });
      await load();
    });
  }

  async function tagAction(action: string, ids = selected) {
    if (!ids.length) return;
    await run('标签已更新', async () => {
      const res = await api.tagBulk(current.work.id, ids, action);
      setDetail({ ...current, tags: res.tags || [] });
      setSelected([]);
    });
  }

  return (
    <section className="page governance-page">
      <PageHero title="作品治理" seal="治理" subtitle="维护作品元数据与标签，统一标准，提高导出质量。">
        <div className="hero-actions">
          <button type="button" className="ghost-button" onClick={back}><ArrowLeft size={16} />返回库</button>
          <button type="button" className="ghost-button" onClick={() => openReader(current.work.id)}><BookOpen size={16} />阅读</button>
          <button type="button" className="primary-button" onClick={() => run('已生成新 CBZ', async () => { await api.exportWork(current.work.id); await load(); })}><Download size={16} />导出 CBZ</button>
        </div>
      </PageHero>
      <StatStrip items={[
        { label: '页数', value: current.work.page_count || '?', hint: current.work.source_type, icon: <BookOpen size={21} /> },
        { label: '完整度', value: `${completion}%`, hint: '标签确认', icon: <Check size={21} />, tone: completion >= 80 ? 'green' : 'amber' },
        { label: '待确认', value: current.work.unconfirmed_tag_count || 0, hint: '标签', icon: <Tags size={21} />, tone: current.work.unconfirmed_tag_count ? 'red' : 'green' },
        { label: '导出记录', value: current.exports.length, hint: '历史产物', icon: <Download size={21} /> }
      ]} />
      {notice ? <p className="notice success">{notice}</p> : null}
      {error ? <p className="notice error">{error}</p> : null}

      <section className="work-banner paper-panel">
        <Cover src={current.work.cover_url} title={current.work.display_title} token={api.token} />
        <div>
          <h2>{current.work.display_title}</h2>
          <p>{current.work.local_cbz_path || '路径未记录'}</p>
          <div className="tag-cloud">{current.work.tag_preview.slice(0, 14).map((tag, index) => <span key={`${tag.type}-${tag.value}-${index}`}>{tag.value}</span>)}</div>
        </div>
      </section>

      <div className="governance-layout">
        <main className="paper-panel editor-panel">
          <header className="panel-head">
            <div><h2>ComicInfo / 元数据对照编辑</h2><p>工作副本用于导出，不修改原始 CBZ。</p></div>
            <button type="button" className="primary-button" onClick={saveMetadata} disabled={Boolean(busy)}><Save size={16} />保存修改</button>
          </header>
          <div className="metadata-grid">
            {fields.map((field) => (
              <label key={field}>
                <span>{field}</span>
                <input
                  value={String(comicInfo[field] ?? '')}
                  type={['PageCount', 'Year', 'Month', 'Day'].includes(field) ? 'number' : 'text'}
                  onChange={(event) => setComicInfo((previous) => ({ ...previous, [field]: event.target.type === 'number' ? Number(event.target.value) || 0 : event.target.value }))}
                />
              </label>
            ))}
          </div>
        </main>

        <aside className="paper-panel side-stack">
          <header className="panel-head"><div><h2>标签治理看板</h2><p>按语义分组确认最终写入值。</p></div></header>
          <div className="tag-board">
            {groups.map(([id, label, types]) => (
              <section key={id}>
                <h3>{label}</h3>
                {(types.flatMap((type) => grouped[type] || [])).map((tag) => (
                  <label className={`govern-tag ${tag.is_confirmed ? 'confirmed' : ''}`} key={tag.id}>
                    <input type="checkbox" checked={selectedSet.has(tag.id)} onChange={() => setSelected((previous) => previous.includes(tag.id) ? previous.filter((item) => item !== tag.id) : [...previous, tag.id])} />
                    <span><strong>{tag.final_value || tag.original_name}</strong><small>{tag.original_name}</small></span>
                  </label>
                ))}
              </section>
            ))}
          </div>
        </aside>
      </div>

      <aside className="selection-bar">
        <strong>已选择 {selected.length} 个标签</strong>
        <button type="button" onClick={() => setSelected(current.tags.map((tag) => tag.id))}>全选标签</button>
        <button type="button" onClick={() => tagAction('use_dictionary')} disabled={!selected.length}><Wand2 size={15} />使用词典</button>
        <button type="button" onClick={() => tagAction('use_machine')} disabled={!selected.length}><Languages size={15} />使用机翻</button>
        <button type="button" onClick={() => tagAction('confirm')} disabled={!selected.length}><Check size={15} />确认</button>
        <button type="button" onClick={() => setSelected([])}>清空</button>
      </aside>
    </section>
  );
}

function groupTags(tags: WorkTag[]) {
  return tags.reduce<Record<string, WorkTag[]>>((acc, tag) => {
    const key = tag.type || 'other';
    acc[key] = [...(acc[key] || []), tag];
    return acc;
  }, {});
}
