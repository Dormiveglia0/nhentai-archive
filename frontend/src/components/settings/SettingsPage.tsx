import { AlertTriangle, RefreshCw, Save } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { type FormEvent } from "react";

import { duration, ease, usePrefersReducedMotion } from "../../lib/motion";
import { SETTINGS_SECTIONS, type SettingsSection } from "../folio/config";
import { ConnectionSection } from "./ConnectionSection";
import { DataSection } from "./DataSection";
import { ExportDefaultsSection } from "./ExportDefaultsSection";
import { PreferencesSection } from "./PreferencesSection";
import { StorageSection } from "./StorageSection";
import { TranslationSection } from "./TranslationSection";
import { useSettingsState } from "./useSettingsState";
import "./SettingsPage.css";

const SECTION_COPY: Record<SettingsSection, { title: string; copy: string }> = {
  connection: {
    title: "数据源与连接",
    copy: "管理远端接口、敏感凭据与当前运行态；密钥只报告配置状态，不会回显明文。",
  },
  translation: {
    title: "机器翻译配置",
    copy: "选择词典建议使用的服务、目标语言与单次批量边界。",
  },
  privacy: {
    title: "隐私与阅读偏好",
    copy: "设置后续页面打开时采用的默认保护方式与阅读布局。",
  },
  export: {
    title: "CBZ 默认配方",
    copy: "只定义导出中心的起始选项，单次下载仍可临时调整。",
  },
  data: {
    title: "本地馆藏概览",
    copy: "读取真实馆藏与文件清单，集中呈现规模、来源与需要维护的项目。",
  },
  storage: {
    title: "存储与路径",
    copy: "只读核对当前数据目录、源文件占用与可回收空间。",
  },
};

export function SettingsPage() {
  const vm = useSettingsState();
  const reduceMotion = usePrefersReducedMotion();
  const current = SECTION_COPY[vm.section];

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (vm.dirty && !vm.loading) void vm.save();
  }

  function reload() {
    if (vm.dirty && !window.confirm("重新读取会放弃尚未保存的设置，确定继续吗？")) return;
    void vm.load();
  }

  const syncLabel = vm.loading ? "正在同步" : vm.dirty ? "有未保存更改" : vm.settings ? "已同步" : "等待配置";

  return (
    <form className="folio-page-body folio-settings-body folio-settings-page" onSubmit={onSubmit}>
      <nav className="folio-settings-nav" aria-label="设置章节">
        {SETTINGS_SECTIONS.map((item) => {
          const Icon = item.icon;
          const active = vm.section === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={active ? "is-active" : ""}
              aria-current={active ? "page" : undefined}
              onClick={() => vm.setSection(item.id)}
            >
              {active ? (
                <m.span
                  className="folio-settings-nav-active"
                  layoutId="formal-settings-nav-active"
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
                />
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
          key={vm.section}
          className="folio-settings-stage"
          initial={{ opacity: 0, y: reduceMotion ? 0 : 10, clipPath: reduceMotion ? "none" : "inset(0 0 8% 0)" }}
          animate={{ opacity: 1, y: 0, clipPath: "inset(0 0 0% 0)" }}
          exit={{ opacity: 0, y: reduceMotion ? 0 : -7, clipPath: reduceMotion ? "none" : "inset(0 0 6% 0)" }}
          transition={{ duration: reduceMotion ? 0 : duration.fast, ease: ease.standard }}
        >
          <header className="folio-settings-head">
            <div>
              <h2>{current.title}</h2>
              <p>{current.copy}</p>
            </div>
            <div className={`folio-settings-state${vm.dirty ? " is-dirty" : ""}${vm.loading ? " is-loading" : ""}`}>
              <i />
              {syncLabel}
            </div>
          </header>

          {vm.section === "connection" ? <ConnectionSection vm={vm} /> : null}
          {vm.section === "translation" ? <TranslationSection vm={vm} /> : null}
          {vm.section === "privacy" ? <PreferencesSection vm={vm} /> : null}
          {vm.section === "export" ? <ExportDefaultsSection vm={vm} /> : null}
          {vm.section === "data" ? <DataSection /> : null}
          {vm.section === "storage" ? <StorageSection vm={vm} /> : null}

          <AnimatePresence mode="popLayout">
            {vm.error ? (
              <m.div
                key={`error-${vm.error}`}
                className="folio-settings-feedback is-error"
                role="alert"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
              >
                <AlertTriangle size={16} />
                <span>{vm.error}</span>
              </m.div>
            ) : null}
            {vm.message ? (
              <m.div
                key={`message-${vm.message}`}
                className="folio-settings-feedback"
                role="status"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
              >
                <i />
                <span>{vm.message}</span>
              </m.div>
            ) : null}
          </AnimatePresence>
        </m.section>
      </AnimatePresence>

      <footer className="folio-settings-actions">
        <div className="folio-settings-action-state">
          <span className={vm.dirty ? "is-dirty" : ""} />
          <p>
            <strong>{vm.dirty ? "设置尚未保存" : "当前配置已同步"}</strong>
            <small>{vm.dirty ? "保存后立即更新本机运行态" : "敏感值不会在页面中回显"}</small>
          </p>
        </div>
        <div className="folio-settings-action-buttons">
          <button className="folio-settings-action" type="button" onClick={reload} disabled={vm.loading}>
            <RefreshCw size={15} className={vm.loading ? "spin" : undefined} />
            重新读取
          </button>
          <button className="folio-settings-action is-primary" type="submit" disabled={vm.loading || !vm.dirty || !vm.settings}>
            <Save size={15} />
            保存设置
          </button>
        </div>
      </footer>
    </form>
  );
}
