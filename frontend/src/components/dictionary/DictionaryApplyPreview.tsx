import { ChevronDown, ChevronUp, X } from "lucide-react";
import { useState } from "react";

import { DictionaryApplyPayload, DictionaryPreview } from "../../lib/api";

type Props = {
  preview: DictionaryPreview | null;
  form: DictionaryApplyPayload;
  onClose: () => void;
};

export function DictionaryApplyPreview({ preview, form, onClose }: Props) {
  const [open, setOpen] = useState(true);
  if (!preview) return null;
  return (
    <aside className={open ? "dictionary-preview-tray open" : "dictionary-preview-tray"}>
      <header>
        <div>
          <h2>应用预览</h2>
          <span>预览基于当前编辑内容，实际结果以写入时为准。</span>
        </div>
        <button type="button" onClick={() => setOpen((value) => !value)} aria-label={open ? "收起预览" : "展开预览"}>
          {open ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
        <button type="button" onClick={onClose} aria-label="关闭预览">
          <X size={16} />
        </button>
      </header>
      <div className="preview-metrics">
        <Metric label="将更新标签" value={preview.will_update_tags} />
        <Metric label="将影响作品" value={preview.will_update_works} />
        <Metric label="潜在冲突" value={preview.conflicts.length} danger={preview.conflicts.length > 0} />
        <Metric label="忽略项" value={preview.ignored} />
      </div>
      {open ? (
        <div className="preview-detail-grid">
          <section>
            <h3>受影响作品</h3>
            {preview.samples.length ? (
              preview.samples.map((work) => (
                <p key={work.id}>
                  <strong>{work.title_japanese || work.title}</strong>
                  <span>{work.page_count}P</span>
                </p>
              ))
            ) : (
              <em>暂无真实作品受影响。</em>
            )}
          </section>
          <section>
            <h3>标签更新对比</h3>
            <div className="tag-diff">
              <span>{form.original_text || "原文"}</span>
              <b>→</b>
              <strong>{form.zh_name || "中文名"}</strong>
            </div>
            {(form.aliases ?? []).map((alias) => (
              <small key={alias}>别名：{alias}</small>
            ))}
          </section>
          <section>
            <h3>冲突项</h3>
            {preview.conflicts.length ? (
              preview.conflicts.map((conflict, index) => (
                <p key={`${conflict.type}-${index}`} className="conflict-row">
                  {conflict.message}
                </p>
              ))
            ) : (
              <em>未发现冲突。</em>
            )}
          </section>
        </div>
      ) : null}
    </aside>
  );
}

function Metric({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div>
      <span>{label}</span>
      <strong className={danger ? "danger" : ""}>{value}</strong>
    </div>
  );
}
