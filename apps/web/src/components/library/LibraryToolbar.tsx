import { ChevronDown, Heart, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";

import type { LibrarySummary, MediaLibrary, LibraryTagFilter as LibraryTagFilterItem } from "../../lib/api";
import { FolioSelect } from "../folio/ui/FolioPrimitives";
import { LibraryTagFilter } from "./LibraryTagFilter";
import { READ_STATUS_OPTIONS, SORT_OPTIONS, SOURCE_OPTIONS } from "./libraryHelpers";

export type LibraryView = "grid" | "list";

type Props = {
  q: string;
  onQ: (value: string) => void;
  language: string;
  onLanguage: (value: string) => void;
  readStatus: string;
  onReadStatus: (value: string) => void;
  source: string;
  onSource: (value: string) => void;
  sort: string;
  onSort: (value: string) => void;
  tags: LibraryTagFilterItem[];
  onTags: (tags: LibraryTagFilterItem[]) => void;
  favoriteOnly: boolean;
  onFavoriteOnly: (value: boolean) => void;
  summary: LibrarySummary | null;
  canReset: boolean;
  onReset: () => void;
  libraryId: string;
  onLibraryId: (value: string) => void;
  mediaLibraries: MediaLibrary[];
};

export function LibraryToolbar(props: Props) {
  const [draft, setDraft] = useState(props.q);
  const [filtersOpen, setFiltersOpen] = useState(() => !window.matchMedia("(max-width: 700px)").matches);

  useEffect(() => {
    setDraft(props.q);
  }, [props.q]);

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 700px)");
    const change = () => setFiltersOpen(!mobile.matches);
    mobile.addEventListener("change", change);
    return () => mobile.removeEventListener("change", change);
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    props.onQ(draft.trim());
  }

  function changeDraft(value: string) {
    setDraft(value);
    if (!value && props.q) props.onQ("");
  }

  function clearSearch() {
    setDraft("");
    if (props.q) props.onQ("");
  }

  const languageOptions = [
    { value: "all", label: "全部语言" },
    ...(props.summary?.languages ?? []).map((item) => ({
      value: item.value,
      label: `${item.label} · ${item.count}`,
    })),
  ];

  return (
    <section className="folio-library-toolbar" aria-label="作品搜索与筛选">
      <form className="folio-library-query folio-library-search" onSubmit={submit}>
          <div className="folio-library-search-field">
            <Search size={17} />
            <input
              type="search"
              value={draft}
              onChange={(event) => changeDraft(event.target.value)}
              placeholder="搜索标题、作者、标签或画廊 ID"
              aria-label="搜索作品"
            />
            {draft ? <button className="folio-library-search-clear" type="button" onClick={clearSearch} aria-label="清除文字搜索"><X size={15} /></button> : null}
            <i />
          </div>
        <LibraryTagFilter selected={props.tags} onChange={props.onTags} />
        <button type="submit"><Search size={15} />搜索</button>
      </form>

      <details className="folio-library-filters" open={filtersOpen} onToggle={event => setFiltersOpen(event.currentTarget.open)}>
      <summary><SlidersHorizontal size={16} />筛选与排序<ChevronDown size={16} /></summary>
      <div className="folio-library-filter-row">
        <FolioSelect label="媒体库" value={props.libraryId} onChange={props.onLibraryId} options={[
          { value: "all", label: "全部媒体库" },
          ...props.mediaLibraries.map(library => ({ value: String(library.id), label: library.name })),
          ...(props.libraryId !== "all" && props.libraryId !== "-1" && !props.mediaLibraries.some(library => String(library.id) === props.libraryId) ? [{ value: props.libraryId, label: "已移除的媒体库" }] : []),
          { value: "-1", label: "无可用来源" },
        ]} />
        <FolioSelect label="语言" value={props.language} options={languageOptions} onChange={props.onLanguage} />
        <FolioSelect label="阅读状态" value={props.readStatus} options={READ_STATUS_OPTIONS} onChange={props.onReadStatus} />
        <FolioSelect label="来源" value={props.source} options={SOURCE_OPTIONS} onChange={props.onSource} />
        <FolioSelect label="排序" value={props.sort} options={SORT_OPTIONS} onChange={props.onSort} />
        <button
          type="button"
          className={`folio-library-favorite-filter${props.favoriteOnly ? " is-active" : ""}`}
          onClick={() => props.onFavoriteOnly(!props.favoriteOnly)}
          aria-pressed={props.favoriteOnly}
        >
          <Heart size={15} fill={props.favoriteOnly ? "currentColor" : "none"} />
          收藏 {props.summary?.favorites ?? 0}
        </button>
        <button
          type="button"
          className="folio-library-reset"
          onClick={props.onReset}
          disabled={!props.canReset}
        >
          <RotateCcw size={15} />
          重置筛选
        </button>
      </div>
      </details>
    </section>
  );
}
