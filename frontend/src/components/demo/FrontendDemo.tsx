import {
  Archive,
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  Eye,
  EyeOff,
  FileArchive,
  Folder,
  Grid2X2,
  HardDrive,
  Languages,
  LayoutDashboard,
  Library,
  List,
  LockKeyhole,
  Menu,
  PackageOpen,
  PenLine,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings,
  SlidersHorizontal,
  Tag,
  Upload,
  Workflow,
  X,
} from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { duration, ease, usePrefersReducedMotion } from "../../lib/motion";
import "./FrontendDemo.css";

type PageId =
  | "workbench"
  | "library"
  | "discover"
  | "governance"
  | "dictionary"
  | "tasks"
  | "export"
  | "files"
  | "settings";

type SettingsSection = "connection" | "translation" | "privacy" | "export" | "data" | "storage";

type PageDefinition = {
  id: PageId;
  label: string;
  title: string;
  description: string;
  icon: typeof Settings;
};

const PAGES: PageDefinition[] = [
  { id: "workbench", label: "工作台", title: "工作台", description: "馆藏、治理、任务与文件状态的每日入口。", icon: LayoutDashboard },
  { id: "library", label: "我的库", title: "我的库", description: "筛选、阅读与管理所有真实入库的本地作品。", icon: Library },
  { id: "discover", label: "发现", title: "发现 / 导入", description: "从远端源检索、预览并加入真实导入队列。", icon: Search },
  { id: "governance", label: "治理", title: "元数据编辑", description: "对照远端来源，核对并写入本地最终元数据。", icon: PenLine },
  { id: "dictionary", label: "词典", title: "词典治理", description: "统一英文术语、中文显示与检索入口。", icon: Languages },
  { id: "tasks", label: "队列", title: "任务中心", description: "追踪导入、扫描、治理与导出的处理过程。", icon: Workflow },
  { id: "export", label: "导出", title: "导出中心", description: "检查配方并生成带标准元数据的 CBZ。", icon: Download },
  { id: "files", label: "文件", title: "文件管理", description: "核对源文件、索引状态、体积与可回收空间。", icon: FileArchive },
  { id: "settings", label: "设置", title: "设置", description: "集中管理连接、翻译、阅读、导出与本地存储。", icon: Settings },
];

const SETTINGS_SECTIONS: { id: SettingsSection; label: string; description: string; icon: typeof Settings }[] = [
  { id: "connection", label: "连接", description: "远端 API 与运行环境", icon: Database },
  { id: "translation", label: "翻译", description: "服务商、语言与批量建议", icon: Languages },
  { id: "privacy", label: "隐私阅读", description: "默认保护与阅读方式", icon: EyeOff },
  { id: "export", label: "导出", description: "CBZ 打包默认值", icon: Download },
  { id: "data", label: "数据", description: "馆藏摘要与语言分布", icon: BarChart3 },
  { id: "storage", label: "存储", description: "目录、源文件与空间", icon: Folder },
];

