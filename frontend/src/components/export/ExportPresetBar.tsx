import { Download } from "lucide-react";

import type { ExportPreset, SettingsSummary } from "../../lib/api";

type ExportPresetBarProps = {
  settings: SettingsSummary | null;
  activePreset: ExportPreset | null;
  selectedCount: number;
  exportableCount: number;
  downloading: boolean;
  onPresetChange: (presetId: string) => void;
  onSavePreset: () => void;
  onDownload: () => void;
};

export function ExportPresetBar({
  settings,
  activePreset,
  selectedCount,
  exportableCount,
  downloading,
  onPresetChange,
  onSavePreset,
  onDownload,
}: ExportPresetBarProps) {
  const downloadLabel = exportableCount > 1 ? `下载选中 (${exportableCount})` : "下载选中";
  return (
    <section className="export-panel export-preset-panel">
      <div className="export-panel-head compact">
        <div>
          <h2>
            导出预设 <small>当前：{activePreset?.name ?? "-"}</small>
          </h2>
        </div>
        <select
          className="export-preset-select"
          value={settings?.export.active_preset_id ?? ""}
          onChange={(event) => onPresetChange(event.target.value)}
          disabled={!settings?.export.presets.length}
          aria-label="选择导出预设"
        >
          {settings?.export.presets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.name}
            </option>
          ))}
        </select>
      </div>

      <div className="export-preset-grid">
        <PresetFact label="命名规则" value={activePreset?.naming_rule ?? "-"} />
        <PresetFact label="ComicInfo 写入规则" value={activePreset?.comicinfo_rule ?? "-"} />
        <PresetFact label="meta.json 保留规则" value={activePreset?.meta_rule ?? "-"} />
        <PresetFact label="压缩方式" value={activePreset?.compression ?? "-"} />
      </div>

      <div className="export-preset-bottom">
        <p className="export-preset-hint">多选时会打包为一个 .zip 下载到你的设备，原始 CBZ 不受影响。</p>
        <div className="export-preset-buttons">
          <button type="button" className="export-secondary-action" onClick={onSavePreset} disabled={!activePreset}>
            保存为新预设
          </button>
          <button
            type="button"
            className="export-generate"
            disabled={downloading || exportableCount === 0 || selectedCount === 0}
            onClick={onDownload}
          >
            <Download size={17} />
            {downloading ? "正在下载..." : downloadLabel}
          </button>
        </div>
      </div>
    </section>
  );
}

function PresetFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="export-preset-fact">
      <span>{label}</span>
      <strong title={value}>{value}</strong>
    </div>
  );
}
