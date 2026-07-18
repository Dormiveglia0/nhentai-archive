import { ArrowUpRight, FileArchive } from "lucide-react";

import { pageHref } from "../../lib/navigation";
import { FolioToggleRow } from "../folio/ui/FolioPrimitives";
import type { SettingsVM } from "./useSettingsState";

type ToggleKey = "write_comicinfo" | "keep_json" | "compress";

export function ExportDefaultsSection({ vm }: { vm: SettingsVM }) {
  const opts = vm.exportDefaults;
  const set = (key: ToggleKey, value: boolean) => vm.setExportDefaults({ ...opts, [key]: value });

  return (
    <section className="folio-settings-section folio-settings-export" aria-label="CBZ 默认配方">
      <div className="folio-settings-recipe-head">
        <div>
          <span>Default recipe</span>
          <strong>作品名.cbz</strong>
        </div>
        <a className="folio-line-button" href={pageHref({ name: "export" })}>
          打开导出中心
          <ArrowUpRight size={15} />
        </a>
      </div>

      <div className="folio-toggle-list folio-settings-toggle-list">
        <FolioToggleRow
          label="写入 ComicInfo.xml"
          copy="导出时生成标准漫画元数据，便于阅读器识别。"
          checked={opts.write_comicinfo}
          onChange={(value) => set("write_comicinfo", value)}
        />
        <FolioToggleRow
          label="保留原始 JSON"
          copy="源归档包含 JSON 时随包保留，不改写原始内容。"
          checked={opts.keep_json}
          onChange={(value) => set("keep_json", value)}
        />
        <FolioToggleRow
          label="启用 ZIP 压缩"
          copy={opts.compress ? "优先减少下载体积。" : "仅封装，优先生成速度。"}
          checked={opts.compress}
          onChange={(value) => set("compress", value)}
        />
      </div>

      <div className="folio-settings-manifest" aria-label="导出内容预览">
        <div className="folio-settings-manifest-title">
          <FileArchive size={18} />
          <span><strong>包结构</strong><small>最终内容以所选真实作品为准</small></span>
        </div>
        <ul>
          <li><code>页面图像（保留原名）</code><em>始终包含</em></li>
          <li className={opts.write_comicinfo ? "" : "is-off"}><code>ComicInfo.xml</code><em>{opts.write_comicinfo ? "写入" : "跳过"}</em></li>
          <li className={opts.keep_json ? "" : "is-off"}><code>原始 JSON（如有）</code><em>{opts.keep_json ? "保留" : "剔除"}</em></li>
        </ul>
        <p>打包方式 <strong>{opts.compress ? "ZIP 压缩" : "Store 仅封装"}</strong></p>
      </div>
    </section>
  );
}