export function FrontendDemo() {
  const reduceMotion = usePrefersReducedMotion();
  const [page, setPage] = useState<PageId>("workbench");
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("connection");
  const [settingsRevision, setSettingsRevision] = useState(0);
  const [privacy, setPrivacy] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const scrollRef = useRef<HTMLElement>(null);
  const bindingRef = useRef<HTMLDivElement>(null);
  const current = PAGES.find((item) => item.id === page) ?? PAGES[0];

  useEffect(() => {
    const previous = document.title;
    document.title = "NH Archive · 前端演示";
    return () => {
      document.title = previous;
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menuOpen]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: 0 });
      updateBindingProgress();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [page, settingsSection]);

  function updateBindingProgress() {
    const scroll = scrollRef.current;
    const binding = bindingRef.current;
    if (!scroll || !binding) return;
    const max = scroll.scrollHeight - scroll.clientHeight;
    const size = max <= 1 ? 1 : Math.max(0.12, scroll.clientHeight / scroll.scrollHeight);
    const offset = max <= 1 ? 0 : (scroll.scrollTop / max) * (1 - size);
    binding.style.setProperty("--folio-scroll-size", String(size));
    binding.style.setProperty("--folio-scroll-offset", String(offset));
  }

  function navigate(next: PageId) {
    setPage(next);
    setMenuOpen(false);
  }

  function resetSettings() {
    setSettingsRevision((value) => value + 1);
    setSettingsSection("connection");
    setNotice("已恢复演示页初始状态，未读取任何本地配置。");
  }

  return (
    <div className={"folio-demo folio-demo-page-" + page}>
      <ModuleBackdrop page={page} reduceMotion={reduceMotion} />

      <div ref={bindingRef} className="folio-demo-binding" aria-hidden="true">
        <span className="folio-demo-binding-progress" />
      </div>

      <header className="folio-demo-topbar">
        <button className="folio-demo-brand" type="button" onClick={() => navigate("workbench")}>
          <span className="folio-demo-brand-mark" aria-hidden="true">
            <span className="folio-demo-monogram">NH</span>
            <i />
          </span>
          <span className="folio-demo-brand-copy">
            <strong>Archive</strong>
            <small>local collection</small>
          </span>
        </button>

        <PageNavigation className="folio-demo-topnav" page={page} onNavigate={navigate} />

        <div className="folio-demo-top-actions">
          <button
            className={"folio-demo-privacy" + (privacy ? " is-on" : "")}
            type="button"
            aria-pressed={privacy}
            onClick={() => setPrivacy((value) => !value)}
          >
            <span className="folio-demo-privacy-icon" aria-hidden="true">
              <LockKeyhole size={15} />
            </span>
            <span className="folio-demo-privacy-copy">
              <span>隐私模式</span>
              <strong>{privacy ? "开启" : "关闭"}</strong>
            </span>
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

      <div className="folio-demo-workspace">
        <AnimatePresence>
          {menuOpen ? (
            <m.div
              className="folio-demo-mobile-nav"
              initial={{ opacity: 0, y: reduceMotion ? 0 : -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduceMotion ? 0 : -10 }}
              transition={{ duration: duration.fast, ease: ease.standard }}
            >
              <PageNavigation page={page} onNavigate={navigate} />
            </m.div>
          ) : null}
        </AnimatePresence>

        <main ref={scrollRef} className="folio-demo-scroll" id="folio-demo-scroll" onScroll={updateBindingProgress}>
          <AnimatePresence mode="wait" initial={false}>
            <m.div
              key={page}
              className="folio-demo-page"
              initial={{ opacity: 0, x: reduceMotion ? 0 : 28, scale: reduceMotion ? 1 : 0.992 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: reduceMotion ? 0 : -18, scale: reduceMotion ? 1 : 1.006 }}
              transition={{ duration: duration.base, ease: ease.standard }}
              onAnimationComplete={updateBindingProgress}
            >
              <DemoPage
                page={page}
                current={current}
                settingsSection={settingsSection}
                onSettingsSection={setSettingsSection}
                settingsRevision={settingsRevision}
                onNavigate={navigate}
                announce={setNotice}
              />
            </m.div>
          </AnimatePresence>
        </main>
      </div>

      <CommandBar
        page={page}
        onNavigate={navigate}
        onResetSettings={resetSettings}
        announce={setNotice}
      />

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

function ModuleBackdrop({ page, reduceMotion }: { page: PageId; reduceMotion: boolean }) {
  const backdropIcons = page === "library"
    ? [BookOpen]
    : null;

  return (
    <AnimatePresence initial={false}>
      <m.div
        key={page}
        className={"folio-demo-atmosphere folio-demo-atmosphere-" + page}
        aria-hidden="true"
        initial={{ opacity: 0, scale: reduceMotion ? 1 : 1.035 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.985 }}
        transition={{ duration: duration.slow, ease: ease.standard }}
      >
        {backdropIcons ? backdropIcons.map((Icon, index) => <Icon key={index} strokeWidth={1} />) : page === "discover" ? (
          <div className="folio-demo-radar">
            <i className="folio-demo-radar-grid" />
            <i className="folio-demo-radar-sweep" />
            <span className="folio-demo-radar-hit folio-demo-radar-hit-a"><b /><em><b /><b /></em></span>
            <span className="folio-demo-radar-hit folio-demo-radar-hit-b"><b /><em><b /><b /></em></span>
            <span className="folio-demo-radar-hit folio-demo-radar-hit-c"><b /><em><b /><b /></em></span>
          </div>
        ) : (
          <>
            <i />
            <i />
            <i />
          </>
        )}
      </m.div>
    </AnimatePresence>
  );
}

function ModuleScene({ page }: { page: PageId }) {
  let scene: ReactNode;

  switch (page) {
    case "workbench":
      scene = (
        <>
          <g className="folio-scene-hub-orbits">
            <ellipse cx="360" cy="116" rx="136" ry="78" />
            <ellipse cx="360" cy="116" rx="136" ry="78" transform="rotate(54 360 116)" />
          </g>
          <g className="folio-scene-hub-links">
            <path d="M360 116 229 62M360 116l115-55M360 116 224 178M360 116l123 64" />
          </g>
          <g className="folio-scene-hub-panels">
            <g><rect x="181" y="34" width="96" height="56" rx="3" /><circle cx="197" cy="50" r="4" /><path d="M209 49h49M197 68h61" /></g>
            <g><rect x="432" y="33" width="86" height="56" rx="3" /><circle cx="448" cy="49" r="4" /><path d="M460 48h40M448 68h52" /></g>
            <g><rect x="172" y="151" width="104" height="56" rx="3" /><circle cx="188" cy="167" r="4" /><path d="M200 166h57M188 186h69" /></g>
            <g><rect x="440" y="152" width="86" height="56" rx="3" /><circle cx="456" cy="168" r="4" /><path d="M468 167h40M456 187h52" /></g>
          </g>
          <g className="folio-scene-hub-core">
            <rect x="314" y="70" width="92" height="92" rx="4" />
            <rect x="329" y="85" width="62" height="62" rx="2" />
            <circle cx="360" cy="116" r="16" />
            <path d="M346 116h28M360 102v28" />
            <path className="folio-scene-hub-core-scan" d="M326 93h68" />
          </g>
          <g className="folio-scene-hub-nodes">
            <circle cx="294" cy="89" r="5" />
            <circle cx="418" cy="88" r="5" />
            <circle cx="291" cy="148" r="5" />
            <circle cx="420" cy="149" r="5" />
          </g>
          <g className="folio-scene-hub-pulse">
            <circle cx="360" cy="116" r="50" />
            <circle cx="360" cy="116" r="50" />
          </g>
        </>
      );
      break;
    case "library":
      scene = (
        <>
          <g className="folio-scene-library-shelf">
            <path d="M76 177h420M92 185h388" />
            <rect x="110" y="75" width="45" height="102" />
            <rect x="158" y="54" width="55" height="123" />
            <rect x="216" y="87" width="38" height="90" />
            <rect x="258" y="67" width="63" height="110" />
            <rect className="folio-scene-library-destination" x="325" y="98" width="42" height="79" />
          </g>
          <g className="folio-scene-library-spines">
            <path d="M123 91v68M174 72v87M230 104v55M276 86v73M338 114v45" />
          </g>
          <g className="folio-scene-library-file">
            <path d="M397 45h68l24 24v96h-92zM465 45v24h24" />
            <path d="M416 91h52M416 112h52M416 133h35" />
          </g>
        </>
      );
      break;
    case "discover":
      scene = (
        <>
          <g className="folio-scene-discover-records">
            <g><rect x="230" y="34" width="252" height="42" rx="3" /><circle cx="249" cy="55" r="5" /><path d="M265 50h92M265 61h157" /></g>
            <g><rect x="230" y="94" width="252" height="42" rx="3" /><circle cx="249" cy="115" r="5" /><path d="M265 110h126M265 121h174" /></g>
            <g><rect x="230" y="154" width="252" height="42" rx="3" /><circle cx="249" cy="175" r="5" /><path d="M265 170h106M265 181h146" /></g>
          </g>
          <g className="folio-scene-search-lens">
            <circle cx="305" cy="110" r="66" />
            <path d="m354 159 72 58" />
            <g className="folio-scene-search-match">
              <rect x="270" y="87" width="70" height="46" rx="3" />
              <circle cx="284" cy="101" r="4" />
              <path d="M296 99h31M281 117h46" />
            </g>
            <path className="folio-scene-search-scan" d="M250 91h110" />
          </g>
        </>
      );
      break;
    case "governance":
      scene = (
        <>
          <g className="folio-scene-governance-board">
            <g className="folio-scene-governance-card folio-scene-governance-source">
              <rect x="58" y="30" width="192" height="168" rx="5" />
              <circle cx="78" cy="49" r="5" />
              <path d="M78 67h152M78 87h137M78 151h118M78 174h91" />
            </g>
            <g className="folio-scene-governance-card folio-scene-governance-local">
              <rect x="290" y="30" width="192" height="168" rx="5" />
              <circle cx="310" cy="49" r="5" />
              <path d="M310 67h152M310 87h137M310 151h118M310 174h91" />
              <rect className="folio-scene-governance-target" x="310" y="103" width="150" height="32" rx="3" />
            </g>
            <path className="folio-scene-governance-bridge" pathLength="100" d="M256 119h28m-7-7 7 7-7 7" />
          </g>
          <g className="folio-scene-governance-change">
            <rect x="78" y="103" width="150" height="32" rx="3" />
            <circle cx="95" cy="119" r="5" />
            <path d="M108 114h92M108 124h68" />
          </g>
          <g className="folio-scene-governance-stamp">
            <circle cx="454" cy="51" r="18" />
            <path d="m444 51 7 7 14-18" />
          </g>
        </>
      );
      break;
    case "dictionary":
      scene = (
        <>
          <g className="folio-scene-dictionary-book">
            <path d="M82 64c67-23 127-12 180 31v106c-53-43-113-54-180-31Z" />
            <path d="M262 95c53-43 113-54 180-31v106c-67-23-127-12-180 31Z" />
            <path d="M262 95v106" />
          </g>
          <g className="folio-scene-dictionary-slots">
            <rect x="111" y="107" width="113" height="12" rx="6" />
            <rect x="111" y="136" width="82" height="12" rx="6" />
            <rect x="300" y="107" width="113" height="12" rx="6" />
            <rect x="300" y="136" width="82" height="12" rx="6" />
          </g>
          <g className="folio-scene-dictionary-token folio-scene-dictionary-token-a">
            <rect x="72" y="25" width="72" height="38" rx="19" />
            <text x="108" y="50" textAnchor="middle">Aa</text>
          </g>
          <g className="folio-scene-dictionary-token folio-scene-dictionary-token-b">
            <rect x="226" y="18" width="72" height="38" rx="19" />
            <text x="262" y="43" textAnchor="middle">↔</text>
          </g>
          <g className="folio-scene-dictionary-token folio-scene-dictionary-token-c">
            <rect x="380" y="25" width="72" height="38" rx="19" />
            <text x="416" y="50" textAnchor="middle">译</text>
          </g>
          <g className="folio-scene-dictionary-bookmark">
            <path d="M278 86v54l-16-10-16 10V86" />
          </g>
        </>
      );
      break;
    case "tasks":
      scene = (
        <>
          <g className="folio-scene-task-columns">
            <rect x="51" y="28" width="136" height="174" rx="5" />
            <rect className="folio-scene-task-column-running" x="202" y="28" width="136" height="174" rx="5" />
            <rect x="353" y="28" width="136" height="174" rx="5" />
            <circle cx="70" cy="49" r="5" />
            <circle cx="221" cy="49" r="5" />
            <circle cx="372" cy="49" r="5" />
          </g>
          <g className="folio-scene-task-card folio-scene-task-card-main">
            <rect x="68" y="78" width="102" height="61" rx="4" />
            <circle cx="86" cy="98" r="6" />
            <path d="M101 94h49M80 120h70" />
            <path className="folio-scene-task-progress" pathLength="100" d="M80 127h70" />
          </g>
          <g className="folio-scene-task-card folio-scene-task-card-waiting">
            <rect x="68" y="151" width="102" height="35" rx="4" />
            <circle cx="85" cy="168" r="5" />
            <path d="M98 168h52" />
          </g>
          <g className="folio-scene-task-transfer">
            <ArrowRight x={177} y={99} width={24} height={24} strokeWidth={1.2} />
            <ArrowRight x={328} y={99} width={24} height={24} strokeWidth={1.2} />
          </g>
          <g className="folio-scene-task-running-progress">
            <path d="M222 168h96" />
            <path className="folio-scene-task-running-value" pathLength="100" d="M222 168h96" />
          </g>
          <g className="folio-scene-task-complete">
            <circle cx="421" cy="109" r="25" />
            <path d="m408 109 9 9 18-23" />
          </g>
        </>
      );
      break;
    case "export":
      scene = (
        <>
          <path className="folio-scene-export-rail" d="M54 199h432" />
          <g className="folio-scene-export-file folio-scene-export-file-a">
            <path d="M62 62h86l24 24v104H62Z" />
            <path d="M148 62v24h24M82 104h68M82 128h52M82 152h61" />
          </g>
          <g className="folio-scene-export-file folio-scene-export-file-b">
            <path d="M91 48h86l24 24v104H91Z" />
            <path d="M177 48v24h24M111 90h68M111 114h52M111 138h61" />
          </g>
          <g className="folio-scene-export-file folio-scene-export-file-c">
            <path d="M120 34h86l24 24v104H120Z" />
            <path d="M206 34v24h24M140 76h68M140 100h52M140 124h61" />
          </g>
          <g className="folio-scene-export-archive">
            <path className="folio-scene-export-cover" d="M324 34h112l30 30v132H324Z" />
            <path d="M436 34v30h30M350 52v126" />
            <path className="folio-scene-export-zip" pathLength="100" d="M350 58v118" />
            <rect x="376" y="134" width="62" height="30" rx="3" />
            <path d="M390 146h34M390 154h24" />
          </g>
          <g className="folio-scene-export-slider">
            <rect x="344" y="53" width="12" height="16" rx="2" />
            <path d="m347 61 3 3 4-6" />
          </g>
          <g className="folio-scene-export-seal">
            <circle cx="438" cy="179" r="15" />
            <path d="m430 179 6 6 12-16" />
          </g>
        </>
      );
      break;
    case "files":
      scene = (
        <>
          <g className="folio-scene-files-source-stack">
            <rect x="44" y="69" width="102" height="126" rx="3" />
            <rect x="54" y="59" width="102" height="126" rx="3" />
          </g>
          <g className="folio-scene-files-scanner">
            <rect x="214" y="35" width="120" height="160" rx="5" />
            <circle cx="234" cy="55" r="5" />
            <path d="M249 55h62" />
          </g>
          <g className="folio-scene-files-folder-back">
            <path d="M365 99h47l17 19h71v76H365Z" />
          </g>
          <g className="folio-scene-files-document">
            <rect x="58" y="55" width="102" height="126" rx="3" />
            <path d="M78 86h62M78 111h62M78 136h43" />
            <g className="folio-scene-files-document-status">
              <circle cx="139" cy="76" r="13" />
              <path d="m132 76 5 5 10-13" />
            </g>
          </g>
          <rect className="folio-scene-files-scan-beam" x="227" y="72" width="94" height="5" rx="2" />
          <path className="folio-scene-files-folder-front" d="M365 126h135v68H365Z" />
        </>
      );
      break;
    case "settings":
      scene = (
        <>
          <g className="folio-scene-settings-console">
            <rect x="66" y="35" width="408" height="160" rx="4" />
            <path d="M66 72h408M202 72v123M338 72v123M88 174h364" />
            <circle cx="84" cy="54" r="4" />
            <circle cx="98" cy="54" r="4" />
            <rect className="folio-scene-settings-cursor" x="76" y="82" width="116" height="78" rx="2" />
          </g>
          <g className="folio-scene-settings-cell folio-scene-settings-cell-a">
            <SlidersHorizontal x={107} y={93} width={54} height={54} strokeWidth={1.15} />
          </g>
          <g className="folio-scene-settings-cell folio-scene-settings-cell-b">
            <Settings x={243} y={93} width={54} height={54} strokeWidth={1.15} />
          </g>
          <g className="folio-scene-settings-cell folio-scene-settings-cell-c">
            <LockKeyhole x={379} y={93} width={54} height={54} strokeWidth={1.15} />
          </g>
          <g className="folio-scene-settings-status">
            <path className="folio-scene-settings-status-track" d="M134 174h272" />
            <path className="folio-scene-settings-status-value" pathLength="100" d="M134 174h272" />
            <circle cx="134" cy="174" r="4" />
            <Check x={424} y={163} width={22} height={22} strokeWidth={1.35} />
          </g>
        </>
      );
      break;
  }

  return (
    <div className={"folio-demo-scene folio-demo-scene-" + page} aria-hidden="true">
      <svg viewBox="0 0 540 230">{scene}</svg>
    </div>
  );
}

function PageNavigation({
  page,
  onNavigate,
  className = "",
}: {
  page: PageId;
  onNavigate: (page: PageId) => void;
  className?: string;
}) {
  const indicatorId = className ? "folio-demo-nav-active-top" : "folio-demo-nav-active-drawer";

  return (
    <nav className={"folio-demo-nav" + (className ? " " + className : "")} aria-label="全局导航">
      {PAGES.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            className={page === item.id ? "is-active" : ""}
            aria-current={page === item.id ? "page" : undefined}
            onClick={() => onNavigate(item.id)}
          >
            {page === item.id ? (
              <m.span
                className="folio-demo-nav-active"
                layoutId={indicatorId}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            ) : null}
            <Icon size={17} />
            <strong>{item.label}</strong>
            <ArrowRight className="folio-demo-nav-arrow" size={15} />
          </button>
        );
      })}
    </nav>
  );
}

