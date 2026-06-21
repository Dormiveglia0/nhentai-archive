import { navigate } from "../../lib/navigation";
import type { SettingsVM } from "./useSettingsState";

type ToggleKey = "write_comicinfo" | "keep_json" | "compress";

export function ExportDefaultsSection({ vm }: { vm: SettingsVM }) {
  const opts = vm.exportDefaults;
  const set = (key: ToggleKey, value: boolean) => vm.setExportDefaults({ ...opts, [key]: value });

  return (
    <section className="settings-card">
      <div className="settings-title">
        <h2>导出默认</h2>
        <p>导出中心打开时的默认选项；右侧实时预览每个 CBZ 的打包内容。仍可在导出页临时调整。</p>
      </div>

      <div className="export-defaults">
        <div className="export-defaults-controls">
          <label className="export-toggle">
            <span>写入 ComicInfo.xml</span>
            <span className="switch-field">
              <input type="checkbox" checked={opts.write_comicinfo} onChange={(e) => set("write_comicinfo", e.target.checked)} />
              <i />
            </span>
          </label>
          <label className="export-toggle">
            <span>保留原始 JSON</span>
            <span className="switch-field">
              <input type="checkbox" checked={opts.keep_json} onChange={(e) => set("keep_json", e.target.checked)} />
              <i />
            </span>
          </label>
          <label className="export-toggle">
            <span>压缩打包</span>
            <span className="switch-field">
              <input type="checkbox" checked={opts.compress} onChange={(e) => set("compress", e.target.checked)} />
              <i />
            </span>
          </label>
          <button type="button" className="export-defaults-link" onClick={() => navigate({ name: "export" })}>
            打开导出中心 →
          </button>
        </div>

        <aside className="export-preview" aria-label="导出内容预览">
          <span className="export-preview-name">作品名.cbz</span>
          <ul className="export-preview-tree">
            <li>
              <code>001.png · 002.png …</code>
              <em>页面图片</em>
            </li>
            <li className={opts.write_comicinfo ? "" : "is-off"}>
              <code>ComicInfo.xml</code>
              <em>{opts.write_comicinfo ? "元数据" : "不写入"}</em>
            </li>
            <li className={opts.keep_json ? "" : "is-off"}>
              <code>metadata.json</code>
              <em>{opts.keep_json ? "原始 JSON" : "已剔除"}</em>
            </li>
          </ul>
          <div className="export-preview-foot">
            打包方式：<strong>{opts.compress ? "ZIP 压缩" : "仅存储（不压缩）"}</strong>
          </div>
        </aside>
      </div>
    </section>
  );
}
