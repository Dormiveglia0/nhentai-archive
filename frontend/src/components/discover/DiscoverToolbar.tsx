import { Search, Shuffle, SlidersHorizontal } from "lucide-react";
import type { FormEvent } from "react";

import { FolioSelect } from "../folio/ui/FolioPrimitives";
import type { TagFilter } from "./discoverTypes";
import { TagFilterSelector } from "./TagFilterSelector";

type Props = {
  query: string;
  language: string;
  kind: string;
  sort: string;
  unimportedOnly: boolean;
  selectedTags: TagFilter[];
  onQuery: (value: string) => void;
  onLanguage: (value: string) => void;
  onKind: (value: string) => void;
  onSort: (value: string) => void;
  onUnimportedOnly: (value: boolean) => void;
  onTags: (tags: TagFilter[]) => void;
  onSubmit: () => void;
  onRandom: () => void;
};

const LANGUAGE_OPTIONS = [
  { value: "all", label: "全部语言" },
  { value: "japanese", label: "日语" },
  { value: "english", label: "英语" },
  { value: "chinese", label: "中文" },
];

const KIND_OPTIONS = [
  { value: "all", label: "全部类型" },
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

export function DiscoverToolbar(props: Props) {
  function submit(event: FormEvent) {
    event.preventDefault();
    props.onSubmit();
  }

  return (
    <section className="folio-discover-toolbar" aria-label="远端检索条件">
      <form onSubmit={submit}>
        <div className="folio-discover-query">
          <label className="folio-discover-keyword">
            <Search size={17} />
            <input
              type="search"
              value={props.query}
              onChange={(event) => props.onQuery(event.target.value)}
              placeholder="关键字、标题、社团、角色或 Gallery ID"
              aria-label="检索关键字或 Gallery ID"
            />
          </label>
          <TagFilterSelector selected={props.selectedTags} onSelect={props.onTags} />
        </div>

        <div className="folio-discover-query-actions">
          <button className="folio-discover-random" type="button" onClick={props.onRandom} aria-label="随机作品" title="随机作品">
            <Shuffle size={17} />
          </button>
          <button className="folio-ink-button folio-discover-submit" type="submit">
            <Search size={16} />检索
          </button>
        </div>

        <div className="folio-discover-filter-row">
          <FolioSelect label="语言" value={props.language} options={LANGUAGE_OPTIONS} onChange={props.onLanguage} />
          <FolioSelect label="类型" value={props.kind} options={KIND_OPTIONS} onChange={props.onKind} />
          <FolioSelect label="排序" value={props.sort} options={SORT_OPTIONS} onChange={props.onSort} />
          <button
            className={props.unimportedOnly ? "folio-filter-toggle is-active" : "folio-filter-toggle"}
            type="button"
            aria-pressed={props.unimportedOnly}
            onClick={() => props.onUnimportedOnly(!props.unimportedOnly)}
          >
            <SlidersHorizontal size={16} />仅未入库
          </button>
        </div>
      </form>
    </section>
  );
}
