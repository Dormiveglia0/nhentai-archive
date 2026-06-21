import { navigate } from "../../lib/navigation";
import type { SettingsVM } from "./useSettingsState";

export function ExportDefaultsSection({ vm }: { vm: SettingsVM }) {
  const opts = vm.exportDefaults;

  const toggles: { key: "write_comicinfo" | "keep_json" | "compress"; label: string; hint: string }[] = [
    { key: "write_comicinfo", label: "写入 ComicInfo.xml", hint: "用治理后的最终元数据生成 ComicInfo.xml 写入 CBZ" },
    { key: "keep_json", label: "保留原始 JSON", hint: "导出时保留源 CBZ 内的原始 metadata JSON 成员" },
    { key: "compress", label: "压缩打包", hint: "以 ZIP 压缩导出（关闭则仅存储，体积更大但更快）" },
  ];

  return (
    <section className="settings-card">
      <div className="settings-title">
        <h2>导出默认</h2>
        <p>导出中心打开时的默认选项。在这里保存后，每次进入导出页都会以这套默认开始（仍可在导出页临时调整）。</p>
      </div>

      <div className="preference-row">
        {toggles.map((toggle) => (
          <label className="switch-field" key={toggle.key} title={toggle.hint}>
            <span>{toggle.label}</span>
            <input
              type="checkbox"
              checked={opts[toggle.key]}
              onChange={(event) => vm.setExportDefaults({ ...opts, [toggle.key]: event.target.checked })}
            />
            <i />
          </label>
        ))}
      </div>

      <dl className="settings-kv">
        {toggles.map((toggle) => (
          <div key={toggle.key}>
            <dt>{toggle.label}</dt>
            <dd>{opts[toggle.key] ? "默认开启" : "默认关闭"}</dd>
          </div>
        ))}
      </dl>

      <div className="connection-actions">
        <button type="button" onClick={() => navigate({ name: "export" })}>
          打开导出中心
        </button>
      </div>
    </section>
  );
}
