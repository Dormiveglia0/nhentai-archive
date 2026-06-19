import { Download } from "lucide-react";
import { useState } from "react";

import type { ExportPreset, SettingsSummary } from "../../lib/api";
import { compactPath } from "./exportHelpers";

type ExportPresetBarProps = {
  settings: SettingsSummary | null;
  activePreset: ExportPreset | null;
  outputDir?: string;
  outputDirDraft: string;
  savingOutputDir: boolean;
  openDirAfter: boolean;
  selectedCount: number;
  exportableCount: number;
  generating: boolean;
  onPresetChange: (presetId: string) => void;
  onSavePreset: () => void;
  onOutputDirChange: (value: string) => void;
  onSaveOutputDir: () => void;
  onToggleOpenDir: (value: boolean) => void;
  onGenerate: () => void;
};

export function ExportPresetBar({
  settings,
  activePreset,
  outputDir,
  outputDirDraft,
  savingOutputDir,
  openDirAfter,
  selectedCount,
  exportableCount,
  generating,
  onPresetChange,
  onSavePreset,
  onOutputDirChange,
  onSaveOutputDir,
  onToggleOpenDir,
  onGenerate,
}: ExportPresetBarProps) {
  const [editingDir, setEditingDir] = useState(false);
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
        <div className={`export-dir-editor ${editingDir ? "editing" : ""}`}>
          <span>输出目录</span>
          {editingDir ? (
            <label>
              <input
                value={outputDirDraft}
                onChange={(event) => onOutputDirChange(event.target.value)}
                aria-label="输出目录"
              />
              <button
                type="button"
                onClick={() => {
                  onSaveOutputDir();
                  setEditingDir(false);
                }}
                disabled={savingOutputDir || !outputDirDraft.trim() || outputDirDraft === outputDir}
              >
                {savingOutputDir ? "保存中" : "保存"}
              </button>
            </label>
          ) : (
            <label>
              <strong title={outputDir}>{compactPath(outputDir ?? "-")}</strong>
              <button type="button" onClick={() => setEditingDir(true)}>
                更改
              </button>
            </label>
          )}
        </div>
      </div>

      <div className="export-preset-bottom">
        <label className="export-openafter">
          <input
            type="checkbox"
            checked={openDirAfter}
            onChange={(event) => onToggleOpenDir(event.target.checked)}
          />
          导出完成后打开输出目录
        </label>
        <div className="export-preset-buttons">
          <button type="button" className="export-secondary-action" onClick={onSavePreset} disabled={!activePreset}>
            保存为新预设
          </button>
          <button
            type="button"
            className="export-generate"
            disabled={generating || exportableCount === 0 || selectedCount === 0}
            onClick={onGenerate}
          >
            <Download size={17} />
            {generating ? "正在导出..." : "开始导出"}
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
