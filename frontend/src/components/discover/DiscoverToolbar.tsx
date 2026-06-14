import { FolderSearch, Grid2X2, Image, List, Search, Shuffle, Sparkles } from "lucide-react";
import { FormEvent, ReactNode } from "react";

import { DiscoverSurface, DiscoverViewMode, TagFilter } from "./discoverTypes";
import { FilterMenu } from "./FilterMenu";
import { TagFilterSelector } from "./TagFilterSelector";

type Props = {
  surface: DiscoverSurface;
  query: string;
  language: string;
  kind: string;
  sort: string;
  unimportedOnly: boolean;
  viewMode: DiscoverViewMode;
  selectedTags: TagFilter[];
  onSurface: (surface: DiscoverSurface) => void;
  onQuery: (value: string) => void;
  onLanguage: (value: string) => void;
  onKind: (value: string) => void;
  onSort: (value: string) => void;
  onUnimportedOnly: (value: boolean) => void;
  onViewMode: (value: DiscoverViewMode) => void;
  onTags: (tags: TagFilter[]) => void;
  onSubmit: () => void;
  onRandom: () => void;
};

const LANGUAGE_OPTIONS = [
  { value: "all", label: "全部" },
  { value: "japanese", label: "日语" },
  { value: "english", label: "英语" },
  { value: "chinese", label: "中文" },
];

const KIND_OPTIONS = [
  { value: "all", label: "全部" },
  { value: "doujinshi", label: "同人志" },
  { value: "manga", label: "漫画" },
];

const SORT_OPTIONS = [
  { value: "date", label: "最新发布" },
  { value: "popular", label: "总热度" },
  { value: "popular-today", label: "今日热门" },
  { value: "popular-week", label: "本周热门" },
  { value: "popular-month", label: "本月热门" },
];

export function DiscoverToolbar({
  surface,
  query,
  language,
  kind,
  sort,
  unimportedOnly,
  viewMode,
  selectedTags,
  onSurface,
  onQuery,
  onLanguage,
  onKind,
  onSort,
  onUnimportedOnly,
  onViewMode,
  onTags,
  onSubmit,
  onRandom,
}: Props) {
  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit();
  }

  const isBoundary = surface === "upload" || surface === "scan";

  return (
    <div className="discover-toolbar">
      <div className="mode-tabs">
        <Tab active={surface === "feed"} onClick={() => onSurface("feed")} icon={<Sparkles size={16} />} label="发现" />
        <Tab active={surface === "upload"} onClick={() => onSurface("upload")} icon={<FolderSearch size={16} />} label="上传 CBZ" />
        <Tab active={surface === "scan"} onClick={() => onSurface("scan")} icon={<FolderSearch size={16} />} label="扫描目录" />
        <button className="random-action" type="button" onClick={onRandom}>
          <Shuffle size={16} />
          随机
        </button>
      </div>

      <form className="discover-filters unified" onSubmit={submit}>
        <label>
          <span>图片关键词 / Gallery ID</span>
          <input
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="搜索标题、社团、角色、标签；输入纯数字打开画廊"
            disabled={isBoundary}
          />
        </label>
        <label>
          <span>标签</span>
          <TagFilterSelector selected={selectedTags} onSelect={onTags} />
        </label>
        <label>
          <span>语言</span>
          <FilterMenu value={language} options={LANGUAGE_OPTIONS} disabled={isBoundary} onChange={onLanguage} />
        </label>
        <label>
          <span>类型</span>
          <FilterMenu value={kind} options={KIND_OPTIONS} disabled={isBoundary} onChange={onKind} />
        </label>
        <label>
          <span>排序</span>
          <FilterMenu value={sort} options={SORT_OPTIONS} disabled={isBoundary} onChange={onSort} />
        </label>
        <label className="switch-field">
          <span>仅未入库</span>
          <input type="checkbox" checked={unimportedOnly} onChange={(event) => onUnimportedOnly(event.target.checked)} />
          <i />
        </label>
        <div className="view-actions">
          <button type="button" className={viewMode === "grid" ? "active" : ""} onClick={() => onViewMode("grid")} aria-label="网格">
            <Grid2X2 size={16} />
          </button>
          <button type="button" className={viewMode === "list" ? "active" : ""} onClick={() => onViewMode("list")} aria-label="列表">
            <List size={16} />
          </button>
          <button type="submit" disabled={isBoundary}>
            <Image size={16} />
            查询
          </button>
        </div>
      </form>
    </div>
  );
}

function Tab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button className={active ? "active" : ""} type="button" onClick={onClick}>
      {icon}
      {label}
    </button>
  );
}
