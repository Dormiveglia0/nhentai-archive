import { ArrowLeft, Check, Download, FileOutput, Languages, RefreshCcw, Save, Split, Trash2, Wand2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Cover } from '../components/Cover';
import { PageHeader } from '../components/Shell';
import type { ApiClient, ComicInfo, ExportRecord, WorkDetail, WorkTag } from '../lib/api';

type ReferenceTab = 'meta' | 'comic' | 'files';
type TagType = 'artist' | 'group' | 'category' | 'parody' | 'character' | 'tag' | 'language' | 'other';

const tagTypes: { id: TagType; label: string }[] = [
  { id: 'artist', label: '作者' },
  { id: 'group', label: '社团' },
  { id: 'category', label: '分类' },
  { id: 'parody', label: '作品' },
  { id: 'character', label: '角色' },
  { id: 'tag', label: '内容标签' },
  { id: 'language', label: '语言' },
  { id: 'other', label: '其他' }
];

const comicFields: (keyof ComicInfo)[] = ['Title', 'Series', 'Writer', 'Translator', 'Format', 'Tags', 'LanguageISO', 'Web', 'PageCount', 'Year', 'Month', 'Day', 'AgeRating'];

export function WorkDetailPage({ api, workId, back, refreshWorks }: { api: ApiClient; workId: number; back: () => void; refreshWorks: () => Promise<void> }) {
  const [detail, setDetail] = useState<WorkDetail | null>(null);
  const [referenceTab, setReferenceTab] = useState<ReferenceTab>('meta');
  const [activeType, setActiveType] = useState<TagType>('tag');
  const [comicInfo, setComicInfo] = useState<ComicInfo>({});
  const [metadataSuggestions, setMetadataSuggestions] = useState<Partial<Record<keyof ComicInfo, string>>>({});
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const selectedSet = useMemo(() => new Set(selectedTags), [selectedTags]);

  async function load() {
    const next = await api.work(workId);
    const normalized = normalizeDetail(next);
    setDetail(normalized);
    setComicInfo(normalized.metadata.working?.comic_info || normalized.metadata.original?.comic_info || {});
    const grouped = groupWorkTags(normalized.tags);
    if (!grouped[activeType]?.length) {
      const fallback = tagTypes.find((type) => grouped[type.id]?.length)?.id || 'tag';
      setActiveType(fallback);
    }
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : '加载作品失败'));
  }, [workId]);

  async function run(label: string, action: () => Promise<void>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
      setMessage(label);
      await refreshWorks();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setBusy(false);
    }
  }

  if (!detail) {
    return <section className="page"><PageHeader title="作品详情" action={<button className="ghost-button" onClick={back}><ArrowLeft size={16} />返回我的库</button>} /><p className="empty">正在加载...</p></section>;
  }

  const currentDetail = detail;
  const { work } = currentDetail;
  const grouped = groupWorkTags(currentDetail.tags);
  const activeTags = grouped[activeType] || [];

  async function tagBulk(actionName: string, ids = selectedTags) {
    if (!ids.length) {
      setError('请先选择标签');
      return;
    }
    await run('标签已更新', async () => {
      const res = await api.tagBulk(work.id, ids, actionName);
      setDetail({ ...currentDetail, tags: res.tags || [] });
      setSelectedTags([]);
    });
  }

  return (
    <section className="page work-detail-page tag-governance-page">
      <PageHeader
        title="作品详情 / 标签治理"
        subtitle={`${work.display_title} · ${sourceName(work.source_type)} ${work.source_id || work.file_hash.slice(0, 12)}`}
        action={
          <div className="row-actions">
            <button className="ghost-button" type="button" onClick={back}><ArrowLeft size={16} />返回我的库</button>
            <button className="ghost-button" type="button" disabled={busy} onClick={() => load()}><RefreshCcw size={16} />刷新元数据</button>
            <button className="primary-button" type="button" disabled={busy} onClick={() => run('已生成新 CBZ', async () => { await api.exportWork(work.id); await load(); })}><FileOutput size={16} />导出 CBZ</button>
          </div>
        }
      />
      {error ? <p className="notice error">{error}</p> : null}
      {message ? <p className="notice success">{message}</p> : null}

      <section className="governance-hero">
        <Cover src={work.cover_url} title={work.display_title} token={api.token} />
        <div className="governance-summary">
          <div className="work-titleline">
            <div>
              <h2>{work.display_title}</h2>
              <p>{work.local_cbz_path || '本地路径未记录'}</p>
            </div>
            <span className={`status-chip ${work.status}`}>{statusName(work.status)}</span>
          </div>
          <div className="identity-table">
            <Info label="作者" value={firstTag(grouped.artist)} />
            <Info label="社团" value={firstTag(grouped.group)} />
            <Info label="分类" value={firstTag(grouped.category)} />
            <Info label="语言" value={firstTag(grouped.language)} />
            <Info label="作品" value={firstTag(grouped.parody)} />
            <Info label="角色" value={firstTag(grouped.character)} />
            <Info label="来源 ID" value={work.source_id || '本地文件'} />
            <Info label="页数" value={String(work.page_count || '?')} />
          </div>
        </div>
        <div className="content-tag-panel">
          <header>
            <h3>内容标签</h3>
            <span>仅普通内容标签显示在这里</span>
          </header>
          <ContentTagRail tags={detail.tags} />
          <button type="button" className="ghost-button" onClick={() => setActiveType('tag')}>整理内容标签</button>
        </div>
      </section>

      <div className="governance-layout">
        <aside className="reference-panel">
          <div className="reference-tabs">
            <button className={referenceTab === 'meta' ? 'active' : ''} type="button" onClick={() => setReferenceTab('meta')}>meta.json</button>
            <button className={referenceTab === 'comic' ? 'active' : ''} type="button" onClick={() => setReferenceTab('comic')}>ComicInfo</button>
            <button className={referenceTab === 'files' ? 'active' : ''} type="button" onClick={() => setReferenceTab('files')}>文件历史</button>
          </div>
          {referenceTab === 'meta' ? <MetaJsonPanel detail={detail} /> : null}
          {referenceTab === 'comic' ? (
            <ComicInfoPanel
              api={api}
              detail={detail}
              comicInfo={comicInfo}
              suggestions={metadataSuggestions}
              setComicInfo={setComicInfo}
              busy={busy}
              run={run}
              reload={load}
              setDetail={setDetail}
              setSuggestions={setMetadataSuggestions}
            />
          ) : null}
          {referenceTab === 'files' ? <FilesPanel api={api} detail={detail} /> : null}
        </aside>

        <main className="tag-workbench">
          <section className="tag-type-switch" aria-label="标签类型切换">
            {tagTypes.map((type) => (
              <button
                className={activeType === type.id ? 'active' : ''}
                type="button"
                key={type.id}
                onClick={() => {
                  setActiveType(type.id);
                  setSelectedTags([]);
                }}
              >
                {type.label}
                <span>{grouped[type.id]?.length || 0}</span>
              </button>
            ))}
          </section>

          <section className="tag-action-row">
            <span>当前类型：{tagTypeName(activeType)} · 已选 {selectedTags.length} 项</span>
            <button type="button" onClick={() => setSelectedTags(activeTags.map((tag) => tag.id))} disabled={!activeTags.length}>全选当前类型</button>
            <button type="button" onClick={() => tagBulk('use_dictionary')} disabled={busy || !selectedTags.length}><Wand2 size={15} />使用词典</button>
            <button type="button" onClick={() => tagBulk('use_machine')} disabled={busy || !selectedTags.length}><Languages size={15} />使用机翻</button>
            <button type="button" onClick={() => tagBulk('confirm')} disabled={busy || !selectedTags.length}><Check size={15} />标记已确认</button>
            <button type="button" onClick={() => setSelectedTags([])} disabled={!selectedTags.length}>清空选择</button>
          </section>

          <TagTable
            api={api}
            workId={work.id}
            tags={activeTags}
            selected={selectedSet}
            toggle={(id) => setSelectedTags((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id])}
            update={(tags) => setDetail({ ...currentDetail, tags: tags || [] })}
          />
        </main>
      </div>
    </section>
  );
}

