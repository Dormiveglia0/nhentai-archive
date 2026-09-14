import { AlertTriangle, RefreshCw, Save } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { type FormEvent, useRef } from "react";

import { SelectionStage, usePrefersReducedMotion } from "../../lib/motion";
import { SETTINGS_SECTIONS, type SettingsSection } from "../folio/config";
import { ConnectionSection } from "./ConnectionSection";
import { DataSection } from "./DataSection";
import { ExportDefaultsSection } from "./ExportDefaultsSection";
import { PreferencesSection } from "./PreferencesSection";
import { StorageSection } from "./StorageSection";
import { TranslationSection } from "./TranslationSection";
import { useSettingsState } from "./useSettingsState";
import "./SettingsPage.css";

const SECTION_COPY: Record<SettingsSection, { title: string }> = {
  connection: {
    title: "数据源与连接",
  },
  translation: {
    title: "机器翻译配置",
  },
  privacy: {
    title: "访问与阅读偏好",
  },
  export: {
    title: "CBZ 导出默认值",
  },
  data: {
    title: "作品与阅读报表",
  },
  storage: {
    title: "存储与路径",
  },
};

export function SettingsPage({
  onBlurCoversChange,
}: {
  onBlurCoversChange: (value: boolean) => void;
}) {
  const vm = useSettingsState(onBlurCoversChange);
  const reduceMotion = usePrefersReducedMotion();
  const current = SECTION_COPY[vm.section];
  const formRef = useRef<HTMLFormElement>(null);

  function selectSection(section: SettingsSection) {
    vm.setSection(section);
    const form = formRef.current;
    const scroll = form?.closest<HTMLElement>(".folio-scroll");
    if (!form || !scroll) return;
    const top = scroll.scrollTop + form.getBoundingClientRect().top - scroll.getBoundingClientRect().top;
    scroll.scrollTo({ top, behavior: reduceMotion ? "auto" : "smooth" });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (vm.dirty && !vm.loading) void vm.save();
  }

  function reload() {
    if (vm.dirty && !window.confirm("重新读取会放弃尚未保存的设置，确定继续吗？")) return;
    void vm.load();
  }

  const syncLabel = vm.loading ? "正在同步" : vm.dirty ? "有未保存更改" : vm.settings ? "已同步" : "等待配置";
  const showActions = vm.dirty || (vm.section !== "data" && vm.section !== "storage");

  return (
    <form ref={formRef} className={`folio-page-body folio-settings-body folio-settings-page${showActions ? "" : " is-readonly"}`} onSubmit={onSubmit}>
      <div className="settings-directory">
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
              onClick={() => selectSection(item.id)}
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
              <small>{String(SETTINGS_SECTIONS.indexOf(item) + 1).padStart(2, "0")}</small>
            </button>
          );
        })}
      </nav>
      <div className="settings-directory-state"><i className={vm.dirty ? "is-dirty" : ""} /><span>{syncLabel}</span></div>
      </div>

      <SelectionStage selection={vm.section} className="folio-settings-stage">
          <header className="folio-settings-head">
            <div>
              <h2>{current.title}</h2>
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
      </SelectionStage>

      {showActions ? (
        <footer className="folio-settings-actions">
          <div className="folio-settings-action-state">
            <span className={vm.dirty ? "is-dirty" : ""} />
            <p>
              <strong>{vm.dirty ? "设置尚未保存" : "当前配置已同步"}</strong>
              <small>{vm.dirty ? "更改尚未保存" : "密码与密钥已隐藏"}</small>
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
      ) : null}
    </form>
  );
}
