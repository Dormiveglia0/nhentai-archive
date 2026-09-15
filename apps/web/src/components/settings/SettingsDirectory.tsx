import { m } from "motion/react";
import { SETTINGS_SECTIONS, type SettingsSection } from "../folio/config";
import { usePrefersReducedMotion } from "../../lib/motion";
import type { useSettingsState } from "./useSettingsState";

export function SettingsDirectory({ vm, onSelect }: { vm: ReturnType<typeof useSettingsState>; onSelect: (section: SettingsSection) => void }) {
  const reduced = usePrefersReducedMotion();
  const index = SETTINGS_SECTIONS.findIndex(item => item.id === vm.section);
  const summary: Record<SettingsSection, string> = {
    connection: vm.settings ? vm.settings.nhentai.api_key_configured ? "API 已配置" : "API 未配置" : "读取中",
    translation: `${vm.mtProvider === "deepl" ? "DeepL" : "Google"} · ${vm.mtTargetLang === "zh-TW" ? "繁体" : "简体"}`,
    privacy: `${vm.readerMode === "single" ? "单页" : "连续"} · ${vm.blurDefault ? "封面模糊" : "封面可见"}`,
    export: `${vm.exportDefaults.compress ? "压缩" : "不压缩"} · ${vm.exportDefaults.write_comicinfo ? "ComicInfo" : "原始元数据"}`,
    data: "阅读记录 · 作品分布",
    storage: "路径 · 本地数据",
  };
  const transition = reduced ? {duration:0} : {type:"spring" as const, stiffness:240, damping:29};
  return <aside className={`settings-control-directory${vm.dirty ? " is-dirty" : ""}`}>
    <header><div><span>CONFIGURATION</span><h1>设置</h1></div><span className="settings-control-state"><i />{vm.loading ? "同步中" : vm.dirty ? "未保存" : "已同步"}</span></header>
    <div className="settings-control-body">
      <div className="settings-control-track" aria-hidden="true"><m.i animate={{y:index*78}} transition={transition}/></div>
      <nav className="settings-control-modules" aria-label="设置章节">
        {SETTINGS_SECTIONS.map((item,i) => {
          const Icon=item.icon, active=i===index;
          return <m.button type="button" key={item.id} aria-current={active ? "page" : undefined} onClick={()=>onSelect(item.id)}
            animate={{x:active ? 22 : Math.abs(i-index) === 1 ? 6 : 0}} transition={transition}>
            <span className="settings-module-number">{String(i+1).padStart(2,"0")}</span><Icon size={21}/><span><strong>{item.label}</strong><small>{summary[item.id]}</small></span><i aria-hidden="true" />
          </m.button>;
        })}
      </nav>
    </div>
    <footer aria-hidden="true"><span>{String(index+1).padStart(2,"0")}</span><div>{SETTINGS_SECTIONS.map((item,i)=><m.i key={item.id} animate={{scaleY:i===index?1:.25,opacity:i===index?1:.25}} transition={transition}/>)}</div><small>/ 06</small></footer>
  </aside>;
}
