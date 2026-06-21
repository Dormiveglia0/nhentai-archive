import { navigate } from "../../lib/navigation";
import type { SettingsVM } from "./useSettingsState";

export function ExportDefaultsSection({ vm }: { vm: SettingsVM }) {
  const exportSettings = vm.settings?.export;
  const presets = exportSettings?.presets ?? [];
  const active = presets.find((preset) => preset.id === vm.exportActivePreset) ?? presets[0] ?? null;

  return (
    <section className="settings-card">
      <div className="settings-title">
        <h2>导出默认</h2>
        <p>导出中心使用的默认预设；这里切换的活动预设会被保存。命名规则等明细在导出页编辑。</p>
      </div>

      <div className="settings-grid">
        <label>
          <span>活动预设</span>
          <select value={vm.exportActivePreset} onChange={(event) => vm.setExportActivePreset(event.target.value)}>
            {presets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {active ? (
        <dl className="settings-kv">
          <div>
            <dt>命名规则</dt>
            <dd>{active.naming_rule}</dd>
          </div>
          <div>
            <dt>ComicInfo</dt>
            <dd>{active.comicinfo_rule}</dd>
          </div>
          <div>
            <dt>元数据</dt>
            <dd>{active.meta_rule}</dd>
          </div>
          <div>
            <dt>压缩</dt>
            <dd>{active.compression}</dd>
          </div>
        </dl>
      ) : null}

      {presets.length > 1 ? (
        <>
          <div className="settings-subhead">
            <h3>全部预设</h3>
          </div>
          <div className="settings-chip-row">
            {presets.map((preset) => (
              <span key={preset.id} className={`settings-chip${preset.id === vm.exportActivePreset ? " is-active" : ""}`}>
                {preset.name}
              </span>
            ))}
          </div>
        </>
      ) : null}

      <div className="connection-actions">
        <button type="button" onClick={() => navigate({ name: "export" })}>
          打开导出中心
        </button>
      </div>
    </section>
  );
}
