import {
  BarChart3,
  BookOpen,
  Check,
  Database,
  Download,
  Eye,
  EyeOff,
  FileArchive,
  Folder,
  Languages,
  Library,
  LockKeyhole,
  Menu,
  RefreshCw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Workflow,
  Wrench,
  X,
} from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useEffect, useState } from "react";

import { duration, ease, usePrefersReducedMotion } from "../../lib/motion";
import "./FrontendDemo.css";

type SectionId = "connection" | "translation" | "privacy" | "export" | "data" | "storage";

const GLOBAL_NAV = [
  { label: "工作台", icon: Wrench },
  { label: "我的库", icon: Library },
  { label: "发现", icon: Search },
  { label: "治理", icon: BookOpen },
  { label: "词典", icon: Languages },
  { label: "队列", icon: Workflow },
  { label: "导出", icon: Download },
  { label: "文件", icon: FileArchive },
  { label: "设置", icon: Settings },
] as const;

const SECTIONS: {
  id: SectionId;
  title: string;
  index: string;
  summary: string;
  icon: typeof Settings;
}[] = [
  { id: "connection", title: "连接", index: "01", summary: "远端接口与运行环境", icon: Database },
  { id: "translation", title: "翻译", index: "02", summary: "服务、语言与批量建议", icon: Languages },
  { id: "privacy", title: "隐私阅读", index: "03", summary: "默认保护与阅读方式", icon: EyeOff },
  { id: "export", title: "导出", index: "04", summary: "CBZ 打包的默认行为", icon: Download },
  { id: "data", title: "数据", index: "05", summary: "本地馆藏与索引状态", icon: BarChart3 },
  { id: "storage", title: "存储", index: "06", summary: "目录、源文件与空间", icon: Folder },
];

