import type { SettingsVM } from "./useSettingsState";

export function PreferencesSection({ vm }: { vm: SettingsVM }) {
  return (
    <section className="settings-card">
      <div className="settings-title">
        <h2>隐私与阅读偏好</h2>
        <p>这些选项会保存为本地 UI 默认值。</p>
      </div>
      <div className="preference-row">
        <label className="switch-field">
          <span>隐私模式默认开启</span>
          <input type="checkbox" checked={vm.privacyDefault} onChange={(event) => vm.setPrivacyDefault(event.target.checked)} />
          <i />
        </label>
        <label className="switch-field">
          <span>封面模糊默认开启</span>
          <input type="checkbox" checked={vm.blurDefault} onChange={(event) => vm.setBlurDefault(event.target.checked)} />
          <i />
        </label>
        <label>
          <span>默认阅读模式</span>
          <select value={vm.readerMode} onChange={(event) => vm.setReaderMode(event.target.value as "single" | "scroll")}>
            <option value="single">单页</option>
            <option value="scroll">连续滚动</option>
          </select>
        </label>
      </div>
    </section>
  );
}