function DemoPage({
  page,
  current,
  settingsSection,
  onSettingsSection,
  settingsRevision,
  onNavigate,
  announce,
}: {
  page: PageId;
  current: PageDefinition;
  settingsSection: SettingsSection;
  onSettingsSection: (section: SettingsSection) => void;
  settingsRevision: number;
  onNavigate: (page: PageId) => void;
  announce: (message: string) => void;
}) {
  return (
    <>
      <PageHeading page={current} />
      {page === "workbench" ? <WorkbenchDemo onNavigate={onNavigate} /> : null}
      {page === "library" ? <LibraryDemo onNavigate={onNavigate} /> : null}
      {page === "discover" ? <DiscoverDemo announce={announce} /> : null}
      {page === "governance" ? <GovernanceDemo /> : null}
      {page === "dictionary" ? <DictionaryDemo announce={announce} /> : null}
      {page === "tasks" ? <TasksDemo /> : null}
      {page === "export" ? <ExportDemo /> : null}
      {page === "files" ? <FilesDemo /> : null}
      {page === "settings" ? (
        <SettingsDemo
          key={settingsRevision}
          section={settingsSection}
          onSection={onSettingsSection}
          announce={announce}
        />
      ) : null}
    </>
  );
}

function PageHeading({ page }: { page: PageDefinition }) {
  return (
    <header className="folio-demo-page-head">
      <div className="folio-demo-page-copy">
        <h1>{page.title}</h1>
        <p>{page.description}</p>
      </div>
      <ModuleScene page={page.id} />
    </header>
  );
}

