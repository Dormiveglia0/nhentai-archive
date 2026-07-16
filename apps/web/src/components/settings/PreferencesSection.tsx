import { m } from "motion/react";

import { usePrefersReducedMotion } from "../../lib/motion";
import { FolioToggleRow } from "../folio/ui/FolioPrimitives";
import type { SettingsVM } from "./useSettingsState";

export function PreferencesSection({ vm }: { vm: SettingsVM }) {
  const reduceMotion = usePrefersReducedMotion();
  return (
    <section className="folio-settings-section" aria-label="隐私与阅读偏好配置">
      <div className="folio-toggle-list folio-settings-toggle-list">
        <FolioToggleRow
          label="隐私模式默认开启"
          copy="页面切换时保持敏感信息收敛。"
          checked={vm.privacyDefault}
          onChange={vm.setPrivacyDefault}
        />
        <FolioToggleRow
          label="封面模糊默认开启"
          copy="媒体内容在主动操作前保持模糊。"
          checked={vm.blurDefault}
          onChange={vm.setBlurDefault}
        />
      </div>

      <div className="folio-segment-field">
        <span>默认阅读模式</span>
        <div>
          <button className={vm.readerMode === "single" ? "is-active" : ""} type="button" onClick={() => vm.setReaderMode("single")}>
            {vm.readerMode === "single" ? <m.span className="folio-control-active" layoutId={reduceMotion ? undefined : "formal-reader-mode"} /> : null}
            <span>单页</span>
          </button>
          <button className={vm.readerMode === "scroll" ? "is-active" : ""} type="button" onClick={() => vm.setReaderMode("scroll")}>
            {vm.readerMode === "scroll" ? <m.span className="folio-control-active" layoutId={reduceMotion ? undefined : "formal-reader-mode"} /> : null}
            <span>连续滚动</span>
          </button>
        </div>
      </div>

      <p className="folio-settings-note">这里只保存默认值；阅读器内的临时切换不会覆盖此处配置。</p>
    </section>
  );
}
