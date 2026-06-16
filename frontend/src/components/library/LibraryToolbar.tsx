import { LayoutGrid, RotateCcw, Rows3, Search } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import { LibrarySummary, LibraryTagFilter as LibraryTagFilterItem } from "../../lib/api";
import { FilterMenu } from "../discover/FilterMenu";
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
    <div className="library-toolbar">
      <form className="library-search" onSubmit={submit}>
        <Search size={16} />
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="搜索标题、作者、标签或画廊 ID"
        />
      </form>

      <div className="library-filters">
        <FilterMenu value={props.language} options={languageOptions} onChange={props.onLanguage} />
        <FilterMenu value={props.readStatus} options={READ_STATUS_OPTIONS} onChange={props.onReadStatus} />
        <FilterMenu value={props.source} options={SOURCE_OPTIONS} onChange={props.onSource} />
        <LibraryTagFilter selected={props.tags} onChange={props.onTags} />
        <FilterMenu value={props.sort} options={SORT_OPTIONS} onChange={props.onSort} />
        {props.canReset ? (
          <button type="button" className="library-reset" onClick={props.onReset}>
            <RotateCcw size={15} />
            重置
          </button>
        ) : null}
      </div>

      <div className="library-view-toggle">
        <button
          type="button"
          className={props.view === "grid" ? "active" : ""}
          onClick={() => props.onView("grid")}
          aria-label="封面墙视图"
        >
          <LayoutGrid size={16} />
        </button>
        <button
          type="button"
          className={props.view === "list" ? "active" : ""}
          onClick={() => props.onView("list")}
          aria-label="列表视图"
        >
          <Rows3 size={16} />
        </button>
      </div>
    </div>
  );
}
