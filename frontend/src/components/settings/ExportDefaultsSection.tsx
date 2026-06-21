import { Archive, Braces, FileText } from "lucide-react";

import { navigate } from "../../lib/navigation";
import type { SettingsVM } from "./useSettingsState";

type ToggleKey = "write_comicinfo" | "keep_json" | "compress";

export function ExportDefaultsSection({ vm }: { vm: SettingsVM }) {
  const opts = vm.exportDefaults;

  const options: { key: ToggleKey; label: string; hint: string; icon: typeof FileText }[] = [
    {
      key: "write_comicinfo",
      label: "写入 ComicInfo.xml",
      hint: "用治理后的最终元数据生成 ComicInfo.xml 一并打包，便于阅读器识别。",
      icon: FileText,
    },
    {
      key: "keep_json",
      label: "保留原始 JSON",
      hint: "导出时保留源 CBZ 内的原始 metadata JSON 成员，作为溯源备份。",
      icon: Braces,
    },
    {
      key: "compress",
      label: "压缩打包",
      hint: "以 ZIP 压缩导出；关闭则仅存储（体积更大但打包更快）。",
      icon: Archive,
    },
  ];

  return (
    <section className="settings-card">
      <div className="settings-title">
        <h2>导出默认</h2>
        <p>导出中心打开时的默认选项。在这里保存后，每次进入导出页都会以这套默认开始，仍可在导出页临时调整。</p>
      </div>

      <div className="settings-option-list">
        {options.map((option) => {
          const Icon = option.icon;
          const on = opts[option.key];
          return (
            <label className={`settings-option-row${on ? " is-on" : ""}`} key={option.key}>
              <span className="settings-option-icon">
                <Icon size={18} />
              </span>
              <span className="settings-option-text">
                <strong>{option.label}</strong>
                <small>{option.hint}</small>
              </span>
              <span className="switch-field">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(event) => vm.setExportDefaults({ ...opts, [option.key]: event.target.checked })}
                />
                <i />
              </span>
            </label>
          );
        })}
      </div>

      <div className="settings-option-foot">
        <span>共 {options.filter((option) => opts[option.key]).length} / {options.length} 项默认开启</span>
        <button type="button" onClick={() => navigate({ name: "export" })}>
          打开导出中心
        </button>
      </div>
    </section>
  );
}
