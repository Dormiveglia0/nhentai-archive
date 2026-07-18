import { KeyRound, ShieldCheck } from "lucide-react";
import { m } from "motion/react";

import { usePrefersReducedMotion } from "../../lib/motion";
import { FolioToggleRow } from "../folio/ui/FolioPrimitives";
import type { SettingsVM } from "./useSettingsState";

export function PreferencesSection({ vm }: { vm: SettingsVM }) {
  const reduceMotion = usePrefersReducedMotion();
  return (
    <section className="folio-settings-section" aria-label="访问与阅读配置">
      <div className="folio-settings-subhead">
        <h3><KeyRound size={16} />修改访问密码</h3>
        <span>任意非空密码，不限制字符组合</span>
      </div>
      <div className="folio-field-matrix folio-settings-password-grid">
        <label className="folio-field">
          <span>当前密码</span>
          <input
            type="password"
            value={vm.currentPassword}
            onChange={(event) => vm.setCurrentPassword(event.target.value)}
            autoComplete="current-password"
            maxLength={256}
          />
          <i />
        </label>
        <label className="folio-field">
          <span>新密码</span>
          <input
            type="password"
            value={vm.newPassword}
            onChange={(event) => vm.setNewPassword(event.target.value)}
            autoComplete="new-password"
            maxLength={256}
          />
          <i />
        </label>
        <label className="folio-field">
          <span>再次输入新密码</span>
          <input
            type="password"
            value={vm.passwordConfirmation}
            onChange={(event) => vm.setPasswordConfirmation(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              void vm.changePassword();
            }}
            autoComplete="new-password"
            maxLength={256}
          />
          <i />
        </label>
      </div>
      <div className="folio-settings-inline-actions folio-settings-password-actions">
        <button
          className="folio-line-button"
          type="button"
          onClick={() => void vm.changePassword()}
          disabled={vm.loading || !vm.currentPassword || !vm.newPassword}
        >
          <ShieldCheck size={15} />
          修改密码
        </button>
        <span className="folio-settings-action-hint">修改后当前设备保持登录，其他设备的会话会失效。</span>
      </div>

      <div className="folio-settings-subhead">
        <h3>封面与阅读默认值</h3>
      </div>
      <div className="folio-toggle-list folio-settings-toggle-list">
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

      <p className="folio-settings-note">这里只保存默认值；阅读器内仍可随时临时切换阅读方式。</p>
    </section>
  );
}
