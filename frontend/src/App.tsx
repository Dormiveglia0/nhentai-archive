import {
  AlertTriangle,
  Archive,
  BookOpen,
  Check,
  ChevronDown,
  Clock,
  Database,
  FileArchive,
  FileText,
  Folder,
  Grid2X2,
  Import,
  LayoutList,
  ListTodo,
  MoreVertical,
  Pause,
  RefreshCw,
  Search,
  Shield,
  SlidersHorizontal,
  Tags,
  X
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import blossom from './assets/blossom.svg';
import { readerPages } from './assets/covers';
import { LoginPage } from './components/Auth';
import { Cover } from './components/Cover';
import { ActionBar, BulkBar, ExportRows, FileRows, FormLine, Info, MiniWorks, Page, PageHero, Panel, Progress, Splash, StatRail, TagChip, TaskDock, TaskList, TaskRows, Toggle, TopChrome } from './components/ui';
import { ApiClient, type AuthPayload } from './lib/api';
import { mockState, type AppState, type DictionaryTerm, type Gallery, type Work } from './lib/mock';
import type { View } from './lib/navigation';

export function App() {
  const [token, setToken] = useState(() => localStorage.getItem('nh_token'));
  const [view, setView] = useState<View>('library');
  const [state, setState] = useState<AppState>(mockState);
  const [selectedId, setSelectedId] = useState(1);
  const [readerId, setReaderId] = useState<number | null>(null);
  const [setupPending, setSetupPending] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const api = useMemo(() => new ApiClient(token), [token]);
  const selectedWork = state.works.find((work) => work.id === selectedId) || state.works[0];

  useEffect(() => {
    api.setupStatus().then((status) => setNeedsSetup(status.needs_setup)).finally(() => setSetupPending(false));
  }, [api]);

  useEffect(() => {
    if (!token) return;
    api.appState().then(setState).catch(() => {
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
        {readerId ? (
          <ReaderPage work={state.works.find((work) => work.id === readerId) || selectedWork} state={state} onClose={() => setReaderId(null)} onMetadata={(work) => chooseWork(work, 'metadata')} />
        ) : null}
        {!readerId && view === 'dashboard' ? <DashboardPage state={state} onView={go} onWork={(work) => chooseWork(work, 'library')} /> : null}
        {!readerId && view === 'discover' ? <DiscoverPage state={state} onWork={chooseWork} /> : null}
        {!readerId && view === 'library' ? <LibraryPage state={state} selected={selectedWork} onSelect={chooseWork} onRead={(work) => setReaderId(work.id)} onMetadata={(work) => chooseWork(work, 'metadata')} /> : null}
        {!readerId && view === 'metadata' ? <MetadataPage work={selectedWork} state={state} onRead={(work) => setReaderId(work.id)} /> : null}
        {!readerId && view === 'dictionary' ? <DictionaryPage state={state} /> : null}
        {!readerId && view === 'queue' ? <QueuePage state={state} onWork={(work) => chooseWork(work, 'library')} /> : null}
        {!readerId && view === 'exports' ? <ExportsPage state={state} onWork={(work) => chooseWork(work, 'metadata')} /> : null}
        {!readerId && view === 'files' ? <FilesPage state={state} onWork={(work) => chooseWork(work, 'metadata')} /> : null}
        {!readerId && view === 'settings' ? <SettingsPage state={state} /> : null}
      </main>
      {!readerId ? <TaskDock tasks={state.tasks} onView={() => go('queue')} /> : null}
    </div>
  );
}

function DashboardPage({ state, onView, onWork }: { state: AppState; onView: (view: View) => void; onWork: (work: Work) => void }) {
  return (
    <Page>
      <PageHero title="工作台" seal="档案" desc="快速进入馆藏、远端发现、任务处理与系统维护。" />
      <StatRail items={[
        { icon: <BookOpen />, label: '总收藏', value: state.works.length, hint: '本地 CBZ' },
        { icon: <Clock />, label: '阅读中', value: state.works.filter((w) => w.status === 'reading').length, hint: '继续阅读' },
        { icon: <Tags />, label: '词典命中', value: 562, hint: '今日新增 82' },
        { icon: <ListTodo />, label: '运行任务', value: state.tasks.filter((t) => t.status === 'running').length, hint: '队列健康' },
        { icon: <Database />, label: '总容量', value: '2.34 TB', hint: 'Archive' }
      ]} />
      <section className="dashboard-grid">
        <Panel title="最近入库" action={<button onClick={() => onView('library')}>打开我的库</button>}>
          <div className="mini-shelf">
            {state.works.slice(0, 5).map((work) => <button key={work.id} onClick={() => onWork(work)}><Cover src={work.cover} title={work.title} /><strong>{work.title}</strong><span>{work.pages}P · {work.language}</span></button>)}
          </div>
        </Panel>
        <Panel title="今日任务">
          <TaskList tasks={state.tasks.slice(0, 5)} />
        </Panel>
      </section>
    </Page>
  );
}

function DiscoverPage({ state, onWork }: { state: AppState; onWork: (work: Work) => void }) {
  const [selected, setSelected] = useState<Gallery>(state.galleries[0]);
  return (
    <Page>
      <PageHero title="发现 / 导入" seal="探索" desc="从远端源发现同人志，支持画廊 ID、批量 ID、CBZ 上传与目录扫描。" />
      <section className="tabs-line">{['最新', '热门', '随机', '远端搜索', '画廊 ID', '批量 ID', '上传 CBZ', '扫描目录'].map((tab, index) => <button className={index === 0 ? 'active' : ''} key={tab}>{tab}</button>)}</section>
      <div className="discover">
        <main className="workspace-panel">
          <div className="filter-grid discover-filters">
            <label><span>关键词</span><div className="input-icon"><input placeholder="搜索标题、社团、角色、标签..." /><Search size={17} /></div></label>
            <label><span>标签</span><div className="chip-input"><TagChip>百合</TagChip><TagChip>校园</TagChip><TagChip>日语</TagChip></div></label>
            <label><span>语言</span><select><option>全部</option></select></label>
            <label><span>类型</span><select><option>全部</option></select></label>
            <label><span>排序</span><select><option>最新发布</option></select></label>
            <label className="switch-line"><span>仅显示未入库</span><Toggle label="" /></label>
          </div>
          <div className="result-toolbar"><span>找到 1,248 个结果（缓存于 12:48）</span><button><RefreshCw size={15} /></button><button className="active"><Grid2X2 size={16} />网格</button><button><LayoutList size={16} />列表</button></div>
          <div className="search-grid">
            {state.galleries.map((gallery) => (
              <article key={gallery.id} className={selected.id === gallery.id ? 'selected' : ''}>
                <button onClick={() => setSelected(gallery)}><Cover src={gallery.cover} title={gallery.title} /><div><strong>{gallery.title}</strong><small>{gallery.circle}</small><span><FileText size={13} />{gallery.pages} 页 <FileArchive size={13} />{gallery.language}</span></div></button>
                <footer><button onClick={() => onWork(gallery)}>{gallery.imported ? '打开本地' : '预览'}</button><button className="solid">{gallery.imported ? '已入库' : '导入'}</button><button><MoreVertical size={15} /></button></footer>
              </article>
            ))}
          </div>
        </main>
        <aside className="inspector detail-card">
          <header><h2>作品详情</h2><button><X size={18} /></button></header>
          <Cover src={selected.cover} title={selected.title} />
          <h3>{selected.title}</h3>
          <p>{selected.circle}</p>
          <dl><Info label="Gallery ID" value={selected.sourceId} /><Info label="页数" value={`${selected.pages}`} /><Info label="语言" value={selected.language} /><Info label="大小" value={selected.size} /></dl>
          <div className="tag-row">{selected.tags.map((tag) => <TagChip key={tag}>{tag}</TagChip>)}</div>
          <section><h4>相关作品</h4><div className="related-covers">{selected.related.map((id) => state.works.find((w) => w.id === id)).filter(Boolean).map((work) => <Cover key={work!.id} src={work!.cover} title={work!.title} small />)}</div></section>
          <button className="primary wide">加入导入队列</button><button className="ghost wide">打开本地</button>
        </aside>
      </div>
    </Page>
  );
}

function LibraryPage({ state, selected, onSelect, onRead, onMetadata }: { state: AppState; selected: Work; onSelect: (work: Work) => void; onRead: (work: Work) => void; onMetadata: (work: Work) => void }) {
  const selectedWorks = [2, 4, 8];
  return (
    <Page>
      <PageHero title="我的库" seal="采藏" desc="专属的同人志档案馆，珍藏每一份热爱。" />
      <section className="library-summary"><span>总收藏 <b>1,246</b></span><span>已读 <b>682</b></span><span>阅读中 <b>356</b></span><span>待治理 <b>208</b></span><span>总容量 <b>2.34 TB</b></span></section>
      <div className="filter-grid library-filter">
        {['语言 全部语言', '状态 全部状态', '来源 全部来源', '标签 选择标签', '团子 选择团子', '作者 选择作者', '页数 任意页数', '导出状态 全部', '排序 最新添加'].map((item) => <button key={item}>{item}<ChevronDown size={14} /></button>)}
        <button><RefreshCw size={14} />重置</button><button className="icon-only active"><Grid2X2 size={17} /></button><button className="icon-only"><LayoutList size={17} /></button>
      </div>
      <div className="library-layout">
        <main className="cover-wall">
          {state.works.map((work) => (
            <article key={work.id} className={`${selected.id === work.id ? 'focused' : ''} ${selectedWorks.includes(work.id) ? 'checked' : ''}`}>
              <button onClick={() => onSelect(work)} onDoubleClick={() => onRead(work)}>
                <Cover src={work.cover} title={work.title} />
                <strong>{work.title}</strong>
                <small>{work.originalTitle}</small>
                <span>{work.language} · {work.pages}P · {work.source}</span>
                <div>{work.tags.slice(0, 3).map((tag) => <TagChip key={tag}>{tag}</TagChip>)}</div>
              </button>
            </article>
          ))}
        </main>
        <aside className="inspector library-inspector">
          <header><span>已选择 4 项</span><button><X size={18} /></button></header>
          <div className="work-line"><Cover src={selected.cover} title={selected.title} small /><div><h3>{selected.title}<TagChip>R-18</TagChip></h3><p>{selected.originalTitle}</p><span>{selected.language} · {selected.pages}P · {selected.source}</span></div></div>
          <Info label="文件路径" value={`D:\\NH Archive\\Library\\${selected.originalTitle}.cbz`} />
          <section><h4>标签</h4><div className="tag-row">{selected.tags.map((tag) => <TagChip key={tag}>{tag}</TagChip>)}<button className="chip-add">+</button></div></section>
          <Progress label="阅读进度" value={selected.progress} />
          <Progress label="元数据完整度" value={selected.metadataScore} />
          <Info label="词典命中" value="36 个匹配项" />
          <button className="primary wide" onClick={() => onRead(selected)}>继续阅读</button>
          <div className="split"><button onClick={() => onMetadata(selected)}>编辑元数据</button><button>导出 CBZ</button></div>
          <button className="ghost wide">更多操作 <ChevronDown size={14} /></button>
        </aside>
      </div>
      <BulkBar />
    </Page>
  );
}

function ReaderPage({ work, state, onClose, onMetadata }: { work: Work; state: AppState; onClose: () => void; onMetadata: (work: Work) => void }) {
  const [page, setPage] = useState(12);
  return (
    <Page>
      <PageHero title="阅读器" seal="私藏" desc="沉浸阅读，专注每一个故事。" />
      <div className="reader">
        <aside className="reader-left">
          <button className="back" onClick={onClose}>← 返回作品页</button>
          <div className="work-line"><Cover src={work.cover} title={work.title} small /><div><strong>{work.title}</strong><span>已读 {page} / {work.pages} 页 · {work.progress}%</span></div></div>
          <h3>章节列表</h3>
          {Array.from({ length: 7 }, (_, i) => i + 8).map((item) => <button key={item} className={item === page ? 'active' : ''} onClick={() => setPage(item)}><Cover src={work.cover} title={work.title} small /><span>{item}</span><MoreVertical size={14} /></button>)}
          <button className="ghost wide">跳转到页面</button>
        </aside>
        <main className="reader-stage">
          <div className="reader-toolbar"><button onClick={onClose}>返回库</button><button>目录</button><button onClick={() => setPage(Math.max(1, page - 1))}>上一页</button><strong>{page} / {work.pages}</strong><button onClick={() => setPage(Math.min(work.pages, page + 1))}>下一页</button><Progress value={Math.round((page / work.pages) * 100)} slim /><button>隐私遮罩</button></div>
          <div className="manga-page"><img src={readerPages[page % readerPages.length]} alt={`${work.title} page`} /></div>
        </main>
        <aside className="reader-right">
          <div className="tab-head"><button className="active">作品信息</button><button>阅读设置</button></div>
          <div className="work-line"><Cover src={work.cover} title={work.title} small /><div><h3>{work.title}<TagChip>R-18</TagChip></h3><p>{work.originalTitle}</p></div></div>
          <Info label="页数" value={`${work.pages}`} /><Info label="语言" value={work.language} /><Info label="上传" value="2024-05-12 18:32" /><Info label="大小" value={work.size} />
          <Progress label="当前进度" value={Math.round((page / work.pages) * 100)} />
          <div className="segmented"><button className="active">单页</button><button>双页</button><button>连续滚动</button></div>
          <button className="primary wide" onClick={() => onMetadata(work)}>进入元数据</button>
        </aside>
      </div>
      <section className="reader-bottom"><Panel title="阅读历史"><MiniWorks works={state.works.slice(0, 3)} /></Panel><Panel title="最近笔记"><p>P.12 · 这页的光影处理好细腻。</p></Panel><Panel title="相关作品"><MiniWorks works={state.works.slice(1, 5)} /></Panel></section>
    </Page>
  );
}

function MetadataPage({ work, state, onRead }: { work: Work; state: AppState; onRead: (work: Work) => void }) {
  const rows = [
    ['标题', work.title, work.title, work.title, '采用来源值'],
    ['副标题', work.originalTitle, '-', '-', '清空'],
    ['作者', work.author, work.author, work.author, '采用来源值'],
    ['社团', work.circle, work.circle, work.circle, '采用来源值'],
    ['语言', work.language, work.language, work.language, '-'],
    ['标签', work.tags.join('、'), `${work.tags.join('、')}、+2`, work.tags.join('、'), '管理标签'],
    ['简介', '放课后，在教室里度过秘密的时间。', '放课后，在教室里度过秘密的时间。', '放课后，在教室里度过秘密的时间。', '使用机器'],
    ['页数', `${work.pages}P`, `${work.pages}P`, `${work.pages}P`, '-']
  ];
  return (
    <Page>
      <PageHero title="作品元数据" seal="治理" desc="维护作品元数据与标签，统一标准，提高质量。" />
      <section className="metadata-hero workspace-panel"><Cover src={work.cover} title={work.title} /><div><h2>{work.title}<TagChip>R-18</TagChip></h2><p>{work.originalTitle}</p></div><Info label="来源" value={work.source} /><Info label="页数" value={`${work.pages}P`} /><Progress label="完整度" value={work.metadataScore} /><button className="ghost" onClick={() => onRead(work)}>进入阅读</button></section>
      <div className="metadata-layout">
        <main className="workspace-panel metadata-table">
          <header><h2>ComicInfo / 元数据对照编辑</h2><label><input type="checkbox" />仅显示有差异</label><button>批量操作 <ChevronDown size={14} /></button></header>
          <div className="compare-head"><span>字段</span><span>当前值（库内）</span><span>来源值（解析）</span><span>机器建议</span><span>操作</span></div>
          {rows.map((row, index) => <div className="compare-row" key={row[0]}><i className={index % 3 === 0 ? 'green' : index % 3 === 1 ? 'amber' : 'red'} /><span>{row[0]}</span><span>{row[1]}</span><span>{row[2]}</span><span>{row[3]}</span><button>{row[4]}</button></div>)}
        </main>
        <aside className="metadata-side">
          <Panel title="标签治理看板" action={<button>管理标签词典</button>}>{['作者与社团', '原作与角色', '内容标签', '语言与分类', '其他'].map((group, index) => <section className="tag-board" key={group}><h4>{group}</h4><div><TagChip>{work.tags[index % work.tags.length]}</TagChip><TagChip>{index ? '待确认' : '100%'}</TagChip></div><small>已确认 {index + 1} · 冲突 {index === 2 ? 1 : 0}</small></section>)}</Panel>
          <Panel title="作品预览"><Cover src={work.cover} title={work.title} /><Info label="文件名" value={`${work.title}.cbz`} /><Info label="文件大小" value={work.size} /></Panel>
          <Panel title="词典覆盖统计"><div className="donut">77%</div><Progress label="导出就绪度" value={82} /></Panel>
        </aside>
      </div>
      <ActionBar primary="保存修改" actions={['应用词典', '生成机器建议', '重新解析', '导出预览']} />
    </Page>
  );
}

function DictionaryPage({ state }: { state: AppState }) {
  const [term, setTerm] = useState<DictionaryTerm>(state.dictionary[0]);
  return (
    <Page>
      <PageHero title="词典治理" seal="词典" desc="统一术语规范，提升检索准确度与标签一致性。" />
      <StatRail items={[{ icon: <FileText />, label: '未配置', value: '1,248', hint: '候选' }, { icon: <Shield />, label: '已配置', value: '9,842', hint: '词条' }, { icon: <X />, label: '已忽略', value: 312, hint: '术语' }, { icon: <Clock />, label: '待复核', value: 158, hint: '候选' }, { icon: <Tags />, label: '机器建议', value: 562, hint: '今日新增 82' }]} />
      <div className="dictionary">
        <Panel title="候选术语池" action={<RefreshCw size={16} />}>
          <div className="term-filters"><select><option>全部</option></select><select><option>全部</option></select><select><option>全部</option></select><input placeholder="搜索原文或建议翻译..." /></div>
          <div className="term-list">{state.dictionary.map((item) => <button className={term.id === item.id ? 'active' : ''} key={item.id} onClick={() => setTerm(item)}><span>{item.source}<TagChip>{item.type}</TagChip></span><strong>{item.zh}</strong><em>{item.works}</em><small>{termStatus(item.status)}</small></button>)}</div>
        </Panel>
        <Panel title="术语编辑器" badge="待处理">
          <FormLine label="原文" value={term.source} /><FormLine label="中文名" value={term.zh} /><FormLine label="别名" value={term.aliases.join('、') || '添加别名后回车'} /><FormLine label="类型" value={term.type} /><label className="textarea-line"><span>备注</span><textarea defaultValue="常见于插画作品标题，中文圈多译为当前译名。" /></label>
          <Info label="机器建议" value={`${term.zh} · 置信度 ${term.confidence}%`} />
          <div className="split"><button className="primary">写入词典</button><button>保存修改</button><button>忽略</button><button>加入复核</button></div>
        </Panel>
        <Panel title="证据面板">
          <div className="tab-head"><button className="active">关联作品</button><button>搭配与标签</button><button>远端信息</button><button>历史记录</button></div>
          <MiniWorks works={state.works.slice(0, 4)} />
          <h4>常见搭配（标签）</h4><div className="tag-row">{['冬季', '雪', '少女', '静谧', '治愈', '风景'].map((tag) => <TagChip key={tag}>{tag}</TagChip>)}</div>
          <Info label="影响范围" value={`作品 ${term.works} → 标签 ${term.hits}`} />
        </Panel>
      </div>
      <section className="apply-preview workspace-panel"><h2>应用预览</h2><Info label="将更新标签" value="142" /><Info label="将影响作品" value="66" /><MiniWorks works={state.works.slice(1, 4)} /><Info label="标签更新对比" value={`${term.source} → ${term.zh}`} /><Info label="冲突项" value="3" /></section>
    </Page>
  );
}

function QueuePage({ state, onWork }: { state: AppState; onWork: (work: Work) => void }) {
  const active = state.tasks[0];
  return (
    <Page>
      <PageHero title="任务中心" seal="采集" desc="追踪所有任务的状态与进度，确保每一次处理都可靠完成。" />
      <StatRail items={[{ icon: <Import />, label: '正在运行', value: 3, hint: '较昨日 +1' }, { icon: <Clock />, label: '等待中', value: 7, hint: '较昨日 -2' }, { icon: <AlertTriangle />, label: '失败', value: 2, hint: '较昨日 +1' }, { icon: <Check />, label: '已完成', value: 28, hint: '较昨日 +8' }, { icon: <Database />, label: '今日吞吐量', value: 128, hint: '较昨日 +22%' }]} />
      <div className="queue-layout">
        <main className="workspace-panel task-table">
          <div className="tabs-line compact">{['正在运行', '等待中', '失败', '已完成', '导出记录'].map((tab, i) => <button className={i === 0 ? 'active' : ''} key={tab}>{tab}</button>)}</div>
          <TaskRows tasks={state.tasks} />
        </main>
        <aside className="inspector task-detail"><header><h2>{active.type}</h2><X size={18} /></header><span className="status-dot">正在运行</span><Info label="任务 ID" value={active.id} /><div className="work-line"><Cover src={state.works[0].cover} title={active.title} small /><div><h3>{active.title}</h3><span>{active.target}</span></div></div><Progress label="总进度" value={active.progress} /><Info label="速度" value="8.6 MB/s" /><Info label="当前文件" value="003.jpg (128.4 MB)" /><button className="primary wide"><Pause size={16} />暂停任务</button><button className="ghost wide">查看日志</button></aside>
      </div>
    </Page>
  );
}

function ExportsPage({ state, onWork }: { state: AppState; onWork: (work: Work) => void }) {
  return (
    <Page>
      <PageHero title="导出中心" seal="采集" desc="批量导出你的作品为 CBZ 格式，或按预设规则打包与整理。" />
      <StatRail items={[{ icon: <Clock />, label: '导出记录', value: 126, hint: '查看历史记录' }, { icon: <Archive />, label: '导出预设', value: 8, hint: '管理预设方案' }, { icon: <FileArchive />, label: '批量导出', value: 12, hint: '待处理任务' }, { icon: <AlertTriangle />, label: '失败重试', value: 3, hint: '可重试任务' }, { icon: <Folder />, label: '输出目录', value: 'D:\\NH', hint: '可用空间 1.24 TB' }]} />
      <div className="export-layout">
        <main>
          <Panel title="待导出列表（已选择 4 项）" action={<button>批量操作 <ChevronDown size={14} /></button>}>
            <ExportRows exports={state.exports} works={state.works} onWork={onWork} />
          </Panel>
          <Panel title="导出预设（当前：默认预设 v2）"><div className="preset-grid"><Info label="命名规则" value="{title} ({circle}).cbz" /><Info label="ComicInfo 写入规则" value="完整写入（覆盖缺失项）" /><Info label="压缩方式" value="ZIP - 最佳压缩" /><Info label="输出目录" value="D:\\NH Archive\\Export" /></div><button className="primary wide">开始导出</button></Panel>
        </main>
        <aside className="inspector export-preview"><header><h2>导出预览</h2><X size={18} /></header>{state.exports.map((item) => <div className="work-line" key={item.id}><Cover src={state.works.find((w) => w.id === item.workId)?.cover || state.works[0].cover} title={item.filename} small /><div><strong>{item.filename}</strong><span>{item.size}</span></div></div>)}<h4>将生成的新文件</h4>{['将生成新 CBZ', '写入 ComicInfo.xml', '默认保留 meta.json', '不会修改原始 CBZ'].map((x) => <span className="check-row" key={x}><Check size={15} />{x}</span>)}</aside>
      </div>
    </Page>
  );
}

function FilesPage({ state, onWork }: { state: AppState; onWork: (work: Work) => void }) {
  return (
    <Page>
      <PageHero title="文件管理" seal="采检" desc="管理 Archive 系统文件，检查数据完整性，清理冗余文件并维护存储健康。" />
      <StatRail items={[{ icon: <FileArchive />, label: '原始 CBZ', value: '12,346', hint: '文件数' }, { icon: <Folder />, label: '导出文件', value: '8,752', hint: '文件数' }, { icon: <Archive />, label: '封面缓存', value: '98,421', hint: '43.6 GB' }, { icon: <FileText />, label: '页面缓存', value: '1,248,932', hint: '312.7 GB' }, { icon: <Database />, label: '总占用', value: '2.34 TB', hint: '占用存储' }]} />
      <div className="files-layout">
        <main className="workspace-panel file-table"><header><h2>文件浏览</h2><select><option>全部类型</option></select><div className="input-icon"><input placeholder="搜索 文件名 / 路径 / 画廊 ID / 标签..." /><Search size={16} /></div><button><SlidersHorizontal size={16} />高级筛选</button></header><FileRows works={state.works} onWork={onWork} /></main>
        <aside className="file-side"><Panel title="健康检查">{['损坏 archive 2', '缺失封面 1', '缺失文件 1', '孤儿记录 36', '孤儿文件 42'].map((item) => <Info key={item} label={item.split(' ')[0]} value={item.split(' ')[1]} />)}<button className="ghost wide">立即检查</button></Panel><Panel title="重复检查"><Info label="Hash 相同" value="28" /><Info label="Gallery ID 相同" value="17" /><Info label="标题相似" value="39" /><button className="ghost wide">查找重复</button></Panel><Panel title="清理工具"><Info label="tmp 文件" value="1.32 GB" /><Info label="失效封面" value="2.18 GB" /><button className="ghost wide">深度清理</button></Panel></aside>
      </div>
    </Page>
  );
}

function SettingsPage({ state }: { state: AppState }) {
  return (
    <Page>
      <PageHero title="设置" seal="档案" desc="管理系统行为、隐私安全、存储路径与阅读偏好。" />
      <div className="settings-layout">
        <aside className="settings-nav"><img src={blossom} alt="" />{['数据源与连接', '存储与路径', '隐私与安全', '阅读器', '外观', '导出', '维护与备份'].map((item, index) => <button className={index === 0 ? 'active' : ''} key={item}>{item}</button>)}</aside>
        <main className="settings-main">
          <Panel title="A. 连接与同步"><div className="settings-grid"><FormLine label="COMITIA API Key" value="••••••••••••••••" /><FormLine label="Booth API Token" value="输入你的 Booth Token" /><FormLine label="请求间隔（毫秒）" value="1500" /><button className="primary">验证连接</button></div><div className="status-chips"><TagChip>COMITIA 已连接</TagChip><TagChip>Booth 未配置</TagChip><TagChip>速率限制 正常</TagChip></div></Panel>
          <Panel title="B. 本地存储"><div className="settings-grid"><FormLine label="下载目录" value={state.settings.dataDir} /><FormLine label="导出目录" value={state.settings.exportDir} /><FormLine label="缓存目录" value="D:\\NH Archive\\Cache" /><FormLine label="最大缓存空间" value={state.settings.cacheLimit} /></div></Panel>
          <Panel title="C. 隐私与阅读偏好"><div className="settings-grid toggles"><Toggle label="隐私模式默认开启" active /><Toggle label="封面模糊默认开启" active /><Toggle label="标题脱敏" /><FormLine label="自动锁定" value="10 分钟" /><FormLine label="默认阅读模式" value="单页" /><FormLine label="默认缩放" value="近宽度" /></div></Panel>
          <Panel title="D. 界面与系统维护"><div className="settings-grid"><FormLine label="主题" value="跟随系统" /><FormLine label="界面密度" value="标准" /><FormLine label="语言" value="简体中文" /><button>立即备份</button><button>立即清理</button><button>开始重建索引</button></div></Panel>
        </main>
        <aside className="settings-side"><Panel title="配置摘要"><Info label="隐私模式默认" value="开启" /><Info label="封面模糊默认" value="开启" /><Info label="缓存空间上限" value="20 GB" /><Info label="当前主题" value="跟随系统" /></Panel><Panel title="最近操作"><Info label="隐私模式默认开启" value="刚刚" /><Info label="缓存空间上限修改为20GB" value="5 分钟前" /></Panel></aside>
      </div>
      <ActionBar primary="保存设置" actions={['恢复默认', '取消更改', '立即重启']} />
    </Page>
  );
}

function termStatus(status: DictionaryTerm['status']) {
  return { pending: '待处理', configured: '已配置', ignored: '已忽略', review: '待复核' }[status];
}