function MetaJsonPanel({ detail }: { detail: WorkDetail }) {
  return (
    <div className="source-code-panel">
      <header>
        <h2>原始 meta.json</h2>
        <span>只读参考</span>
      </header>
      <pre>{JSON.stringify(detail.metadata.original?.meta_json || {}, null, 2)}</pre>
    </div>
  );
}

function ComicInfoPanel({
  api,
  detail,
  comicInfo,
  suggestions,
  setComicInfo,
  busy,
  run,
  reload,
  setDetail,
  setSuggestions
}: {
  api: ApiClient;
  detail: WorkDetail;
  comicInfo: ComicInfo;
  suggestions: Partial<Record<keyof ComicInfo, string>>;
  setComicInfo: (next: ComicInfo | ((previous: ComicInfo) => ComicInfo)) => void;
  busy: boolean;
  run: (label: string, action: () => Promise<void>) => Promise<void>;
  reload: () => Promise<void>;
  setDetail: (detail: WorkDetail) => void;
  setSuggestions: (suggestions: Partial<Record<keyof ComicInfo, string>>) => void;
}) {
  const work = detail.work;
  return (
    <section className="comicinfo-reference">
      <header>
        <div>
          <h2>ComicInfo 输出</h2>
          <p>这是导出用工作副本，不修改原 CBZ。</p>
        </div>
        <div className="row-actions">
          <button className="ghost-button" type="button" disabled={busy} onClick={() => run('已生成机翻建议', async () => { const res = await api.translateMetadata(work.id); setSuggestions(res.suggestions || {}); })}><Languages size={16} />机翻建议</button>
          <button className="primary-button" type="button" disabled={busy} onClick={() => run('元数据已保存', async () => { const next = await api.saveMetadata(work.id, comicInfo); setDetail({ ...detail, metadata: next }); })}><Save size={16} />保存</button>
        </div>
      </header>
      <div className="metadata-form compact compact-comic-form">
        {comicFields.map((field) => (
          <label key={field}>
            <span>{field}</span>
            <input
              value={String(comicInfo[field] ?? '')}
              type={['PageCount', 'Year', 'Month', 'Day'].includes(field) ? 'number' : 'text'}
              onChange={(event) => setComicInfo((previous) => ({ ...previous, [field]: event.target.type === 'number' ? Number(event.target.value) || 0 : event.target.value }))}
            />
            {suggestions[field] ? <button type="button" onClick={() => setComicInfo((previous) => ({ ...previous, [field]: suggestions[field] }))}>应用：{suggestions[field]}</button> : null}
          </label>
        ))}
      </div>
      <div className="split-actions">
        <button type="button" className="ghost-button" onClick={() => run('已从原始元数据重置', async () => { await api.metadataAction(work.id, 'reset'); setSuggestions({}); await reload(); })}><RefreshCcw size={16} />重置为原始</button>
        <button type="button" className="ghost-button" onClick={() => run('已从 meta.json 填充', async () => { await api.metadataAction(work.id, 'refill-from-meta'); setSuggestions({}); await reload(); })}>从 meta.json 填充</button>
      </div>
    </section>
  );
}

