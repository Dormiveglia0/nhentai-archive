import { Database, EyeOff, Folder, KeyRound, Languages, RefreshCw, Save } from "lucide-react";
import { FormEvent } from "react";

import { FadeIn, Presence } from "../../lib/motion";
import { ConnectionSection } from "./ConnectionSection";
import { PreferencesSection } from "./PreferencesSection";
import { StorageSection } from "./StorageSection";
import { TranslationSection } from "./TranslationSection";
import { SummaryRow } from "./settingsHelpers";
import { type SettingsSection, useSettingsState } from "./useSettingsState";

const NAV: { key: SettingsSection; label: string; icon: typeof Database }[] = [
  { key: "connection", label: "数据源与连接", icon: Database },
  { key: "translation", label: "机器翻译", icon: Languages },
  { key: "preferences", label: "隐私与阅读", icon: EyeOff },
  { key: "storage", label: "存储与路径", icon: Folder },
];

export function SettingsPage() {
  const vm = useSettingsState();

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void vm.save();
  }

  const mt = vm.settings?.machine_translation ?? null;
  const mtLabel = vm.mtProvider === "deepl" ? "DeepL API" : "Google 免费翻译";

  return (
    <section className="page settings-page">
      <div className="hero">
        <div>
          <h1>设置</h1>
          <p>管理数据源连接、机器翻译、隐私安全、存储路径与阅读偏好。</p>
        </div>
        <div className="sketch" aria-hidden="true" />
      </div>

      <form className="settings-layout" onSubmit={onSubmit}>
        <FadeIn className="settings-rail-motion" x={-12}>
          <aside className="settings-rail">
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  className={vm.section === item.key ? "active" : ""}
                  onClick={() => vm.setSection(item.key)}
                >
                  <Icon size={17} />
                  {item.label}
                </button>
              );
            })}
          </aside>
        </FadeIn>

        <FadeIn className="settings-main-motion" y={8} delay={0.05}>
          <main>
            <Presence>
              <FadeIn key={vm.section} className="settings-main" y={8}>
                {vm.section === "connection" ? <ConnectionSection vm={vm} /> : null}
                {vm.section === "translation" ? <TranslationSection vm={vm} /> : null}
                {vm.section === "preferences" ? <PreferencesSection vm={vm} /> : null}
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

            <div className="settings-bottom">
              <button type="button" onClick={() => void vm.load()} disabled={vm.loading}>
                <RefreshCw size={16} />
                重新读取
              </button>
              <button className="primary-action" type="submit" disabled={vm.loading}>
                <Save size={16} />
                保存设置
              </button>
            </div>
          </main>
        </FadeIn>

        <FadeIn className="settings-summary-motion" x={12} delay={0.1}>
          <aside className="settings-summary">
            <h2>配置摘要</h2>
            <SummaryRow label="NH API Key" value={vm.settings?.nhentai.api_key_configured ? "已配置" : "未配置"} />
            <SummaryRow label="Key 来源" value={vm.settings?.nhentai.api_key_source ?? "none"} />
            <SummaryRow label="机翻服务" value={mtLabel} />
            <SummaryRow
              label="DeepL Key"
              value={vm.mtProvider === "deepl" ? (mt?.deepl_api_key_configured ? "已配置" : "未配置") : "不需要"}
            />
            <SummaryRow label="隐私默认" value={vm.privacyDefault ? "开启" : "关闭"} />
            <SummaryRow label="封面模糊" value={vm.blurDefault ? "开启" : "关闭"} />
            <SummaryRow label="阅读模式" value={vm.readerMode === "single" ? "单页" : "连续滚动"} />
            <div className="settings-help">
              <KeyRound size={18} />
              <p>保存后后端会立即更新运行态客户端，发现、导入与机翻不需要重启服务。</p>
            </div>
          </aside>
        </FadeIn>
      </form>
    </section>
  );
}