export function FrontendDemo() {
  const reduceMotion = usePrefersReducedMotion();
  const [active, setActive] = useState<SectionId>("connection");
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [keyVisible, setKeyVisible] = useState(false);
  const [provider, setProvider] = useState<"google_free" | "deepl">("google_free");
  const [targetLanguage, setTargetLanguage] = useState<"zh-CN" | "zh-TW">("zh-CN");
  const [batchLimit, setBatchLimit] = useState(20);
  const [privacy, setPrivacy] = useState(true);
  const [blurCovers, setBlurCovers] = useState(true);
  const [readerMode, setReaderMode] = useState<"single" | "scroll">("single");
  const [exportOptions, setExportOptions] = useState({ comicInfo: true, json: true, compress: true });

  const current = SECTIONS.find((section) => section.id === active) ?? SECTIONS[0];

  useEffect(() => {
    const previous = document.title;
    document.title = "NH Archive · 前端演示";
    return () => {
      document.title = previous;
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function announce(message: string) {
    setNotice(message);
  }

  function selectSection(section: SectionId) {
    setActive(section);
    setMenuOpen(false);
  }

  function resetDemo() {
    setApiKey("");
    setProvider("google_free");
    setTargetLanguage("zh-CN");
    setBatchLimit(20);
    setPrivacy(true);
    setBlurCovers(true);
    setReaderMode("single");
    setExportOptions({ comicInfo: true, json: true, compress: true });
    announce("已恢复演示页初始状态。未读取任何本地配置。");
  }

  return (
    <div className="folio-demo">
      <div className="folio-demo-shell">
        <header className="folio-demo-masthead">
          <button className="folio-demo-brand" type="button" onClick={() => selectSection("connection")}>
            <span>NH</span>
            <span>
              <strong>Archive</strong>
              <small>local collection</small>
            </span>
          </button>

          <nav className="folio-demo-global-nav" aria-label="全局导航">
            {GLOBAL_NAV.map((item) => (
              <button
                key={item.label}
                type="button"
                className={item.label === "设置" ? "active" : ""}
                aria-current={item.label === "设置" ? "page" : undefined}
                onClick={() =>
                  item.label === "设置"
                    ? selectSection("connection")
                    : announce("本轮公开演示只开放设置模块，未连接真实业务数据。")
                }
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="folio-demo-mast-actions">
            <button
              className={`folio-demo-privacy${privacy ? " active" : ""}`}
              type="button"
              aria-pressed={privacy}
              onClick={() => setPrivacy((value) => !value)}
            >
              <LockKeyhole size={15} />
              <span>隐私模式</span>
              <strong>{privacy ? "开启" : "关闭"}</strong>
            </button>
            <button
              className="folio-demo-menu-button"
              type="button"
              aria-label={menuOpen ? "关闭导航" : "打开导航"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((value) => !value)}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </header>

        <AnimatePresence>
          {menuOpen ? (
            <m.nav
              className="folio-demo-mobile-menu"
              aria-label="移动端全局导航"
              initial={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
              transition={{ duration: duration.fast, ease: ease.standard }}
            >
              {GLOBAL_NAV.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    type="button"
                    className={item.label === "设置" ? "active" : ""}
                    onClick={() =>
                      item.label === "设置"
                        ? selectSection("connection")
                        : announce("本轮公开演示只开放设置模块，未连接真实业务数据。")
                    }
                  >
                    <Icon size={17} />
                    {item.label}
                  </button>
                );
              })}
            </m.nav>
          ) : null}
        </AnimatePresence>

        <div className="folio-demo-workspace">
          <aside className="folio-demo-index">
            <div className="folio-demo-index-title">
              <span>Settings</span>
              <h1>设置</h1>
              <p>一册只属于本机的配置索引。</p>
            </div>

            <nav className="folio-demo-section-nav" aria-label="设置章节">
              {SECTIONS.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    type="button"
                    className={active === section.id ? "active" : ""}
                    aria-current={active === section.id ? "page" : undefined}
                    onClick={() => selectSection(section.id)}
                  >
                    <span className="folio-demo-section-number">{section.index}</span>
                    <span className="folio-demo-section-copy">
                      <strong>{section.title}</strong>
                      <small>{section.summary}</small>
                    </span>
                    <Icon className="folio-demo-section-icon" size={16} />
                  </button>
                );
              })}
            </nav>

            <div className="folio-demo-index-note">
              <ShieldCheck size={18} />
              <p>公开原型不读取数据库、目录或密钥。</p>
            </div>
          </aside>

          <div className="folio-demo-page-wrap">
            <AnimatePresence mode="wait" initial={false}>
              <m.main
                key={active}
                className="folio-demo-page"
                initial={{ opacity: 0, y: reduceMotion ? 0 : 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
                transition={{ duration: duration.base, ease: ease.standard }}
              >
                <header className="folio-demo-page-head">
                  <div>
                    <h2>{current.title}</h2>
                    <p>{current.summary}</p>
                  </div>
                  <span aria-hidden="true">{current.index}</span>
                </header>

                <div className="folio-demo-page-content">
                  {active === "connection" ? (
                    <ConnectionPanel
                      apiKey={apiKey}
                      keyVisible={keyVisible}
                      onApiKey={setApiKey}
                      onKeyVisible={() => setKeyVisible((value) => !value)}
                      announce={announce}
                    />
                  ) : null}
                  {active === "translation" ? (
                    <TranslationPanel
                      provider={provider}
                      targetLanguage={targetLanguage}
                      batchLimit={batchLimit}
                      onProvider={setProvider}
                      onTargetLanguage={setTargetLanguage}
                      onBatchLimit={setBatchLimit}
                      announce={announce}
                    />
                  ) : null}
                  {active === "privacy" ? (
                    <PrivacyPanel
                      privacy={privacy}
                      blurCovers={blurCovers}
                      readerMode={readerMode}
                      onPrivacy={setPrivacy}
                      onBlurCovers={setBlurCovers}
                      onReaderMode={setReaderMode}
                    />
                  ) : null}
                  {active === "export" ? (
                    <ExportPanel options={exportOptions} onOptions={setExportOptions} />
                  ) : null}
                  {active === "data" ? (
                    <UnavailablePanel
                      title="演示环境未连接本地馆藏"
                      copy="这里不会生成统计数字。接入真实后端后，再显示馆藏、阅读进度和语言分布。"
                      icon={BarChart3}
                    />
                  ) : null}
                  {active === "storage" ? (
                    <UnavailablePanel
                      title="演示环境不读取本机目录"
                      copy="路径、磁盘占用和可回收空间均保持空白，避免在公开部署中泄露本地信息。"
                      icon={Folder}
                    />
                  ) : null}
                </div>

                <footer className="folio-demo-command-bar">
                  <p>
                    <span />
                    仅保存当前浏览器会话
                  </p>
                  <div>
                    <button type="button" onClick={resetDemo}>
                      <RefreshCw size={15} />
                      重新读取
                    </button>
                    <button
                      className="primary"
                      type="button"
                      onClick={() => announce("演示设置已保存于当前页面；未写入服务器或本地文件。")}
                    >
                      <Save size={15} />
                      保存设置
                    </button>
                  </div>
                </footer>
              </m.main>
            </AnimatePresence>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {notice ? (
          <m.div
            className="folio-demo-notice"
            role="status"
            initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
            transition={{ duration: duration.fast, ease: ease.standard }}
          >
            <Check size={16} />
            {notice}
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function ConnectionPanel({
  apiKey,
  keyVisible,
  onApiKey,
  onKeyVisible,
  announce,
}: {
  apiKey: string;
  keyVisible: boolean;
  onApiKey: (value: string) => void;
  onKeyVisible: () => void;
  announce: (message: string) => void;
}) {
  return (
    <section className="folio-demo-panel" aria-labelledby="folio-connection-title">
      <div className="folio-demo-panel-title">
        <div>
          <h3 id="folio-connection-title">数据源与连接</h3>
          <p>配置远端接口；敏感值不会在界面中回显明文。</p>
        </div>
        <p className="folio-demo-state"><span />连接未就绪</p>
      </div>

      <div className="folio-demo-form-grid">
        <label className="wide">
          <span>NH API Key</span>
          <div className="folio-demo-secret-input">
            <input
              type={keyVisible ? "text" : "password"}
              value={apiKey}
              onChange={(event) => onApiKey(event.target.value)}
              placeholder="公开演示不会发送或保存密钥"
              autoComplete="off"
            />
            <button type="button" aria-label={keyVisible ? "隐藏密钥" : "显示密钥"} onClick={onKeyVisible}>
              {keyVisible ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </label>
        <label>
          <span>Base URL</span>
          <input value="演示环境未连接" readOnly />
        </label>
        <label>
          <span>请求超时（秒）</span>
          <input value="—" readOnly />
        </label>
        <label className="wide">
          <span>User-Agent</span>
          <input value="—" readOnly />
        </label>
      </div>

      <div className="folio-demo-inline-actions">
        <button type="button" onClick={() => announce("演示环境未连接后端，未执行远端验证。")}>验证连接</button>
        <button type="button" onClick={() => announce("公开原型没有远端缓存可清除。")}>清除远端缓存</button>
        <button type="button" disabled={!apiKey} onClick={() => onApiKey("")}>清除 Key</button>
      </div>

      <dl className="folio-demo-kv">
        <div><dt>配置来源</dt><dd>未配置</dd></div>
        <div><dt>最近验证</dt><dd>—</dd></div>
        <div><dt>返回状态</dt><dd>—</dd></div>
      </dl>
    </section>
  );
}

function TranslationPanel({
  provider,
  targetLanguage,
  batchLimit,
  onProvider,
  onTargetLanguage,
  onBatchLimit,
  announce,
}: {
  provider: "google_free" | "deepl";
  targetLanguage: "zh-CN" | "zh-TW";
  batchLimit: number;
  onProvider: (value: "google_free" | "deepl") => void;
  onTargetLanguage: (value: "zh-CN" | "zh-TW") => void;
  onBatchLimit: (value: number) => void;
  announce: (message: string) => void;
}) {
  return (
    <section className="folio-demo-panel" aria-labelledby="folio-translation-title">
      <div className="folio-demo-panel-title">
        <div>
          <h3 id="folio-translation-title">机器翻译</h3>
          <p>选择词典建议使用的服务与目标语言。</p>
        </div>
      </div>

      <div className="folio-demo-choice-list" aria-label="翻译服务">
        <button className={provider === "google_free" ? "active" : ""} type="button" onClick={() => onProvider("google_free")}>
          <span>Google 免费翻译</span><small>无需 API Key</small><Check size={16} />
        </button>
        <button className={provider === "deepl" ? "active" : ""} type="button" onClick={() => onProvider("deepl")}>
          <span>DeepL API</span><small>需要独立 Key</small><Check size={16} />
        </button>
      </div>

      <div className="folio-demo-form-grid">
        <label>
          <span>目标语言</span>
          <select value={targetLanguage} onChange={(event) => onTargetLanguage(event.target.value as "zh-CN" | "zh-TW")}>
            <option value="zh-CN">简体中文</option>
            <option value="zh-TW">繁体中文</option>
          </select>
        </label>
        <label>
          <span>批量建议数量</span>
          <input
            type="number"
            min={1}
            max={50}
            value={batchLimit}
            onChange={(event) => onBatchLimit(Math.max(1, Math.min(50, Number(event.target.value) || 1)))}
          />
        </label>
        {provider === "deepl" ? (
          <label className="wide">
            <span>DeepL API Key</span>
            <input type="password" placeholder="公开演示不会发送或保存密钥" autoComplete="off" />
          </label>
        ) : null}
      </div>

      <div className="folio-demo-inline-actions">
        <button type="button" onClick={() => announce("演示环境未连接翻译服务，未发送测试文本。")}>测试配置</button>
      </div>
    </section>
  );
}

function PrivacyPanel({
  privacy,
  blurCovers,
  readerMode,
  onPrivacy,
  onBlurCovers,
  onReaderMode,
}: {
  privacy: boolean;
  blurCovers: boolean;
  readerMode: "single" | "scroll";
  onPrivacy: (value: boolean) => void;
  onBlurCovers: (value: boolean) => void;
  onReaderMode: (value: "single" | "scroll") => void;
}) {
  return (
    <section className="folio-demo-panel" aria-labelledby="folio-privacy-title">
      <div className="folio-demo-panel-title">
        <div>
          <h3 id="folio-privacy-title">隐私与阅读偏好</h3>
          <p>决定后续页面打开时采用的默认保护方式。</p>
        </div>
      </div>

      <div className="folio-demo-toggle-list">
        <DemoToggle label="隐私模式默认开启" copy="页面切换时保持敏感信息收敛。" checked={privacy} onChange={onPrivacy} />
        <DemoToggle label="封面模糊默认开启" copy="媒体内容在主动操作前保持模糊。" checked={blurCovers} onChange={onBlurCovers} />
      </div>

      <fieldset className="folio-demo-mode-field">
        <legend>默认阅读模式</legend>
        <button className={readerMode === "single" ? "active" : ""} type="button" onClick={() => onReaderMode("single")}>单页</button>
        <button className={readerMode === "scroll" ? "active" : ""} type="button" onClick={() => onReaderMode("scroll")}>连续滚动</button>
      </fieldset>
    </section>
  );
}

function ExportPanel({
  options,
  onOptions,
}: {
  options: { comicInfo: boolean; json: boolean; compress: boolean };
  onOptions: (value: { comicInfo: boolean; json: boolean; compress: boolean }) => void;
}) {
  return (
    <section className="folio-demo-panel" aria-labelledby="folio-export-title">
      <div className="folio-demo-panel-title">
        <div>
          <h3 id="folio-export-title">CBZ 默认值</h3>
          <p>这里只决定导出中心初始值，单次导出仍可调整。</p>
        </div>
      </div>
      <div className="folio-demo-toggle-list">
        <DemoToggle label="写入 ComicInfo.xml" copy="导出时生成标准漫画元数据。" checked={options.comicInfo} onChange={(value) => onOptions({ ...options, comicInfo: value })} />
        <DemoToggle label="保留原始 JSON" copy="保留源归档中已有的 JSON 元数据。" checked={options.json} onChange={(value) => onOptions({ ...options, json: value })} />
        <DemoToggle label="启用压缩" copy="以较小体积生成新的 CBZ 文件。" checked={options.compress} onChange={(value) => onOptions({ ...options, compress: value })} />
      </div>
    </section>
  );
}

function DemoToggle({
  label,
  copy,
  checked,
  onChange,
}: {
  label: string;
  copy: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label>
      <span><strong>{label}</strong><small>{copy}</small></span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <i aria-hidden="true"><span /></i>
    </label>
  );
}

function UnavailablePanel({
  title,
  copy,
  icon: Icon,
}: {
  title: string;
  copy: string;
  icon: typeof Settings;
}) {
  return (
    <section className="folio-demo-unavailable">
      <Icon size={24} />
      <h3>{title}</h3>
      <p>{copy}</p>
      <span>—</span>
    </section>
  );
}
