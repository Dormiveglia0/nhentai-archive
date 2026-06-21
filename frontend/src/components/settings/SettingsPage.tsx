import {
  Activity,
  BarChart3,
  Database,
  Download,
  EyeOff,
  Folder,
  HardDrive,
  Languages,
  RefreshCw,
  Save,
  ShieldCheck,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import { api, type FileOverview, type LibrarySummary } from "../../lib/api";
import { FadeIn, Presence, Stagger, StaggerItem } from "../../lib/motion";
import { NumberTicker } from "../effects/NumberTicker";
import { formatBytes } from "../library/libraryHelpers";
import { ConnectionSection } from "./ConnectionSection";
import { DataSection } from "./DataSection";
import { ExportDefaultsSection } from "./ExportDefaultsSection";
import { PreferencesSection } from "./PreferencesSection";
import { StorageSection } from "./StorageSection";
import { TranslationSection } from "./TranslationSection";
import { type SettingsSection, useSettingsState } from "./useSettingsState";

const NAV: { key: SettingsSection; label: string; desc: string; icon: typeof Database }[] = [
  { key: "connection", label: "连接", desc: "远端 API 与运行态", icon: Database },
  { key: "translation", label: "翻译", desc: "服务商、语言与测试", icon: Languages },
  { key: "preferences", label: "隐私阅读", desc: "默认保护与阅读模式", icon: EyeOff },
  { key: "export", label: "导出", desc: "CBZ 打包默认值", icon: Download },
  { key: "data", label: "数据", desc: "馆藏摘要与语言分布", icon: BarChart3 },
  { key: "storage", label: "存储", desc: "目录、源文件与清理", icon: Folder },
];

export function SettingsPage() {
  const vm = useSettingsState();
  const [library, setLibrary] = useState<LibrarySummary | null>(null);
  const [files, setFiles] = useState<FileOverview | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([api.librarySummary(), api.filesOverview()])
      .then(([libraryPayload, filesPayload]) => {
        if (!alive) return;
        setLibrary(libraryPayload);
        setFiles(filesPayload);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void vm.save();
  }

  const mt = vm.settings?.machine_translation ?? null;
  const mtLabel = vm.mtProvider === "deepl" ? "DeepL API" : "Google 免费翻译";
  const current = NAV.find((item) => item.key === vm.section) ?? NAV[0];
  const needsStorageAttention = Boolean(files && (files.missing_source > 0 || files.reclaimable_bytes > 0));
  const needsConnectionAttention = !vm.settings?.nhentai.api_key_configured;
  const attentionText = needsConnectionAttention
    ? "连接未就绪"
    : needsStorageAttention
      ? "存储需检查"
      : "配置稳定";

  return (
    <section className="page settings-page settings-deck-page">
      <form id="settings-form" className="settings-deck-layout" onSubmit={onSubmit}>
        <FadeIn className="settings-console-rail" x={-8}>
          <div className="settings-console-brand">
            <span>NH Archive</span>
            <h1>设置</h1>
            <p>本地配置、密钥状态、导出默认值和存储健康集中在这里处理。</p>
          </div>

          <Stagger className="settings-console-nav" key="settings-console-nav">
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <StaggerItem key={item.key}>
                  <button
                    type="button"
                    className={vm.section === item.key ? "active" : ""}
                    onClick={() => vm.setSection(item.key)}
                  >
                    <Icon size={17} />
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.desc}</small>
                    </span>
                  </button>
                </StaggerItem>
              );
            })}
          </Stagger>

          <StatusDeck
            apiReady={Boolean(vm.settings?.nhentai.api_key_configured)}
            mtLabel={mtLabel}
            mtReady={vm.mtProvider !== "deepl" || Boolean(mt?.deepl_api_key_configured)}
            privacyOn={vm.privacyDefault}
            library={library}
            files={files}
          />
        </FadeIn>

        <FadeIn className="settings-stage-motion" y={10}>
          <section className="settings-stage">
            <header className="settings-console-head">
              <div className="settings-console-title">
                <p>{contextCopy(vm.section)}</p>
              </div>
              <div className={`settings-console-health ${needsConnectionAttention || needsStorageAttention ? "attention" : ""}`}>
                <ShieldCheck size={18} />
                <span>{attentionText}</span>
              </div>
            </header>

            <div className="settings-section-meta">
              <span>{current.desc}</span>
              <strong>{vm.loading ? "同步中" : "保存后即时生效"}</strong>
            </div>

            <Presence>
              <FadeIn key={vm.section} className="settings-main" y={8}>
                {vm.section === "connection" ? <ConnectionSection vm={vm} /> : null}
                {vm.section === "translation" ? <TranslationSection vm={vm} /> : null}
                {vm.section === "preferences" ? <PreferencesSection vm={vm} /> : null}
                {vm.section === "export" ? <ExportDefaultsSection vm={vm} /> : null}
                {vm.section === "data" ? <DataSection /> : null}
                {vm.section === "storage" ? <StorageSection vm={vm} /> : null}
              </FadeIn>
            </Presence>

            {vm.error ? (
              <FadeIn key={`error-${vm.error}`} y={6}>
                <div className="notice error">{vm.error}</div>
              </FadeIn>
            ) : null}
            {vm.message ? (
              <FadeIn key={`message-${vm.message}`} y={6}>
                <div className="notice slim">{vm.message}</div>
              </FadeIn>
            ) : null}
          </section>
        </FadeIn>

        <div className="settings-bottom settings-command-bar">
          <div>
            <button type="button" onClick={() => void vm.load()} disabled={vm.loading}>
              <RefreshCw size={16} />
              重新读取
            </button>
            <button className="primary-action" type="submit" disabled={vm.loading}>
              <Save size={16} />
              保存设置
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}