function WorkbenchDemo({ onNavigate }: { onNavigate: (page: PageId) => void }) {
  const states = [
    { label: "馆藏", value: "未连接", detail: "等待本地索引", icon: Library },
    { label: "治理", value: "等待入库", detail: "暂无待处理作品", icon: PenLine },
    { label: "任务", value: "队列为空", detail: "没有运行中任务", icon: Workflow },
    { label: "存储", value: "未读取", detail: "公开演示不访问磁盘", icon: HardDrive },
  ];

  return (
    <div className="folio-demo-page-body">
      <section className="folio-demo-status-band" aria-label="工作台状态">
        {states.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.label}>
              <Icon size={17} />
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.detail}</small>
            </article>
          );
        })}
      </section>

      <div className="folio-demo-workbench-grid">
        <section className="folio-demo-ruled-panel folio-demo-reading-panel">
          <PanelHeading title="继续阅读" description="阅读进度会在接入真实馆藏后出现在这里。" />
          <EmptyCanvas icon={BookOpen} title="还没有可继续的阅读" copy="导入真实 CBZ 并打开阅读器后，进度会自动回到工作台。" />
        </section>

        <section className="folio-demo-module-ledger">
          <PanelHeading title="模块索引" description="从一个工作面进入完整流程。" />
          {PAGES.filter((item) => item.id !== "workbench" && item.id !== "settings").map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} type="button" onClick={() => onNavigate(item.id)}>
                <Icon size={17} />
                <strong>{item.label}</strong>
                <small>{item.description}</small>
                <ArrowRight size={15} />
              </button>
            );
          })}
        </section>
      </div>
    </div>
  );
}

function LibraryDemo({ onNavigate }: { onNavigate: (page: PageId) => void }) {
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState<"all" | "zh" | "ja">("all");
  const [status, setStatus] = useState<"all" | "unread" | "reading" | "read">("all");
  const [sort, setSort] = useState<"recent" | "title" | "progress">("recent");
  const [view, setView] = useState<"grid" | "list">("grid");

  return (
    <div className="folio-demo-page-body">
      <div className="folio-demo-toolbar folio-demo-library-toolbar">
        <SearchField value={query} onChange={setQuery} placeholder="搜索标题、作者、标签或画廊 ID" />
        <DemoSelect label="语言" value={language} onChange={setLanguage} options={[
          { value: "all", label: "全部语言" },
          { value: "zh", label: "中文" },
          { value: "ja", label: "日文" },
        ]} />
        <DemoSelect label="阅读状态" value={status} onChange={setStatus} options={[
          { value: "all", label: "全部状态" },
          { value: "unread", label: "未读" },
          { value: "reading", label: "阅读中" },
          { value: "read", label: "已读" },
        ]} />
        <DemoSelect label="排序" value={sort} onChange={setSort} options={[
          { value: "recent", label: "最近添加" },
          { value: "title", label: "标题" },
          { value: "progress", label: "阅读进度" },
        ]} />
        <div className="folio-demo-view-switch" aria-label="视图方式">
          <button className={view === "grid" ? "is-active" : ""} type="button" aria-label="封面墙视图" onClick={() => setView("grid")}>
            {view === "grid" ? <m.span className="folio-demo-control-active" layoutId="folio-demo-view-active" /> : null}
            <Grid2X2 size={16} />
          </button>
          <button className={view === "list" ? "is-active" : ""} type="button" aria-label="列表视图" onClick={() => setView("list")}>
            {view === "list" ? <m.span className="folio-demo-control-active" layoutId="folio-demo-view-active" /> : null}
            <List size={17} />
          </button>
        </div>
      </div>

      <div className="folio-demo-split-layout">
        <section className="folio-demo-ruled-panel">
          <PanelHeading title="馆藏" description={query ? "当前搜索不会发送到服务器。" : "全部真实入库作品会显示在这里。"} />
          <EmptyCanvas
            icon={Library}
            title="库里还没有作品"
            copy="公开演示不生成假作品。前往发现页后，仍可体验完整的检索与导入界面。"
            action="打开发现页"
            onAction={() => onNavigate("discover")}
          />
        </section>
        <aside className="folio-demo-inspector">
          <span>Inspector</span>
          <h2>作品详情</h2>
          <p>选择一部真实作品后，这里显示封面、阅读进度、来源与标签。</p>
          <div className="folio-demo-inspector-lines"><i /><i /><i /><i /></div>
        </aside>
      </div>
    </div>
  );
}

