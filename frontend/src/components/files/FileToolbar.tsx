import { ListChecks, SearchCheck, X } from "lucide-react";
import { AnimatePresence, m } from "motion/react";

import { duration, ease } from "../../lib/motion";
import { FolioSearchField, FolioSelect } from "../folio/ui/FolioPrimitives";

const CATEGORIES = [
  { value: "all", label: "全部" },
  { value: "work", label: "作品" },
  { value: "orphan", label: "孤立" },
  { value: "stale", label: "临时" },
] as const;

const STATUSES = [
  { value: "", label: "全部状态" },
  { value: "ok", label: "正常" },
  { value: "missing_source", label: "缺失源" },
  { value: "missing_cover", label: "缺失封面" },
  { value: "size_mismatch", label: "体积不符" },
  { value: "orphan", label: "孤立" },
  { value: "stale", label: "临时" },
] as const;

const SORTS = [
  { value: "default", label: "默认排序" },
  { value: "size_desc", label: "体积从大到小" },
  { value: "size_asc", label: "体积从小到大" },
] as const;

type Props = {
  category: string;
  onCategory: (category: string) => void;
  query: string;
  onQuery: (query: string) => void;
  statusFilter: string;
  onStatus: (status: string) => void;
  sort: string;
  onSort: (sort: string) => void;
  total: number;
  multiSelect: boolean;
  onToggleMultiSelect: () => void;
  selectedCount: number;
  onPreviewSelected: () => void;
  onClearSelection: () => void;
};

export function FileToolbar({
  category,
  onCategory,
  query,
  onQuery,
  statusFilter,
  onStatus,
  sort,
  onSort,
  total,
  multiSelect,
  onToggleMultiSelect,
  selectedCount,
  onPreviewSelected,
  onClearSelection,
}: Props) {
  return (
    <section className="folio-files-toolbar" aria-label="文件筛选与批量操作">
      <div className="folio-files-tabs" role="tablist" aria-label="文件类型">
        {CATEGORIES.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={category === item.value}
            className={category === item.value ? "is-active" : ""}
            onClick={() => onCategory(item.value)}
          >
            {category === item.value ? <m.span layoutId="folio-files-category" className="folio-files-tab-active" /> : null}
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      <div className="folio-files-controls">
        <div className="folio-files-control folio-files-search-control">
          <span>快速定位</span>
          <FolioSearchField value={query} onChange={onQuery} placeholder="搜索标题或受管路径" />
        </div>
        <FolioSelect label="文件状态" value={statusFilter} options={STATUSES} onChange={onStatus} />
        <FolioSelect label="排序方式" value={sort} options={SORTS} onChange={onSort} />
        <div className="folio-files-control">
          <span>选择方式</span>
          <button
            type="button"
            className={"folio-files-multi" + (multiSelect ? " is-active" : "")}
            aria-pressed={multiSelect}
            onClick={onToggleMultiSelect}
          >
            <ListChecks size={15} />
            {multiSelect ? "退出多选" : "批量选择"}
          </button>
        </div>
      </div>

      <div className={"folio-files-batch" + (multiSelect ? " is-active" : "")}>
        <p>
          <strong>{multiSelect ? selectedCount : total}</strong>
          <span>{multiSelect ? "项已选择" : "项匹配当前条件"}</span>
        </p>
        <AnimatePresence mode="wait" initial={false}>
          {multiSelect ? (
            <m.div
              key="actions"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: duration.fast, ease: ease.standard }}
            >
              <button type="button" onClick={onPreviewSelected} disabled={selectedCount === 0}>
                <SearchCheck size={15} />预览删除影响
              </button>
              <button type="button" onClick={onClearSelection} disabled={selectedCount === 0}>
                <X size={15} />清空选择
              </button>
            </m.div>
          ) : (
            <m.span
              key="hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: duration.fast }}
            >
              先预览，再执行任何清理操作
            </m.span>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
