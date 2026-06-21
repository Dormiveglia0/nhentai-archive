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
        <p>导出中心打开时的默认配方；这里决定 CBZ 起始结构，单次任务仍可临时调整。</p>
      </div>

      <div className="export-recipe" aria-label="导出默认配方">
        <div className="export-recipe-head">
          <div>
            <span>CBZ Preset</span>
            <strong>作品名.cbz</strong>
          </div>
          <button type="button" className="export-defaults-link" onClick={() => navigate({ name: "export" })}>
            打开导出中心
          </button>
        </div>

        <label className="export-recipe-row">
          <span>
            <strong>阅读器元数据</strong>
            <small>写入 ComicInfo.xml，便于阅读器识别标题、作者、标签。</small>
          </span>
          <code className={opts.write_comicinfo ? "" : "is-off"}>{opts.write_comicinfo ? "ComicInfo.xml" : "跳过 ComicInfo"}</code>
          <span className="switch-field">
            <input type="checkbox" checked={opts.write_comicinfo} onChange={(e) => set("write_comicinfo", e.target.checked)} />
            <i />
          </span>
        </label>

        <label className="export-recipe-row">
          <span>
            <strong>原始数据留档</strong>
            <small>随包保存抓取 JSON，后续迁移或复核时更稳。</small>
          </span>
          <code className={opts.keep_json ? "" : "is-off"}>{opts.keep_json ? "metadata.json" : "不保留 JSON"}</code>
          <span className="switch-field">
            <input type="checkbox" checked={opts.keep_json} onChange={(e) => set("keep_json", e.target.checked)} />
            <i />
          </span>
        </label>

        <label className="export-recipe-row">
          <span>
            <strong>打包方式</strong>
            <small>{opts.compress ? "ZIP 压缩，优先减少体积。" : "仅存储，优先导出速度。"}</small>
          </span>
          <code>{opts.compress ? "ZIP 压缩" : "Store 仅封装"}</code>
          <span className="switch-field">
            <input type="checkbox" checked={opts.compress} onChange={(e) => set("compress", e.target.checked)} />
            <i />
          </span>
        </label>

        <div className="export-manifest" aria-label="导出内容预览">
          <div className="export-manifest-copy">
            <span>
              <strong>包结构</strong>
              <small>实际导出时以作品页数和元数据为准</small>
            </span>
          </div>
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
        </div>
      </div>
    </section>
  );
}