function DiscoverDemo({ announce }: { announce: (message: string) => void }) {
  const [query, setQuery] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [language, setLanguage] = useState<"all" | "zh" | "ja">("all");
  const [kind, setKind] = useState<"all" | "doujinshi" | "manga">("all");
  const [sort, setSort] = useState<"popular" | "recent">("popular");
  const [unimportedOnly, setUnimportedOnly] = useState(true);

  return (
    <div className="folio-demo-page-body">
      <section className="folio-demo-popular-strip">
        <div>
          <span>今日热门</span>
          <h2>连接远端源后显示</h2>
          <p>这里保留真实热门内容的动线与展开位置，不使用示例封面填充。</p>
        </div>
        <div className="folio-demo-popular-lines" aria-hidden="true"><i /><i /><i /><i /></div>
      </section>

      <div className="folio-demo-toolbar folio-demo-toolbar-wide">
        <DiscoveryQueryComposer query={query} onQuery={setQuery} tags={tags} onTags={setTags} />
        <DemoSelect label="语言" value={language} onChange={setLanguage} options={[
          { value: "all", label: "全部语言" },
          { value: "zh", label: "中文" },
          { value: "ja", label: "日文" },
        ]} />
        <DemoSelect label="类型" value={kind} onChange={setKind} options={[
          { value: "all", label: "全部类型" },
          { value: "doujinshi", label: "同人志" },
          { value: "manga", label: "漫画" },
        ]} />
        <DemoSelect label="排序" value={sort} onChange={setSort} options={[
          { value: "popular", label: "热门" },
          { value: "recent", label: "最新" },
        ]} />
        <button className={"folio-demo-filter-toggle folio-demo-discover-action" + (unimportedOnly ? " is-active" : "")} type="button" aria-pressed={unimportedOnly} onClick={() => setUnimportedOnly((value) => !value)}>
          <SlidersHorizontal size={15} />
          仅未导入
        </button>
        <button className="folio-demo-ink-button folio-demo-discover-action" type="button" onClick={() => announce(query || tags.length ? `已组合关键字与 ${tags.length} 个标签；演示环境未发送远端请求。` : "先输入关键字、画廊 ID 或添加标签。")}>
          <Search size={15} />
          搜索
        </button>
      </div>

      <section className="folio-demo-ruled-panel">
        <PanelHeading title="检索结果" description={tags.length ? `当前组合 ${tags.length} 个标签与关键字条件。` : "可组合关键字、多个标签、筛选与排序条件。"} />
        <EmptyCanvas icon={Search} title="等待远端连接" copy="配置连接后，这里会显示真实检索结果、导入状态与分页控件。" />
        <div className="folio-demo-pager" aria-label="分页">
          <button type="button" disabled aria-label="上一页"><ChevronLeft size={16} /></button>
          <span>— / —</span>
          <button type="button" disabled aria-label="下一页"><ChevronRight size={16} /></button>
        </div>
      </section>
    </div>
  );
}

function GovernanceDemo() {
  const [onlyDiff, setOnlyDiff] = useState(true);

  return (
    <div className="folio-demo-page-body">
      <div className="folio-demo-governance-layout">
        <aside className="folio-demo-queue-rail">
          <PanelHeading title="待编辑作品" description="真实入库后自动生成队列。" />
          <div className="folio-demo-rail-empty"><PenLine size={20} /><span>暂无待编辑作品</span></div>
        </aside>

        <section className="folio-demo-editor-stage">
          <div className="folio-demo-editor-head">
            <div>
              <span>Metadata</span>
              <h2>元数据对照编辑</h2>
            </div>
            <button className={"folio-demo-filter-toggle" + (onlyDiff ? " is-active" : "")} type="button" aria-pressed={onlyDiff} onClick={() => setOnlyDiff((value) => !value)}>
              仅看差异
            </button>
          </div>
          <div className="folio-demo-field-matrix">
            <DemoField label="标题" placeholder="选择作品后显示" readOnly />
            <DemoField label="日文标题" placeholder="选择作品后显示" readOnly />
            <DemoField label="作者 / 社团" placeholder="选择作品后显示" readOnly />
            <DemoField label="语言" placeholder="选择作品后显示" readOnly />
          </div>
          <div className="folio-demo-tag-board">
            <div><Tag size={17} /><strong>标签</strong></div>
            <p>选中作品后，对照远端原始标签与本地词典译名。</p>
          </div>
        </section>

        <aside className="folio-demo-source-rail">
          <span>Source check</span>
          <h2>来源对照</h2>
          <p>标题、标签、页数与远端画廊信息会在此并列展示。</p>
          <div className="folio-demo-inspector-lines"><i /><i /><i /><i /></div>
        </aside>
      </div>
    </div>
  );
}

