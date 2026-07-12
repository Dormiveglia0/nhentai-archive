import { ChevronDown, ChevronLeft, ChevronRight, Search, SlidersHorizontal, Tag, X } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { duration, ease } from "../../../lib/motion";
import { DemoSelect, EmptyCanvas, PanelHeading } from "../ui/DemoPrimitives";

export function DiscoverDemo({ announce }: { announce: (message: string) => void }) {
  const [query, setQuery] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [language, setLanguage] = useState<"all" | "zh" | "ja">("all");
  const [kind, setKind] = useState<"all" | "doujinshi" | "manga">("all");
  const [sort, setSort] = useState<"popular" | "recent">("popular");
  const [unimportedOnly, setUnimportedOnly] = useState(true);

  return (
    <div className="folio-demo-page-body">
      <section className="folio-demo-popular-strip">
        <div>
          <span>今日热门</span>
          <h2>连接远端源后显示</h2>
          <p>这里保留真实热门内容的动线与展开位置，不使用示例封面填充。</p>
        </div>
        <div className="folio-demo-popular-lines" aria-hidden="true"><i /><i /><i /><i /></div>
      </section>

      <div className="folio-demo-toolbar folio-demo-toolbar-wide">
        <DiscoveryQueryComposer query={query} onQuery={setQuery} tags={tags} onTags={setTags} />
        <DemoSelect label="语言" value={language} onChange={setLanguage} options={[
          { value: "all", label: "全部语言" },
          { value: "zh", label: "中文" },
          { value: "ja", label: "日文" },
        ]} />
        <DemoSelect label="类型" value={kind} onChange={setKind} options={[
          { value: "all", label: "全部类型" },
          { value: "doujinshi", label: "同人志" },
          { value: "manga", label: "漫画" },
        ]} />
        <DemoSelect label="排序" value={sort} onChange={setSort} options={[
          { value: "popular", label: "热门" },
          { value: "recent", label: "最新" },
        ]} />
        <button className={"folio-demo-filter-toggle folio-demo-discover-action" + (unimportedOnly ? " is-active" : "")} type="button" aria-pressed={unimportedOnly} onClick={() => setUnimportedOnly((value) => !value)}>
          <SlidersHorizontal size={15} />
          仅未导入
        </button>
        <button className="folio-demo-ink-button folio-demo-discover-action" type="button" onClick={() => announce(query || tags.length ? `已组合关键字与 ${tags.length} 个标签；演示环境未发送远端请求。` : "先输入关键字、画廊 ID 或添加标签。")}>
          <Search size={15} />
          搜索
        </button>
      </div>

      <section className="folio-demo-ruled-panel">
        <PanelHeading title="检索结果" description={tags.length ? `当前组合 ${tags.length} 个标签与关键字条件。` : "可组合关键字、多个标签、筛选与排序条件。"} />
        <EmptyCanvas icon={Search} title="等待远端连接" copy="配置连接后，这里会显示真实检索结果、导入状态与分页控件。" />
        <div className="folio-demo-pager" aria-label="分页">
          <button type="button" disabled aria-label="上一页"><ChevronLeft size={16} /></button>
          <span>— / —</span>
          <button type="button" disabled aria-label="下一页"><ChevronRight size={16} /></button>
        </div>
      </section>
    </div>
  );
}

function DiscoveryQueryComposer({
  query,
  onQuery,
  tags,
  onTags,
}: {
  query: string;
  onQuery: (value: string) => void;
  tags: string[];
  onTags: (tags: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const composerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function addTag() {
    const value = draft.trim();
    if (!value || tags.some((tag) => tag.toLocaleLowerCase() === value.toLocaleLowerCase())) return;
    onTags([...tags, value]);
    setDraft("");
  }

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        window.requestAnimationFrame(() => triggerRef.current?.focus());
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !composerRef.current?.contains(event.target)) setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={composerRef} className="folio-demo-query-composer">
      <label className="folio-demo-query-keyword">
        <Search size={16} />
        <input type="search" value={query} onChange={(event) => onQuery(event.target.value)} placeholder="关键字或画廊 ID" aria-label="检索关键字或画廊 ID" />
      </label>
      {tags.length ? (
        <div className="folio-demo-query-tags" aria-label="已选标签">
          {tags.map((tag) => (
            <span key={tag}>
              {tag}
              <button type="button" aria-label={`移除标签 ${tag}`} onClick={() => onTags(tags.filter((item) => item !== tag))}><X size={12} /></button>
            </span>
          ))}
        </div>
      ) : null}
      <button ref={triggerRef} className="folio-demo-query-add" type="button" aria-expanded={open} aria-controls="folio-demo-tag-picker" onClick={() => setOpen((value) => !value)}>
        <Tag size={15} />
        {tags.length ? `${tags.length} 个标签` : "添加标签"}
        <ChevronDown size={14} />
      </button>
      <AnimatePresence>
        {open ? (
          <m.div
            className="folio-demo-tag-picker"
            id="folio-demo-tag-picker"
            role="dialog"
            aria-label="添加检索标签"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.985 }}
            transition={{ duration: duration.fast, ease: ease.standard }}
          >
            <label>
              <Tag size={15} />
              <input
                autoFocus
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                aria-label="添加检索标签"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addTag();
                  }
                }}
                placeholder="输入标签后回车添加"
              />
            </label>
            <button type="button" disabled={!draft.trim()} onClick={addTag}>添加</button>
            <p>可连续添加多个标签；接入真实词典后这里显示匹配候选。</p>
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

