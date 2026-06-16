import { ChevronDown, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { api, LibraryTagFilter as LibraryTagFilterItem } from "../../lib/api";

type Props = {
  selected: LibraryTagFilterItem[];
  onChange: (tags: LibraryTagFilterItem[]) => void;
};

export function LibraryTagFilter({ selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<LibraryTagFilterItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const latest = useRef("");

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    latest.current = q;
    setLoading(true);
    setError(null);
    const handle = window.setTimeout(async () => {
      try {
        const payload = await api.libraryTagFilters(q, 40);
        if (latest.current === q) setOptions(payload.result);
      } catch (exc) {
        if (latest.current === q) setError(exc instanceof Error ? exc.message : String(exc));
      } finally {
        if (latest.current === q) setLoading(false);
      }
    }, 200);
    return () => window.clearTimeout(handle);
  }, [open, query]);

  function toggle(tag: LibraryTagFilterItem) {
    if (selected.some((item) => item.id === tag.id)) {
      onChange(selected.filter((item) => item.id !== tag.id));
    } else {
      onChange([...selected, tag]);
    }
  }

  return (
    <div ref={rootRef} className={open ? "library-tag-filter open" : "library-tag-filter"}>
      <button type="button" className="filter-trigger" onClick={() => setOpen((value) => !value)}>
        <span>{selected.length ? `已选 ${selected.length} 个标签` : "标签筛选"}</span>
        <ChevronDown size={15} />
      </button>
      {selected.length ? (
        <div className="library-tag-chips">
          {selected.map((tag) => (
            <button key={tag.id} type="button" onClick={() => toggle(tag)}>
              {tag.display}
              <X size={12} />
            </button>
          ))}
          <button className="clear-tags" type="button" onClick={() => onChange([])}>
            清除
          </button>
        </div>
      ) : null}
      {open ? (
        <div className="library-tag-picker">
          <div className="library-tag-search">
            <Search size={15} />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索本地标签 / 作者 / 社团"
            />
            {loading ? <span className="tag-filter-state">…</span> : null}
          </div>
          <div className="library-tag-list">
            {error ? <div className="library-tag-empty">{error}</div> : null}
            {!error &&
              options.map((tag) => {
                const active = selected.some((item) => item.id === tag.id);
                return (
                  <button key={tag.id} type="button" className={active ? "active" : ""} onClick={() => toggle(tag)}>
                    <strong>{tag.display}</strong>
                    <span>
                      {tag.type || "tag"} · {tag.count}
                    </span>
                  </button>
                );
              })}
            {!error && !loading && options.length === 0 ? (
              <div className="library-tag-empty">没有匹配的本地标签</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