function DictionaryDemo({ announce }: { announce: (message: string) => void }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"all" | "tag" | "artist">("all");
  const [status, setStatus] = useState<"pending" | "reviewed" | "ignored">("pending");
  const [bulkOpen, setBulkOpen] = useState(false);
  const bulkTriggerRef = useRef<HTMLButtonElement>(null);

  function closeBulk() {
    setBulkOpen(false);
    window.requestAnimationFrame(() => bulkTriggerRef.current?.focus());
  }

  useEffect(() => {
    if (!bulkOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeBulk();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [bulkOpen]);

  return (
    <div className="folio-demo-page-body">
      <div className="folio-demo-dictionary-layout">
        <section className="folio-demo-candidate-panel">
          <div className="folio-demo-panel-toolbar">
            <PanelHeading title="候选术语池" description="只展示真实远端标签与已保存词条。" />
            <button ref={bulkTriggerRef} className="folio-demo-line-button" type="button" onClick={() => setBulkOpen(true)}><Upload size={15} />批量导入</button>
          </div>
          <SearchField value={query} onChange={setQuery} placeholder="搜索原文或中文词条" />
          <div className="folio-demo-inline-filters">
            <DemoSelect label="类型" value={type} onChange={setType} options={[
              { value: "all", label: "全部类型" },
              { value: "tag", label: "标签" },
              { value: "artist", label: "作者" },
            ]} />
            <DemoSelect label="状态" value={status} onChange={setStatus} options={[
              { value: "pending", label: "待处理" },
              { value: "reviewed", label: "已复核" },
              { value: "ignored", label: "已忽略" },
            ]} />
          </div>
          <div className="folio-demo-empty-table">
            <div><span>原文</span><span>类型</span><span>状态</span></div>
            <p>没有真实候选术语</p>
          </div>
        </section>

        <section className="folio-demo-editor-stage">
          <PanelHeading title="术语编辑器" description="新建或选择候选后再保存。" />
          <div className="folio-demo-field-matrix">
            <DemoField label="原文" placeholder="输入远端原始术语" />
            <DemoField label="中文显示" placeholder="输入规范中文译名" />
            <DemoField label="别名" placeholder="输入别名后回车" />
            <DemoField label="备注" placeholder="标题、系列名或使用说明" />
          </div>
          <div className="folio-demo-editor-actions">
            <button className="folio-demo-line-button" type="button" onClick={() => announce("当前没有可预览的真实作品。")}>应用预览</button>
            <button className="folio-demo-ink-button" type="button" onClick={() => announce("演示页不会写入本地词典。")}><Save size={15} />保存词条</button>
          </div>
        </section>
      </div>

      <section className="folio-demo-evidence-strip">
        <div><BookOpen size={18} /><strong>应用预览</strong></div>
        <span>标签更新对比</span>
        <span>常见搭配</span>
        <span>冲突项</span>
        <span>关联作品</span>
      </section>

      <AnimatePresence>
        {bulkOpen ? (
          <m.div className="folio-demo-modal-backdrop" role="presentation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={closeBulk}>
            <m.section
              className="folio-demo-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="folio-bulk-title"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              onMouseDown={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                if (event.key !== "Tab") return;
                const controls = [...event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), textarea, input:not(:disabled), [tabindex]:not([tabindex='-1'])")];
                const first = controls[0];
                const last = controls[controls.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                  event.preventDefault();
                  last?.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                  event.preventDefault();
                  first?.focus();
                }
              }}
            >
              <button autoFocus className="folio-demo-modal-close" type="button" aria-label="关闭批量导入" onClick={closeBulk}><X size={18} /></button>
              <span>Dictionary</span>
              <h2 id="folio-bulk-title">批量导入</h2>
              <p>每行输入一条术语映射；演示页只验证界面，不写入数据库。</p>
              <textarea rows={7} placeholder="每行输入：原文, 中文显示" />
              <div>
                <button className="folio-demo-line-button" type="button" onClick={closeBulk}>取消</button>
                <button className="folio-demo-ink-button" type="button" onClick={() => announce("演示页未执行批量导入。")}>检查格式</button>
              </div>
            </m.section>
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function TasksDemo() {
  const [tab, setTab] = useState<"all" | "queued" | "running" | "completed" | "failed">("all");
  const [query, setQuery] = useState("");
  const tabs = [
    { id: "all" as const, label: "全部" },
    { id: "queued" as const, label: "等待中" },
    { id: "running" as const, label: "运行中" },
    { id: "completed" as const, label: "已完成" },
    { id: "failed" as const, label: "失败" },
  ];

  return (
    <div className="folio-demo-page-body">
      <section className="folio-demo-task-summary">
        {tabs.slice(1).map((item) => (
          <article key={item.id}><span>{item.label}</span><strong>—</strong><small>未连接任务队列</small></article>
        ))}
      </section>

      <div className="folio-demo-toolbar folio-demo-toolbar-wide">
        <div className="folio-demo-tabs" role="tablist" aria-label="任务状态筛选">
          {tabs.map((item) => (
            <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? "is-active" : ""} onClick={() => setTab(item.id)}>
              {tab === item.id ? <m.span className="folio-demo-control-active" layoutId="folio-demo-task-tab-active" /> : null}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
        <SearchField value={query} onChange={setQuery} placeholder="搜索任务 ID、Gallery ID、阶段或错误" />
      </div>

      <div className="folio-demo-split-layout">
        <section className="folio-demo-ruled-panel">
          <div className="folio-demo-table-head"><span>任务</span><span>阶段</span><span>进度</span><span>状态</span></div>
          <EmptyCanvas icon={Workflow} title="没有真实任务" copy="导入、扫描、治理或导出开始后，任务会按时间顺序出现在这里。" />
        </section>
        <aside className="folio-demo-inspector">
          <span>Task log</span>
          <h2>运行详情</h2>
          <p>选择任务后显示阶段、进度、开始时间与错误日志。</p>
          <div className="folio-demo-inspector-lines"><i /><i /><i /><i /></div>
        </aside>
      </div>
    </div>
  );
}

function ExportDemo() {
  const [query, setQuery] = useState("");
  const [comicInfo, setComicInfo] = useState(true);
  const [json, setJson] = useState(true);
  const [compress, setCompress] = useState(true);

  return (
    <div className="folio-demo-page-body">
      <div className="folio-demo-export-layout">
        <section className="folio-demo-export-source">
          <PanelHeading title="选择作品" description="只从真实本地馆藏中选择导出项。" />
          <SearchField value={query} onChange={setQuery} placeholder="搜索作品" />
          <EmptyCanvas icon={Archive} title="没有可导出的作品" copy="公开演示不会创建假馆藏。导入真实作品后即可多选并生成任务。" />
        </section>

        <section className="folio-demo-export-recipe">
          <div className="folio-demo-recipe-head">
            <div>
              <span>Export recipe</span>
              <h2>CBZ 配方</h2>
            </div>
            <PackageOpen size={27} />
          </div>
          <DemoField label="输出名称" placeholder="选择作品后自动生成" readOnly />
          <div className="folio-demo-toggle-list">
            <ToggleRow label="写入 ComicInfo.xml" copy="生成标准漫画元数据。" checked={comicInfo} onChange={setComicInfo} />
            <ToggleRow label="保留原始 JSON" copy="保留源归档中的 JSON。" checked={json} onChange={setJson} />
            <ToggleRow label="标准压缩" copy="以平衡体积和速度的方式生成。" checked={compress} onChange={setCompress} />
          </div>
          <div className="folio-demo-manifest">
            <span>内容预览</span>
            <p>页面文件</p><strong>—</strong>
            <p>ComicInfo.xml</p><strong>{comicInfo ? "写入" : "跳过"}</strong>
            <p>原始 JSON</p><strong>{json ? "保留" : "跳过"}</strong>
          </div>
        </section>
      </div>
    </div>
  );
}

function FilesDemo() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "healthy" | "missing" | "mismatch">("all");
  const [sort, setSort] = useState<"recent" | "size" | "title">("recent");

  return (
    <div className="folio-demo-page-body">
      <div className="folio-demo-toolbar">
        <SearchField value={query} onChange={setQuery} placeholder="搜索标题或路径" />
        <DemoSelect label="文件状态" value={status} onChange={setStatus} options={[
          { value: "all", label: "全部状态" },
          { value: "healthy", label: "正常" },
          { value: "missing", label: "源文件缺失" },
          { value: "mismatch", label: "体积不一致" },
        ]} />
        <DemoSelect label="排序" value={sort} onChange={setSort} options={[
          { value: "recent", label: "最近更新" },
          { value: "size", label: "文件体积" },
          { value: "title", label: "标题" },
        ]} />
        <button className="folio-demo-line-button" type="button"><RefreshCw size={15} />扫描目录</button>
      </div>

      <div className="folio-demo-split-layout">
        <section className="folio-demo-ruled-panel">
          <div className="folio-demo-table-head folio-demo-files-head"><span>作品 / 路径</span><span>状态</span><span>体积</span><span>更新</span></div>
          <EmptyCanvas icon={Folder} title="未读取本机目录" copy="路径、文件体积和可回收空间在公开演示中保持空白。" />
        </section>
        <aside className="folio-demo-inspector">
          <span>File health</span>
          <h2>文件详情</h2>
          <p>选择文件后显示哈希、源路径、索引状态与维护操作。</p>
          <div className="folio-demo-inspector-lines"><i /><i /><i /><i /></div>
        </aside>
      </div>
    </div>
  );
}

function SettingsDemo({
  section,
  onSection,
  announce,
}: {
  section: SettingsSection;
  onSection: (section: SettingsSection) => void;
  announce: (message: string) => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [keyVisible, setKeyVisible] = useState(false);
  const [provider, setProvider] = useState<"google" | "deepl">("google");
  const [language, setLanguage] = useState<"zh-CN" | "zh-TW">("zh-CN");
  const [batch, setBatch] = useState("20");
  const [privacy, setPrivacy] = useState(true);
  const [blur, setBlur] = useState(true);
  const [reader, setReader] = useState<"single" | "scroll">("single");
  const [comicInfo, setComicInfo] = useState(true);
  const [json, setJson] = useState(true);
  const [compress, setCompress] = useState(true);
  const current = SETTINGS_SECTIONS.find((item) => item.id === section) ?? SETTINGS_SECTIONS[0];

  return (
    <div className="folio-demo-page-body folio-demo-settings-body">
      <nav className="folio-demo-settings-nav" aria-label="设置章节">
        {SETTINGS_SECTIONS.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.id} type="button" className={section === item.id ? "is-active" : ""} aria-current={section === item.id ? "page" : undefined} onClick={() => onSection(item.id)}>
              {section === item.id ? (
                <m.span className="folio-demo-settings-nav-active" layoutId="folio-demo-settings-nav-active" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
              ) : null}
              <Icon size={16} />
              <strong>{item.label}</strong>
              <small>{item.description}</small>
            </button>
          );
        })}
      </nav>

      <AnimatePresence mode="wait" initial={false}>
        <m.section
          key={section}
          className="folio-demo-settings-stage"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: duration.fast, ease: ease.standard }}
        >
          <div className="folio-demo-settings-head">
            <div>
              <h2>{current.label}</h2>
              <p>{current.description}</p>
            </div>
            <div className="folio-demo-settings-state"><i />演示配置</div>
          </div>

          {section === "connection" ? (
            <>
              <div className="folio-demo-field-matrix">
                <label className="folio-demo-field folio-demo-field-wide">
                  <span>NH API Key</span>
                  <div className="folio-demo-secret">
                    <input type={keyVisible ? "text" : "password"} value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="公开演示不会发送或保存密钥" autoComplete="off" />
                    <button type="button" aria-label={keyVisible ? "隐藏密钥" : "显示密钥"} onClick={() => setKeyVisible((value) => !value)}>
                      {keyVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </label>
                <DemoField label="Base URL" placeholder="演示环境未连接" readOnly />
                <DemoField label="请求超时（秒）" placeholder="—" readOnly />
                <DemoField label="User-Agent" placeholder="—" readOnly wide />
              </div>
              <div className="folio-demo-editor-actions">
                <button className="folio-demo-line-button" type="button" onClick={() => announce("演示环境未连接后端，未执行远端验证。")}>验证连接</button>
                <button className="folio-demo-line-button" type="button" onClick={() => setApiKey("")} disabled={!apiKey}>清除 Key</button>
              </div>
            </>
          ) : null}

          {section === "translation" ? (
            <>
              <div className="folio-demo-choice-row">
                <button className={provider === "google" ? "is-active" : ""} type="button" onClick={() => setProvider("google")}>
                  {provider === "google" ? <m.i className="folio-demo-choice-active" layoutId="folio-demo-provider-active" /> : null}
                  <span>Google 免费翻译</span><small>无需 API Key</small><Check size={16} />
                </button>
                <button className={provider === "deepl" ? "is-active" : ""} type="button" onClick={() => setProvider("deepl")}>
                  {provider === "deepl" ? <m.i className="folio-demo-choice-active" layoutId="folio-demo-provider-active" /> : null}
                  <span>DeepL API</span><small>需要独立 Key</small><Check size={16} />
                </button>
              </div>
              <div className="folio-demo-field-matrix">
                <DemoSelect label="目标语言" value={language} onChange={setLanguage} options={[
                  { value: "zh-CN", label: "简体中文" },
                  { value: "zh-TW", label: "繁体中文" },
                ]} />
                <DemoField label="批量建议数量" value={batch} onChange={setBatch} type="number" />
                {provider === "deepl" ? <DemoField label="DeepL API Key" placeholder="公开演示不会发送或保存密钥" wide /> : null}
              </div>
            </>
          ) : null}

          {section === "privacy" ? (
            <>
              <div className="folio-demo-toggle-list">
                <ToggleRow label="隐私模式默认开启" copy="页面切换时保持敏感信息收敛。" checked={privacy} onChange={setPrivacy} />
                <ToggleRow label="封面模糊默认开启" copy="媒体内容在主动操作前保持模糊。" checked={blur} onChange={setBlur} />
              </div>
              <div className="folio-demo-segment-field">
                <span>默认阅读模式</span>
                <div>
                  <button className={reader === "single" ? "is-active" : ""} type="button" onClick={() => setReader("single")}>
                    {reader === "single" ? <m.span className="folio-demo-control-active" layoutId="folio-demo-reader-active" /> : null}<span>单页</span>
                  </button>
                  <button className={reader === "scroll" ? "is-active" : ""} type="button" onClick={() => setReader("scroll")}>
                    {reader === "scroll" ? <m.span className="folio-demo-control-active" layoutId="folio-demo-reader-active" /> : null}<span>连续滚动</span>
                  </button>
                </div>
              </div>
            </>
          ) : null}

          {section === "export" ? (
            <div className="folio-demo-toggle-list">
              <ToggleRow label="写入 ComicInfo.xml" copy="导出时生成标准漫画元数据。" checked={comicInfo} onChange={setComicInfo} />
              <ToggleRow label="保留原始 JSON" copy="保留源归档中已有的 JSON 元数据。" checked={json} onChange={setJson} />
              <ToggleRow label="标准压缩" copy="以较小体积生成新的 CBZ 文件。" checked={compress} onChange={setCompress} />
            </div>
          ) : null}

          {section === "data" ? (
            <EmptyCanvas icon={BarChart3} title="演示环境未连接本地馆藏" copy="这里不会生成统计数字。接入真实后端后，再显示馆藏、阅读进度和语言分布。" />
          ) : null}

          {section === "storage" ? (
            <>
              <div className="folio-demo-field-matrix">
                <DemoField label="数据目录" placeholder="公开演示不读取本机路径" readOnly wide />
                <DemoField label="源文件占用" placeholder="—" readOnly />
                <DemoField label="可回收空间" placeholder="—" readOnly />
              </div>
              <EmptyCanvas icon={HardDrive} title="存储状态保持空白" copy="磁盘占用、缺失源文件与清理建议只会来自真实本机数据。" />
            </>
          ) : null}
        </m.section>
      </AnimatePresence>
    </div>
  );
}

function CommandBar({
  page,
  onNavigate,
  onResetSettings,
  announce,
}: {
  page: PageId;
  onNavigate: (page: PageId) => void;
  onResetSettings: () => void;
  announce: (message: string) => void;
}) {
  const primary = {
    workbench: { label: "刷新视图", icon: RefreshCw, action: () => announce("演示环境没有可刷新的真实数据。") },
    library: { label: "发现作品", icon: Search, action: () => onNavigate("discover") },
    discover: { label: "打开随机作品", icon: Search, action: () => announce("演示环境未连接远端源。") },
    governance: { label: "刷新队列", icon: RefreshCw, action: () => announce("演示环境没有真实治理队列。") },
    dictionary: { label: "新建本地词条", icon: Plus, action: () => announce("可在术语编辑器中填写新词条；演示页不会写入。") },
    tasks: { label: "刷新任务", icon: RefreshCw, action: () => announce("演示环境没有真实任务。") },
    export: { label: "生成 CBZ", icon: PackageOpen, action: () => announce("请先从真实馆藏选择作品。") },
    files: { label: "扫描目录", icon: Folder, action: () => announce("公开演示不会读取本机目录。") },
    settings: { label: "保存设置", icon: Save, action: () => announce("演示设置已保留在当前页面，未写入服务器或本地文件。") },
  }[page];
  const PrimaryIcon = primary.icon;

  return (
    <footer className="folio-demo-command-bar">
      <p><span />演示模式 · 未连接真实业务数据</p>
      <div>
        {page === "settings" ? (
          <button className="folio-demo-line-button" type="button" onClick={onResetSettings}><RotateCcw size={15} />重新读取</button>
        ) : (
          <button className="folio-demo-line-button" type="button" onClick={() => onNavigate("settings")}><Settings size={15} />设置</button>
        )}
        <button className="folio-demo-primary-button" type="button" onClick={primary.action}>
          <PrimaryIcon size={15} />
          {primary.label}
        </button>
      </div>
    </footer>
  );
}

function PanelHeading({ title, description }: { title: string; description: string }) {
  return (
    <header className="folio-demo-panel-heading">
      <h2>{title}</h2>
      <p>{description}</p>
    </header>
  );
}

function EmptyCanvas({
  icon: Icon,
  title,
  copy,
  action,
  onAction,
}: {
  icon: typeof Settings;
  title: string;
  copy: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="folio-demo-empty">
      <div className="folio-demo-empty-mark"><Icon size={23} /></div>
      <strong>{title}</strong>
      <p>{copy}</p>
      {action && onAction ? <button type="button" onClick={onAction}>{action}<ArrowRight size={14} /></button> : null}
    </div>
  );
}

function DiscoveryQueryComposer({
  query,
  onQuery,
  tags,
  onTags,
}: {
  query: string;
  onQuery: (value: string) => void;
  tags: string[];
  onTags: (tags: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const composerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function addTag() {
    const value = draft.trim();
    if (!value || tags.some((tag) => tag.toLocaleLowerCase() === value.toLocaleLowerCase())) return;
    onTags([...tags, value]);
    setDraft("");
  }

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        window.requestAnimationFrame(() => triggerRef.current?.focus());
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !composerRef.current?.contains(event.target)) setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={composerRef} className="folio-demo-query-composer">
      <label className="folio-demo-query-keyword">
        <Search size={16} />
        <input type="search" value={query} onChange={(event) => onQuery(event.target.value)} placeholder="关键字或画廊 ID" aria-label="检索关键字或画廊 ID" />
      </label>
      {tags.length ? (
        <div className="folio-demo-query-tags" aria-label="已选标签">
          {tags.map((tag) => (
            <span key={tag}>
              {tag}
              <button type="button" aria-label={`移除标签 ${tag}`} onClick={() => onTags(tags.filter((item) => item !== tag))}><X size={12} /></button>
            </span>
          ))}
        </div>
      ) : null}
      <button ref={triggerRef} className="folio-demo-query-add" type="button" aria-expanded={open} aria-controls="folio-demo-tag-picker" onClick={() => setOpen((value) => !value)}>
        <Tag size={15} />
        {tags.length ? `${tags.length} 个标签` : "添加标签"}
        <ChevronDown size={14} />
      </button>
      <AnimatePresence>
        {open ? (
          <m.div
            className="folio-demo-tag-picker"
            id="folio-demo-tag-picker"
            role="dialog"
            aria-label="添加检索标签"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.985 }}
            transition={{ duration: duration.fast, ease: ease.standard }}
          >
            <label>
              <Tag size={15} />
              <input
                autoFocus
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                aria-label="添加检索标签"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addTag();
                  }
                }}
                placeholder="输入标签后回车添加"
              />
            </label>
            <button type="button" disabled={!draft.trim()} onClick={addTag}>添加</button>
            <p>可连续添加多个标签；接入真实词典后这里显示匹配候选。</p>
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function SearchField({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="folio-demo-search-field">
      <Search size={16} />
      <input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      <i />
    </label>
  );
}

