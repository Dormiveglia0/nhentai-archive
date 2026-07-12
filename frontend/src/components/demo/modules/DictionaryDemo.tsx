import { BookOpen, Save, Upload, X } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useEffect, useRef, useState } from "react";

import {
  FolioField as DemoField,
  FolioPanelHeading as PanelHeading,
  FolioSearchField as SearchField,
  FolioSelect as DemoSelect,
} from "../../folio/ui/FolioPrimitives";

export function DictionaryDemo({ announce }: { announce: (message: string) => void }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"all" | "tag" | "artist">("all");
  const [status, setStatus] = useState<"pending" | "reviewed" | "ignored">("pending");
  const [bulkOpen, setBulkOpen] = useState(false);
  const bulkTriggerRef = useRef<HTMLButtonElement>(null);

  function closeBulk() {
    setBulkOpen(false);
    window.requestAnimationFrame(() => bulkTriggerRef.current?.focus());
  }

  useEffect(() => {
    if (!bulkOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeBulk();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [bulkOpen]);

  return (
    <div className="folio-page-body">
      <div className="folio-dictionary-layout">
        <section className="folio-candidate-panel">
          <div className="folio-panel-toolbar">
            <PanelHeading title="候选术语池" description="只展示真实远端标签与已保存词条。" />
            <button ref={bulkTriggerRef} className="folio-line-button" type="button" onClick={() => setBulkOpen(true)}><Upload size={15} />批量导入</button>
          </div>
          <SearchField value={query} onChange={setQuery} placeholder="搜索原文或中文词条" />
          <div className="folio-inline-filters">
            <DemoSelect label="类型" value={type} onChange={setType} options={[
              { value: "all", label: "全部类型" },
              { value: "tag", label: "标签" },
              { value: "artist", label: "作者" },
            ]} />
            <DemoSelect label="状态" value={status} onChange={setStatus} options={[
              { value: "pending", label: "待处理" },
              { value: "reviewed", label: "已复核" },
              { value: "ignored", label: "已忽略" },
            ]} />
          </div>
          <div className="folio-empty-table">
            <div><span>原文</span><span>类型</span><span>状态</span></div>
            <p>没有真实候选术语</p>
          </div>
        </section>

        <section className="folio-editor-stage">
          <PanelHeading title="术语编辑器" description="新建或选择候选后再保存。" />
          <div className="folio-field-matrix">
            <DemoField label="原文" placeholder="输入远端原始术语" />
            <DemoField label="中文显示" placeholder="输入规范中文译名" />
            <DemoField label="别名" placeholder="输入别名后回车" />
            <DemoField label="备注" placeholder="标题、系列名或使用说明" />
          </div>
          <div className="folio-editor-actions">
            <button className="folio-line-button" type="button" onClick={() => announce("当前没有可预览的真实作品。")}>应用预览</button>
            <button className="folio-ink-button" type="button" onClick={() => announce("演示页不会写入本地词典。")}><Save size={15} />保存词条</button>
          </div>
        </section>
      </div>

      <section className="folio-evidence-strip">
        <div><BookOpen size={18} /><strong>应用预览</strong></div>
        <span>标签更新对比</span>
        <span>常见搭配</span>
        <span>冲突项</span>
        <span>关联作品</span>
      </section>

      <AnimatePresence>
        {bulkOpen ? (
          <m.div className="folio-modal-backdrop" role="presentation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={closeBulk}>
            <m.section
              className="folio-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="folio-bulk-title"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              onMouseDown={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                if (event.key !== "Tab") return;
                const controls = [...event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), textarea, input:not(:disabled), [tabindex]:not([tabindex='-1'])")];
                const first = controls[0];
                const last = controls[controls.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                  event.preventDefault();
                  last?.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                  event.preventDefault();
                  first?.focus();
                }
              }}
            >
              <button autoFocus className="folio-modal-close" type="button" aria-label="关闭批量导入" onClick={closeBulk}><X size={18} /></button>
              <span>Dictionary</span>
              <h2 id="folio-bulk-title">批量导入</h2>
              <p>每行输入一条术语映射；演示页只验证界面，不写入数据库。</p>
              <textarea rows={7} placeholder="每行输入：原文, 中文显示" />
              <div>
                <button className="folio-line-button" type="button" onClick={closeBulk}>取消</button>
                <button className="folio-ink-button" type="button" onClick={() => announce("演示页未执行批量导入。")}>检查格式</button>
              </div>
            </m.section>
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

