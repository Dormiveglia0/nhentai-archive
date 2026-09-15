import { AlertTriangle, RefreshCw, Save, ArrowLeft, ArrowUpRight } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { type FormEvent, useState } from "react";

import { usePrefersReducedMotion } from "../../lib/motion";
import { SETTINGS_SECTIONS, type SettingsSection } from "../folio/config";
import { ConnectionSection } from "./ConnectionSection";
import { DataSection } from "./DataSection";
import { ExportDefaultsSection } from "./ExportDefaultsSection";
import { PreferencesSection } from "./PreferencesSection";
import { StorageSection } from "./StorageSection";
import { TranslationSection } from "./TranslationSection";
import { useSettingsState } from "./useSettingsState";
import "./SettingsPage.css";
import "./SettingsModules.css";

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

function SettingSymbol({ section }: { section: SettingsSection }) {
  return <svg className={`settings-symbol is-${section}`} viewBox="0 0 200 200" aria-hidden="true">
    <g className="settings-symbol-guides"><path d="M100 12v20m0 136v20M12 100h20m136 0h20"/><circle cx="100" cy="100" r="76"/></g>
    {section === "connection" && <><path d="M55 65h90v70H55zM55 100h90M100 65v70"/><g className="settings-symbol-core"><circle cx="55" cy="65" r="15"/><circle cx="145" cy="65" r="15"/><circle cx="55" cy="135" r="15"/><circle cx="145" cy="135" r="15"/></g></>}
    {section === "translation" && <><path d="M35 65h95l-18-18m18 18-18 18M165 135H70l18-18m-18 18 18 18"/><text x="52" y="133">文</text><text x="124" y="100">A</text></>}
    {section === "privacy" && <><path d="M100 58Q70 38 38 55v94q34-18 62 3 28-21 62-3V55q-32-17-62 3v94"/><path className="settings-symbol-core" d="M53 77q19-7 33 1m-33 20q19-7 33 1m28-21q19-7 33-1m-33 22q19-7 33-1"/></>}
    {section === "export" && <><path d="m100 40 65 33-65 33-65-33zM35 98l65 33 65-33M35 123l65 33 65-33"/><path className="settings-symbol-core" d="M100 10v58m-13-13 13 13 13-13"/></>}
    {section === "data" && <><path d="M35 155h130M52 148v-38h18v38m21 0V54h18v94m21 0V80h18v68"/><path className="settings-symbol-core" d="m40 90 56-61 60 24"/></>}
    {section === "storage" && <><ellipse cx="100" cy="55" rx="58" ry="22"/><path d="M42 55v90c0 30 116 30 116 0V55M42 100c0 30 116 30 116 0"/><path className="settings-symbol-core" d="M61 82v7m0 40v7"/></>}
  </svg>;
}

export function SettingsPage({
  onBlurCoversChange,
}: {
  onBlurCoversChange: (value: boolean) => void;
}) {
  const vm = useSettingsState(onBlurCoversChange);
  const [expanded,setExpanded]=useState<SettingsSection|null>(null);
  const reduceMotion = usePrefersReducedMotion();
  const summaries: Record<SettingsSection,string> = {
    connection: vm.settings ? vm.settings.nhentai.api_key_configured ? "API 已配置" : "API 未配置" : "读取中",
    translation: `${vm.mtProvider === "deepl" ? "DeepL" : "Google"} · ${vm.mtTargetLang === "zh-TW" ? "繁体" : "简体"}`,
    privacy: `${vm.readerMode === "single" ? "单页" : "连续"} · ${vm.blurDefault ? "封面模糊" : "封面可见"}`,
    export: vm.exportDefaults.compress ? "压缩 CBZ" : "不压缩 CBZ", data: "阅读记录与作品分布", storage: "路径与本地数据",
  };
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (vm.dirty && !vm.loading) void vm.save();
  }

  function reload() {
    if (vm.dirty && !window.confirm("重新读取会放弃尚未保存的设置，确定继续吗？")) return;
    void vm.load();
  }

  const syncLabel = vm.loading ? "正在同步" : vm.dirty ? "有未保存更改" : vm.settings ? "已同步" : "等待配置";
  const showActions = vm.dirty;

  return (
    <form className={`folio-page-body folio-settings-body folio-settings-page settings-modules-page${showActions ? "" : " is-readonly"}`} onSubmit={onSubmit}>
      <header className="settings-modules-head"><h1>设置</h1><span className={vm.dirty ? "is-dirty" : ""}>{syncLabel}</span><button type="button" onClick={reload} disabled={vm.loading} aria-label="重新读取设置"><RefreshCw size={18} className={vm.loading ? "spin" : ""} /></button></header>
      <div className={`settings-composition${expanded ? " has-selection" : ""}`}>
        <m.div layout className="settings-modules" transition={{ type: "spring", stiffness: 120, damping: 25 }}>
          {SETTINGS_SECTIONS.map((item, index) => {
            const active = item.id === expanded;
            return <m.button layout="position" className={`settings-module-trigger${active ? " is-selected" : ""}`} key={item.id} type="button" aria-expanded={active} aria-controls={active ? `settings-${item.id}` : undefined} onClick={() => { setExpanded(active ? null : item.id); vm.setSection(item.id); }} transition={reduceMotion ? {duration:0} : {type:"spring",stiffness:120,damping:25}}>
              <span className="settings-module-index">{String(index + 1).padStart(2, "0")}</span>
              {!active && <m.span className="settings-module-object" layoutId={`settings-object-${item.id}`} transition={reduceMotion ? {duration:0} : {type:"spring",stiffness:100,damping:24}}><SettingSymbol section={item.id}/></m.span>}
              {active && <span className="settings-module-selected-mark"><item.icon size={25}/></span>}
              <span className="settings-module-label"><strong>{item.label}</strong><small>{summaries[item.id]}</small></span><ArrowUpRight className="settings-module-arrow" size={18}/>
            </m.button>;
          })}
        </m.div>
        {expanded && <m.section className="settings-module is-open" id={`settings-${expanded}`} key={expanded} initial={reduceMotion ? false : {opacity:0}} animate={{opacity:1}} transition={{duration:reduceMotion ? 0 : .25}}>
          <header className="settings-editor-head">
            <m.div className="settings-editor-object" layoutId={`settings-object-${expanded}`} transition={reduceMotion ? {duration:0} : {type:"spring",stiffness:100,damping:24}}><SettingSymbol section={expanded}/></m.div>
            <h2>{SECTION_COPY[expanded].title}</h2>
            <button type="button" aria-label="返回设置总览" onClick={() => setExpanded(null)}><ArrowLeft size={20}/></button>
          </header>
          <m.div className="settings-module-content" initial={reduceMotion ? false : {opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{duration:reduceMotion ? 0 : .3,delay:reduceMotion ? 0 : .12}}>
            {expanded === "connection" ? <ConnectionSection vm={vm} /> : null}
            {expanded === "translation" ? <TranslationSection vm={vm} /> : null}
            {expanded === "privacy" ? <PreferencesSection vm={vm} /> : null}
            {expanded === "export" ? <ExportDefaultsSection vm={vm} /> : null}
            {expanded === "data" ? <DataSection /> : null}
            {expanded === "storage" ? <StorageSection vm={vm} /> : null}
          </m.div>
        </m.section>}
      </div>
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