function DemoField({
  label,
  value,
  onChange,
  placeholder,
  readOnly,
  wide,
  type = "text",
}: {
  label: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  wide?: boolean;
  type?: "text" | "number";
}) {
  return (
    <label className={"folio-demo-field" + (wide ? " folio-demo-field-wide" : "")}>
      <span>{label}</span>
      <input
        type={type}
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        placeholder={placeholder}
        readOnly={readOnly}
      />
      <i />
    </label>
  );
}

function DemoSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value) ?? options[0];

  function move(step: number) {
    const currentIndex = Math.max(0, options.findIndex((option) => option.value === value));
    const nextIndex = (currentIndex + step + options.length) % options.length;
    onChange(options[nextIndex].value);
    setOpen(true);
  }

  return (
    <div
      className={"folio-demo-select" + (open ? " is-open" : "")}
      ref={rootRef}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        setOpen(false);
        rootRef.current?.querySelector<HTMLButtonElement>(":scope > button")?.focus();
      }}
      onBlur={() => window.requestAnimationFrame(() => {
        if (!rootRef.current?.contains(document.activeElement)) setOpen(false);
      })}
    >
      <span>{label}</span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            move(1);
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            move(-1);
          }
          if (event.key === "Escape") setOpen(false);
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <m.strong
            key={selected.value}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: duration.fast, ease: ease.standard }}
          >
            {selected.label}
          </m.strong>
        </AnimatePresence>
        <ChevronDown size={15} />
      </button>
      <AnimatePresence>
        {open ? (
          <m.div
            className="folio-demo-select-menu"
            id={listId}
            role="listbox"
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: duration.fast, ease: ease.standard }}
          >
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                className={option.value === value ? "is-selected" : ""}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span>{option.label}</span>
                <AnimatePresence>
                  {option.value === value ? (
                    <m.span initial={{ opacity: 0, scale: 0.4, rotate: -30 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} exit={{ opacity: 0, scale: 0.4 }}>
                      <Check size={14} />
                    </m.span>
                  ) : null}
                </AnimatePresence>
              </button>
            ))}
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function ToggleRow({
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
    <label className={"folio-demo-toggle-row" + (checked ? " is-active" : "")}>
      <span><strong>{label}</strong><small>{copy}</small></span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <i aria-hidden="true"><span /></i>
    </label>
  );
}