function StatusDeck({
  apiReady,
  mtLabel,
  mtReady,
  privacyOn,
  library,
  files,
}: {
  apiReady: boolean;
  mtLabel: string;
  mtReady: boolean;
  privacyOn: boolean;
  library: LibrarySummary | null;
  files: FileOverview | null;
}) {
  const reclaimable = files?.reclaimable_bytes ?? 0;
  const cards = [
    {
      label: "远端连接",
      value: apiReady ? "Ready" : "Missing",
      detail: apiReady ? "API Key 已配置" : "等待 API Key",
      icon: Activity,
      attention: !apiReady,
    },
    {
      label: "翻译引擎",
      value: mtReady ? "Online" : "Key",
      detail: mtLabel,
      icon: Languages,
      attention: !mtReady,
    },
    {
      label: "馆藏规模",
      value: library?.total ?? 0,
      detail: `${library?.reading ?? 0} 部阅读中`,
      icon: BarChart3,
    },
    {
      label: "可回收空间",
      value: reclaimable,
      detail: privacyOn ? "隐私默认开启" : "隐私默认关闭",
      icon: HardDrive,
      attention: reclaimable > 0 || (files?.missing_source ?? 0) > 0,
      format: formatBytes,
    },
  ];

  return (
    <Stagger className="settings-status-deck" key="settings-status-deck">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <StaggerItem key={card.label} className="settings-status-cell">
            <article className={`settings-status-card${card.attention ? " needs-attention" : ""}`}>
              <Icon size={20} />
              <span>{card.label}</span>
              <strong>
                {typeof card.value === "number" ? <NumberTicker value={card.value} format={card.format} /> : card.value}
              </strong>
              <small>{card.detail}</small>
            </article>
          </StaggerItem>
        );
      })}
    </Stagger>
  );
}

function contextCopy(section: SettingsSection) {
  switch (section) {
    case "connection":
      return "先确认远端连接，导入、发现和缓存状态都会跟着这里变化。";
    case "translation":
      return "选择翻译服务并即时测试，词典批量填充会复用同一套配置。";
    case "preferences":
      return "这些是本地阅读体验默认值，保存后会影响后续打开的页面。";
    case "export":
      return "导出默认只决定起点，导出中心里仍然可以对单次任务临时调整。";
    case "data":
      return "这里显示真实馆藏健康度，用来判断是否需要治理或文件维护。";
    case "storage":
      return "路径只读展示，清理和删除操作放在文件管理里，避免误删。";
  }
}
