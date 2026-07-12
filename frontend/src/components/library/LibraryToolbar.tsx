import { Grid2X2, List, RotateCcw, Search, X } from "lucide-react";
import { m } from "motion/react";
import { type FormEvent, useEffect, useState } from "react";

import type { LibrarySummary, LibraryTagFilter as LibraryTagFilterItem } from "../../lib/api";
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
  view: LibraryView;
  onView: (view: LibraryView) => void;
  summary: LibrarySummary | null;
  canReset: boolean;
  onReset: () => void;
};

export function LibraryToolbar(props: Props) {
  const [draft, setDraft] = useState(props.q);

  useEffect(() => {
    setDraft(props.q);
  }, [props.q]);

  function submit(event: FormEvent) {
    event.preventDefault();
    props.onQ(draft.trim());
  }

  const languageOptions = [
    { value: "all", label: "全部语言" },
    ...(props.summary?.languages ?? []).map((item) => ({
      value: item.value,
      label: `${item.label} · ${item.count}`,
    })),
  ];

  return (
    <section className="folio-library-toolbar" aria-label="馆藏搜索与筛选">
      <form className="folio-library-search" onSubmit={submit}>
        <label>
          <Search size={17} />
          <input
            type="search"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="搜索标题、作者、标签或画廊 ID"
            aria-label="搜索馆藏"
          />
          <i />
        </label>
        <button type="submit"><Search size={15} />检索</button>
      </form>

      <LibraryTagFilter selected={props.tags} onChange={props.onTags} />

      <div className="folio-view-switch folio-library-view-switch" aria-label="馆藏视图方式">
        <button
          className={props.view === "grid" ? "is-active" : ""}
          type="button"
          aria-label="封面墙视图"
          aria-pressed={props.view === "grid"}
          onClick={() => props.onView("grid")}
        >
          {props.view === "grid" ? <m.span className="folio-control-active" layoutId="folio-library-view" /> : null}
          <Grid2X2 size={16} />
        </button>
        <button
          className={props.view === "list" ? "is-active" : ""}
          type="button"
          aria-label="列表视图"
          aria-pressed={props.view === "list"}
          onClick={() => props.onView("list")}
        >
          {props.view === "list" ? <m.span className="folio-control-active" layoutId="folio-library-view" /> : null}
          <List size={17} />
        </button>
      </div>

      <div className="folio-library-filter-row">
        <FolioSelect label="语言" value={props.language} options={languageOptions} onChange={props.onLanguage} />
        <FolioSelect label="阅读状态" value={props.readStatus} options={READ_STATUS_OPTIONS} onChange={props.onReadStatus} />
        <FolioSelect label="来源" value={props.source} options={SOURCE_OPTIONS} onChange={props.onSource} />
        <FolioSelect label="排序" value={props.sort} options={SORT_OPTIONS} onChange={props.onSort} />
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

      {props.tags.length ? (
        <div className="folio-library-active-tags" aria-label="已选标签">
          <span>已选标签</span>
          {props.tags.map((tag) => (
            <button key={tag.id} type="button" onClick={() => props.onTags(props.tags.filter((item) => item.id !== tag.id))}>
              {tag.display}<X size={12} />
            </button>
          ))}
          <button type="button" className="is-clear" onClick={() => props.onTags([])}>全部清除</button>
        </div>
      ) : null}
    </section>
  );
}
