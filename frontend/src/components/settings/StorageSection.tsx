import type { SettingsVM } from "./useSettingsState";

export function StorageSection({ vm }: { vm: SettingsVM }) {
  return (
    <section className="settings-card">
      <div className="settings-title">
        <h2>本地存储</h2>
        <p>当前阶段只展示真实路径；目录迁移和容量策略后续接入。</p>
      </div>
      <div className="path-grid">
        {vm.settings
          ? Object.entries(vm.settings.storage).map(([key, value]) => (
              <label key={key}>
                <span>{key}</span>
                <input value={value} readOnly />
              </label>
            ))
          : null}
      </div>
    </section>
  );
}