function TagTable({ api, workId, tags, selected, toggle, update }: { api: ApiClient; workId: number; tags: WorkTag[]; selected: Set<number>; toggle: (id: number) => void; update: (tags: WorkTag[]) => void }) {
  async function action(id: number, actionName: string) {
    const res = await api.tagBulk(workId, [id], actionName);
    update(res.tags || []);
  }

  if (!tags.length) {
    return <div className="empty-state tag-empty"><Split size={28} /><h2>当前类型暂无标签</h2><p>可以从源数据重新解析，或新增一个标签。</p></div>;
  }

  return (
    <div className="tag-governance-table">
      <div className="tag-governance-head"><span></span><span>原文</span><span>词典译名</span><span>机翻建议</span><span>最终写入</span><span>状态</span><span>操作</span></div>
      {tags.map((tag) => (
        <div className={`tag-governance-row ${tag.is_confirmed ? '' : 'open'}`} key={tag.id}>
          <input type="checkbox" checked={selected.has(tag.id)} onChange={() => toggle(tag.id)} />
          <strong>{tag.original_name}</strong>
          <span>{tag.dictionary_value || '-'}</span>
          <span>{tag.machine_suggestion || '-'}</span>
          <input value={tag.final_value || ''} onChange={(event) => api.patchTag(workId, tag.id, { final_value: event.target.value, final_source: 'manual' }).then((res) => update(res.tags || []))} />
          <span className={`status-chip ${tag.is_confirmed ? 'confirmed' : tag.final_source}`}>{tag.is_confirmed ? '已确认' : sourceNameForTag(tag.final_source)}</span>
          <div className="row-actions">
            <button type="button" title="使用词典" onClick={() => action(tag.id, 'use_dictionary')}><Wand2 size={15} /></button>
            <button type="button" title="使用机翻" onClick={() => action(tag.id, 'use_machine')}><Languages size={15} /></button>
            <button type="button" title="确认" onClick={() => api.patchTag(workId, tag.id, { is_confirmed: true }).then((res) => update(res.tags || []))}><Check size={15} /></button>
            <button type="button" title="删除" onClick={() => action(tag.id, 'delete')}><Trash2 size={15} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}

function FilesPanel({ api, detail }: { api: ApiClient; detail: WorkDetail }) {
  const work = detail.work;
  const exports = detail.exports || [];
  return (
    <section className="files-reference">
      <h2>文件与历史</h2>
      <div className="identity-list">
        <Info label="原始 CBZ" value={work.local_cbz_path || '缺失'} />
        <Info label="封面缓存" value={work.cover_path || '缺失'} />
        <Info label="SHA-256" value={work.file_hash || '无'} />
        <Info label="创建记录" value={work.created_at || '无'} />
        <Info label="最近更新" value={work.updated_at || '无'} />
      </div>
      <h3>导出文件</h3>
      <div className="simple-list">
        {exports.map((item) => (
          <div className="simple-row compact-export-row" key={item.id}>
            <div><strong>{item.filename}</strong><span>{item.created_at}</span></div>
            <button className="ghost-button" type="button" onClick={() => api.download(item.download_url, item.filename)}><Download size={15} />下载</button>
          </div>
        ))}
        {!exports.length ? <p className="empty">暂无导出文件</p> : null}
      </div>
    </section>
  );
}

function ContentTagRail({ tags }: { tags: WorkTag[] }) {
  const preview = tags.filter((tag) => tag.type === 'tag' || tag.type === 'other').slice(0, 24);
  return (
    <div className="content-tag-rail detail">
      {preview.map((tag) => <span className={tag.is_confirmed ? 'confirmed' : ''} key={tag.id}>{tag.final_value || tag.original_name}</span>)}
      {!preview.length ? <span>暂无内容标签</span> : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="info-line"><span>{label}</span><strong>{value || '无'}</strong></div>;
}

function normalizeDetail(detail: WorkDetail): WorkDetail {
  return {
    work: { ...detail.work, tag_preview: detail.work?.tag_preview || [] },
    metadata: detail.metadata || {},
    tags: Array.isArray(detail.tags) ? detail.tags : [],
    exports: Array.isArray(detail.exports) ? detail.exports : []
  };
}

function groupWorkTags(tags: WorkTag[]) {
  return tags.reduce<Record<string, WorkTag[]>>((acc, tag) => {
    const key = (tag.type || 'other') as TagType;
    const normalizedKey = tagTypes.some((item) => item.id === key) ? key : 'other';
    acc[normalizedKey] = [...(acc[normalizedKey] || []), tag];
    return acc;
  }, {});
}

function firstTag(tags?: WorkTag[]) {
  return tags?.map((tag) => tag.final_value || tag.original_name).filter(Boolean).slice(0, 3).join('、') || '无';
}

function sourceName(value: string) {
  if (value === 'nhentai') return 'nhentai';
  if (value === 'local') return '本地文件';
  return value || '未知来源';
}

function statusName(value: string) {
  const map: Record<string, string> = { ready: '可编辑', exported: '有导出', failed: '失败', imported: '已入库', success: '成功' };
  return map[value] || value || '未知';
}

function sourceNameForTag(value: string) {
  const map: Record<string, string> = { dictionary: '词典', machine: '机翻', manual: '手动', original: '原文' };
  return map[value] || value || '待确认';
}

function tagTypeName(type: string) {
  const map: Record<string, string> = { artist: '作者', group: '社团', category: '分类', parody: '作品', character: '角色', language: '语言', tag: '内容标签', other: '其他' };
  return map[type] || type || '其他';
}
