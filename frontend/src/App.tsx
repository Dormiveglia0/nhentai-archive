import { AlertTriangle, Archive, BookOpen, Check, Clock, Database, FileArchive, FileText, Folder, Grid2X2, Import, LayoutList, ListTodo, RefreshCw, Search, Shield, SlidersHorizontal, Tags, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import blossom from './assets/blossom.svg';
import { readerPages } from './assets/covers';
import { LoginPage } from './components/Auth';
import { Cover } from './components/Cover';
import { ActionBar, ExportRows, FileRows, FormLine, Info, MiniWorks, Page, PageHero, Panel, Progress, Splash, StatRail, TagChip, TaskDock, TaskList, Toggle, TopChrome } from './components/ui';
import { ApiClient, type AuthPayload } from './lib/api';
import { mockState, type AppState, type DictionaryTerm, type Gallery, type Work } from './lib/mock';
import type { View } from './lib/navigation';

const emptyState: AppState = {
  works: [],
  galleries: [],
  tasks: [],
  dictionary: [],
  exports: [],
  settings: mockState.settings
};

export function App() {
  const [token, setToken] = useState(() => localStorage.getItem('nh_token'));
  const [view, setView] = useState<View>('library');
  const [state, setState] = useState<AppState>(emptyState);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [readerId, setReaderId] = useState<number | null>(null);
  const [setupPending, setSetupPending] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const api = useMemo(() => new ApiClient(token), [token]);
  const selectedWork = state.works.find((work) => work.id === selectedId) || state.works[0] || null;

  useEffect(() => {
    api.setupStatus().then((status) => setNeedsSetup(status.needs_setup)).finally(() => setSetupPending(false));
  }, [api]);

  useEffect(() => {
    if (!token) return;
    api.appState().then((next) => {
      setState(next);
      const first = next.works[0]?.id ?? null;
      setSelectedId((current) => next.works.some((work) => work.id === current) ? current : first);
    }).catch(() => {
      localStorage.removeItem('nh_token');
      setToken(null);
    });
  }, [token, api]);

  function auth(payload: AuthPayload) {
    localStorage.setItem('nh_token', payload.token);
    setToken(payload.token);
  }

  function logout() {
    localStorage.removeItem('nh_token');
    setToken(null);
  }

  function go(next: View) {
    setView(next);
    setReaderId(null);
  }

  function chooseWork(work: Work, next?: View) {
    setSelectedId(work.id);
    if (next) setView(next);
  }

  if (setupPending) return <Splash />;
  if (!token) return <LoginPage needsSetup={needsSetup} onAuth={auth} />;

  return (
    <div className="app">
      <TopChrome view={readerId ? 'library' : view} state={state} onView={go} onLogout={logout} />
      <main className="main">
        {readerId && selectedWork ? <ReaderPage work={state.works.find((work) => work.id === readerId) || selectedWork} state={state} onClose={() => setReaderId(null)} onMetadata={(work) => chooseWork(work, 'metadata')} /> : null}
        {!readerId && view === 'dashboard' ? <DashboardPage state={state} onView={go} onWork={(work) => chooseWork(work, 'library')} /> : null}
        {!readerId && view === 'discover' ? <DiscoverPage state={state} onWork={chooseWork} /> : null}
        {!readerId && view === 'library' ? <LibraryPage state={state} selected={selectedWork} onSelect={chooseWork} onRead={(work) => setReaderId(work.id)} onMetadata={(work) => chooseWork(work, 'metadata')} /> : null}
        {!readerId && view === 'metadata' ? (selectedWork ? <MetadataPage work={selectedWork} state={state} onRead={(work) => setReaderId(work.id)} /> : <EmptyState title="没有可编辑的作品" action="先上传一个 CBZ" onAction={() => go('library')} />) : null}
        {!readerId && view === 'dictionary' ? <DictionaryPage state={state} /> : null}
        {!readerId && view === 'queue' ? <QueuePage state={state} /> : null}
        {!readerId && view === 'exports' ? <ExportsPage state={state} onWork={(work) => chooseWork(work, 'metadata')} /> : null}
        {!readerId && view === 'files' ? <FilesPage state={state} onWork={(work) => chooseWork(work, 'metadata')} /> : null}
        {!readerId && view === 'settings' ? <SettingsPage state={state} /> : null}
      </main>
      {!readerId ? <TaskDock tasks={state.tasks} onView={() => go('queue')} /> : null}
    </div>
  );
}

function EmptyState({ title, action, onAction }: { title: string; action: string; onAction: () => void }) {
  return <Page><PageHero title={title} seal="空库" desc="当前后端返回的是一个真实空库，不再显示假数据。上传本地 CBZ 后即可开始阅读、治理元数据并导出。" /><Panel title="开始使用"><p>请在“我的库”中上传一个 CBZ，或到“发现”里搜索远端作品。</p><button className="primary" onClick={onAction}>{action}</button></Panel></Page>;
}

function DashboardPage({ state, onView, onWork }: { state: AppState; onView: (view: View) => void; onWork: (work: Work) => void }) {
  return (
    <Page>
      <PageHero title="工作台" seal="档案" desc="快速进入馆藏、远端发现、任务处理与系统维护。" />
      <StatRail items={[
        { icon: <BookOpen />, label: '总收藏', value: state.works.length, hint: '本地 CBZ' },
        { icon: <Clock />, label: '阅读中', value: state.works.filter((w) => w.status === 'reading').length, hint: '继续阅读' },
        { icon: <Tags />, label: '词典词条', value: state.dictionary.length, hint: '已入库' },
        { icon: <ListTodo />, label: '运行任务', value: state.tasks.filter((t) => t.status === 'running').length, hint: '队列健康' },
        { icon: <Database />, label: '导出记录', value: state.exports.length, hint: 'CBZ' }
      ]} />
      <section className="dashboard-grid"><Panel title="最近入库" action={<button onClick={() => onView('library')}>打开我的库</button>}>{state.works.length ? <div className="mini-shelf">{state.works.slice(0, 5).map((work) => <button key={work.id} onClick={() => onWork(work)}><Cover src={work.cover} title={work.title} /><strong>{work.title}</strong><span>{work.pages}P · {work.language}</span></button>)}</div> : <p>暂无作品。请先上传 CBZ。</p>}</Panel><Panel title="今日任务"><TaskList tasks={state.tasks.slice(0, 5)} /></Panel></section>
    </Page>
  );
}

function DiscoverPage({ state, onWork }: { state: AppState; onWork: (work: Work) => void }) {
  const selected = state.galleries[0] || null;
  if (!selected) return <EmptyState title="发现页暂无远端数据" action="回到我的库" onAction={() => undefined} />;
  return <Page><PageHero title="发现 / 导入" seal="探索" desc="远端 API worker 尚未完成，本页会在后续 PR 接入。" /><div className="search-grid">{state.galleries.map((gallery: Gallery) => <article key={gallery.id}><button onClick={() => onWork(gallery)}><Cover src={gallery.cover} title={gallery.title} /><strong>{gallery.title}</strong></button></article>)}</div></Page>;
}

function LibraryPage({ state, selected, onSelect, onRead, onMetadata }: { state: AppState; selected: Work | null; onSelect: (work: Work) => void; onRead: (work: Work) => void; onMetadata: (work: Work) => void }) {
  if (!state.works.length || !selected) return <Page><PageHero title="我的库" seal="采藏" desc="这里显示真实后端库数据。当前为空，请上传一个 CBZ 开始。" /><Panel title="上传 CBZ"><form method="post" action="/api/library/upload" encType="multipart/form-data"><input type="file" name="file" accept=".cbz,.zip" /><button className="primary" type="submit">上传</button></form><p>上传后刷新页面即可看到作品。后续会补前端异步上传进度。</p></Panel></Page>;
  return (
    <Page>
      <PageHero title="我的库" seal="采藏" desc="专属的同人志档案馆。" />
      <section className="library-summary"><span>总收藏 <b>{state.works.length}</b></span><span>阅读中 <b>{state.works.filter((w) => w.status === 'reading').length}</b></span><span>待治理 <b>{state.works.filter((w) => w.status === 'needs_metadata').length}</b></span></section>
      <div className="library-layout"><main className="cover-wall">{state.works.map((work) => <article key={work.id} className={selected.id === work.id ? 'focused' : ''}><button onClick={() => onSelect(work)} onDoubleClick={() => onRead(work)}><Cover src={work.cover} title={work.title} /><strong>{work.title}</strong><small>{work.originalTitle}</small><span>{work.language} · {work.pages}P · {work.source}</span><div>{work.tags.slice(0, 3).map((tag) => <TagChip key={tag}>{tag}</TagChip>)}</div></button></article>)}</main><aside className="inspector library-inspector"><header><span>当前作品</span><button><X size={18} /></button></header><div className="work-line"><Cover src={selected.cover} title={selected.title} small /><div><h3>{selected.title}</h3><p>{selected.originalTitle}</p><span>{selected.language} · {selected.pages}P · {selected.source}</span></div></div><section><h4>标签</h4><div className="tag-row">{selected.tags.map((tag) => <TagChip key={tag}>{tag}</TagChip>)}</div></section><Progress label="阅读进度" value={selected.progress} /><Progress label="元数据完整度" value={selected.metadataScore} /><button className="primary wide" onClick={() => onRead(selected)}>继续阅读</button><div className="split"><button onClick={() => onMetadata(selected)}>编辑元数据</button><button>导出 CBZ</button></div></aside></div>
    </Page>
  );
}

function ReaderPage({ work, state, onClose, onMetadata }: { work: Work; state: AppState; onClose: () => void; onMetadata: (work: Work) => void }) {
  const [page, setPage] = useState(1);
  return <Page><PageHero title="阅读器" seal="私藏" desc="沉浸阅读。" /><div className="reader"><aside className="reader-left"><button className="back" onClick={onClose}>← 返回作品页</button><div className="work-line"><Cover src={work.cover} title={work.title} small /><div><strong>{work.title}</strong><span>{page} / {work.pages}</span></div></div></aside><main className="reader-stage"><div className="reader-toolbar"><button onClick={onClose}>返回库</button><button onClick={() => setPage(Math.max(1, page - 1))}>上一页</button><strong>{page} / {work.pages}</strong><button onClick={() => setPage(Math.min(work.pages, page + 1))}>下一页</button><Progress value={Math.round((page / Math.max(1, work.pages)) * 100)} slim /></div><div className="manga-page"><img src={readerPages[page % readerPages.length]} alt={`${work.title} page`} /></div></main><aside className="reader-right"><div className="work-line"><Cover src={work.cover} title={work.title} small /><div><h3>{work.title}</h3><p>{work.originalTitle}</p></div></div><Info label="页数" value={`${work.pages}`} /><Info label="语言" value={work.language} /><button className="primary wide" onClick={() => onMetadata(work)}>进入元数据</button></aside></div><section className="reader-bottom"><Panel title="阅读历史"><MiniWorks works={state.works.slice(0, 3)} /></Panel></section></Page>;
}

function MetadataPage({ work, state, onRead }: { work: Work; state: AppState; onRead: (work: Work) => void }) {
  const rows = [['标题', work.title], ['副标题', work.originalTitle], ['作者', work.author], ['社团', work.circle], ['语言', work.language], ['标签', work.tags.join('、')], ['页数', `${work.pages}P`]];
  return <Page><PageHero title="作品元数据" seal="治理" desc="维护作品元数据与标签。" /><section className="metadata-hero workspace-panel"><Cover src={work.cover} title={work.title} /><div><h2>{work.title}</h2><p>{work.originalTitle}</p></div><Info label="来源" value={work.source} /><Info label="页数" value={`${work.pages}P`} /><Progress label="完整度" value={work.metadataScore} /><button className="ghost" onClick={() => onRead(work)}>进入阅读</button></section><div className="metadata-layout"><main className="workspace-panel metadata-table"><header><h2>ComicInfo / 元数据对照编辑</h2></header>{rows.map((row) => <div className="compare-row" key={row[0]}><span>{row[0]}</span><span>{row[1]}</span><span>{row[1]}</span><span>{row[1]}</span><button>编辑</button></div>)}</main><aside className="metadata-side"><Panel title="标签治理看板"><div className="tag-row">{work.tags.map((tag) => <TagChip key={tag}>{tag}</TagChip>)}</div></Panel><Panel title="作品预览"><Cover src={work.cover} title={work.title} /></Panel></aside></div><ActionBar primary="保存修改" actions={['应用词典', '重新解析', '导出预览']} /></Page>;
}

function DictionaryPage({ state }: { state: AppState }) {
  const term = state.dictionary[0] || null;
  return <Page><PageHero title="词典治理" seal="词典" desc="统一术语规范，提升检索准确度。" />{term ? <div className="dictionary"><Panel title="候选术语池">{state.dictionary.map((item) => <button key={item.id}><span>{item.source}<TagChip>{item.type}</TagChip></span><strong>{item.zh}</strong><em>{item.works}</em><small>{termStatus(item.status)}</small></button>)}</Panel><Panel title="术语编辑器"><FormLine label="原文" value={term.source} /><FormLine label="中文名" value={term.zh} /></Panel></div> : <Panel title="暂无词条"><p>导入作品后会逐步产生标签词条。</p></Panel>}</Page>;
}

function QueuePage({ state }: { state: AppState }) {
  const active = state.tasks[0] || null;
  return <Page><PageHero title="任务中心" seal="采集" desc="追踪所有任务状态。" /><StatRail items={[{ icon: <Import />, label: '正在运行', value: state.tasks.filter((t) => t.status === 'running').length, hint: '任务' }, { icon: <Clock />, label: '等待中', value: state.tasks.filter((t) => t.status === 'queued').length, hint: '任务' }, { icon: <AlertTriangle />, label: '失败', value: state.tasks.filter((t) => t.status === 'failed').length, hint: '任务' }, { icon: <Check />, label: '已完成', value: state.tasks.filter((t) => t.status === 'done').length, hint: '任务' }, { icon: <Database />, label: '总任务', value: state.tasks.length, hint: '任务' }]} /><div className="queue-layout"><main className="workspace-panel task-table"><TaskList tasks={state.tasks} /></main>{active ? <aside className="inspector task-detail"><header><h2>{active.type}</h2></header><Info label="任务 ID" value={active.id} /><Progress label="总进度" value={active.progress} /></aside> : <aside className="inspector task-detail"><p>暂无任务。</p></aside>}</div></Page>;
}

function ExportsPage({ state, onWork }: { state: AppState; onWork: (work: Work) => void }) {
  return <Page><PageHero title="导出中心" seal="采集" desc="批量导出你的作品为 CBZ 格式。" /><StatRail items={[{ icon: <Clock />, label: '导出记录', value: state.exports.length, hint: '历史' }, { icon: <Archive />, label: '导出预设', value: 1, hint: '默认' }, { icon: <FileArchive />, label: '可导出作品', value: state.works.length, hint: '作品' }, { icon: <AlertTriangle />, label: '失败重试', value: state.exports.filter((e) => e.status === 'failed').length, hint: '任务' }, { icon: <Folder />, label: '输出目录', value: state.settings.exportDir || '-', hint: '路径' }]} /><Panel title="导出列表"><ExportRows exports={state.exports} works={state.works} onWork={onWork} /></Panel></Page>;
}

function FilesPage({ state, onWork }: { state: AppState; onWork: (work: Work) => void }) {
  return <Page><PageHero title="文件管理" seal="采检" desc="管理 Archive 系统文件。" /><StatRail items={[{ icon: <FileArchive />, label: '原始 CBZ', value: state.works.length, hint: '文件数' }, { icon: <Folder />, label: '导出文件', value: state.exports.length, hint: '文件数' }, { icon: <Archive />, label: '封面缓存', value: state.works.filter((w) => w.cover).length, hint: '文件数' }, { icon: <FileText />, label: '页面记录', value: state.works.reduce((n, w) => n + w.pages, 0), hint: '页' }, { icon: <Database />, label: '总作品', value: state.works.length, hint: '作品' }]} /><main className="workspace-panel file-table"><FileRows works={state.works} onWork={onWork} /></main></Page>;
}

function SettingsPage({ state }: { state: AppState }) {
  return <Page><PageHero title="设置" seal="档案" desc="管理系统行为、隐私安全、存储路径与阅读偏好。" /><div className="settings-layout"><aside className="settings-nav"><img src={blossom} alt="" />{['数据源与连接', '存储与路径', '隐私与安全', '阅读器', '外观', '导出', '维护与备份'].map((item, index) => <button className={index === 0 ? 'active' : ''} key={item}>{item}</button>)}</aside><main className="settings-main"><Panel title="A. 连接与同步"><div className="settings-grid"><FormLine label="请求间隔（毫秒）" value="1500" /><button className="primary">验证连接</button></div></Panel><Panel title="B. 本地存储"><div className="settings-grid"><FormLine label="下载目录" value={state.settings.dataDir} /><FormLine label="导出目录" value={state.settings.exportDir} /><FormLine label="最大缓存空间" value={state.settings.cacheLimit} /></div></Panel><Panel title="C. 隐私与阅读偏好"><div className="settings-grid toggles"><Toggle label="隐私模式默认开启" active /><Toggle label="封面模糊默认开启" active /><Toggle label="标题脱敏" /></div></Panel></main></div><ActionBar primary="保存设置" actions={['恢复默认', '取消更改', '立即重启']} /></Page>;
}

function termStatus(status: DictionaryTerm['status']) {
  return { pending: '待处理', configured: '已配置', ignored: '已忽略', review: '待复核' }[status];
}
