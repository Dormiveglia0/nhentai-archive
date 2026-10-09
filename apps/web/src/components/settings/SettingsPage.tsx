import { AlertTriangle, RefreshCw, Save } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { type FormEvent, useEffect, useRef } from "react";

import { SlidingIndicator, transitionTabs } from "../../lib/motion";
import { SETTINGS_SECTIONS, type SettingsSection } from "../folio/config";
import { ConnectionSection } from "./ConnectionSection";
import { DataSection } from "./DataSection";
import { ExportDefaultsSection } from "./ExportDefaultsSection";
import { PreferencesSection } from "./PreferencesSection";
import { StorageSection } from "./StorageSection";
import { TranslationSection } from "./TranslationSection";
import { SmtpSection } from "./SmtpSection";
import { useSettingsState } from "./useSettingsState";
import "./SettingsPage.css";

export function SettingsPage({
  onBlurCoversChange,
}: {
  onBlurCoversChange: (value: boolean) => void;
}) {
  const vm = useSettingsState(onBlurCoversChange);
  const current = SETTINGS_SECTIONS.find(section => section.id === vm.section)!;
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    formRef.current?.querySelector<HTMLElement>(".folio-settings-nav [aria-current='page']")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [vm.section]);

  function selectSection(section: SettingsSection) {
    transitionTabs(SETTINGS_SECTIONS.map(item => item.id), vm.section, section, target => {
      vm.setSection(target);
      window.history.replaceState(null, "", "#settings?section=" + target);
    }, "settings");
    const form = formRef.current;
    const scroll = form?.closest<HTMLElement>(".folio-scroll");
    if (!form || !scroll) return;
    const top = scroll.scrollTop + form.getBoundingClientRect().top - scroll.getBoundingClientRect().top;
    if (scroll.scrollTop > top) scroll.scrollTo({ top, behavior: "auto" });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (vm.dirty && !vm.loading) void vm.save();
  }

  function reload() {
    if (vm.dirty && !window.confirm("重新读取会放弃尚未保存的设置，确定继续吗？")) return;
    void vm.load();
  }

  const showActions = vm.dirty || !["data", "storage", "notifications"].includes(vm.section);

  return (
    <form ref={formRef} className={`folio-page-body folio-settings-body folio-settings-page${showActions ? "" : " is-readonly"}`} onSubmit={onSubmit}>
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
                <SlidingIndicator className="folio-settings-nav-active" layoutId="formal-settings-nav-active" />
              ) : null}
              <Icon size={16} />
              <strong>{item.label}</strong>
            </button>
          );
        })}
      </nav>

        <section className="folio-settings-stage" aria-label={current.label}>
          {vm.section === "connection" ? <ConnectionSection vm={vm} /> : null}
          {vm.section === "translation" ? <TranslationSection vm={vm} /> : null}
          {vm.section === "privacy" ? <PreferencesSection vm={vm} /> : null}
          {vm.section === "export" ? <ExportDefaultsSection vm={vm} /> : null}
          {vm.section === "data" ? <DataSection /> : null}
          {vm.section === "storage" ? <StorageSection vm={vm} /> : null}
          {vm.section === "notifications" ? <SmtpSection /> : null}

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
        </section>

      {showActions ? (
        <footer className="folio-settings-actions">
          <div className="folio-settings-action-state">
            <span className={vm.dirty ? "is-dirty" : ""} />
            <p>
              <strong>{vm.loading ? "正在读取配置" : vm.dirty ? "设置尚未保存" : vm.settings ? "当前配置已同步" : "等待配置"}</strong>
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
