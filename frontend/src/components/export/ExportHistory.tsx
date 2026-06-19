import { ChevronRight } from "lucide-react";

import type { ExportRecord } from "../../lib/api";
import { formatBytes } from "../library/libraryHelpers";
import { Cover } from "./exportHelpers";

export function ExportHistory({ records, blurCovers }: { records: ExportRecord[]; blurCovers: boolean }) {
  return (
    <section className="export-panel export-history-panel">
      <div className="export-panel-head">
        <div>
          <h2>最近导出记录</h2>
          <p>真实生成过的新 CBZ 文件，缺失文件会保留记录并标记。</p>
        </div>
        <button type="button" className="export-link-action">
          查看全部记录 <ChevronRight size={15} />
        </button>
      </div>
      {records.length === 0 ? (
        <p className="empty-inline">尚无导出记录。</p>
      ) : (
        <div className="export-history-grid">
          {records.slice(0, 4).map((record) => (
            <article key={record.id} className="export-history-card">
              <Cover workId={record.work_id} coverPath={record.work.cover_path} blurCovers={blurCovers} />
              <div>
                <strong>{record.output_name}</strong>
                <small>
                  {formatBytes(record.size_bytes)} · {record.created_at}
                </small>
                <span className={record.exists ? "export-state ready" : "export-state blocked"}>
                  {record.exists ? "导出完成" : "部分失败"}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
