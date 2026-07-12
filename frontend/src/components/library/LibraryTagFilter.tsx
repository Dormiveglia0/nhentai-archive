import { Check, ChevronDown, Search, Tags } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";

import { api, type LibraryTagFilter as LibraryTagFilterItem } from "../../lib/api";
import { duration, ease } from "../../lib/motion";

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
  const rootRef = useRef<HTMLDivElement>(null);
  const latest = useRef("");
  const panelId = useId();

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const normalizedQuery = query.trim();
    latest.current = normalizedQuery;
    setLoading(true);
    setError(null);

    const handle = window.setTimeout(async () => {
      try {
        const payload = await api.libraryTagFilters(normalizedQuery, 40);
        if (!cancelled && latest.current === normalizedQuery) setOptions(payload.result);
      } catch (exception) {
        if (!cancelled && latest.current === normalizedQuery) {
          setError(exception instanceof Error ? exception.message : String(exception));
        }
      } finally {
        if (!cancelled && latest.current === normalizedQuery) setLoading(false);
      }
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [open, query]);

  function toggle(tag: LibraryTagFilterItem) {
    if (selected.some((item) => item.id === tag.id)) {
      onChange(selected.filter((item) => item.id !== tag.id));
    } else {
      onChange([...selected, tag]);
    }
  }

  return (
    <div ref={rootRef} className={open ? "folio-library-tag-filter is-open" : "folio-library-tag-filter"}>
      <span>标签</span>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <Tags size={16} />
        <strong>{selected.length ? `${selected.length} 个标签` : "选择本地标签"}</strong>
        <ChevronDown size={15} />
      </button>

      <AnimatePresence>
        {open ? (
          <m.div
            id={panelId}
            className="folio-library-tag-panel"
            role="dialog"
            aria-label="筛选本地标签"
            initial={{ opacity: 0, y: -7, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.99 }}
            transition={{ duration: duration.fast, ease: ease.standard }}
          >
            <label>
              <Search size={15} />
              <input
                autoFocus
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="标签、作者、社团或中文译名"
                aria-label="搜索本地标签"
              />
              {loading ? <span role="status">检索中</span> : null}
            </label>

            <div className="folio-library-tag-options">
              {error ? <p role="alert">{error}</p> : null}
              {!error && options.map((tag) => {
                const active = selected.some((item) => item.id === tag.id);
                return (
                  <button key={tag.id} type="button" className={active ? "is-active" : ""} aria-pressed={active} onClick={() => toggle(tag)}>
                    <span><strong>{tag.display}</strong><small>{tag.type || "tag"}</small></span>
                    <em>{tag.count}</em>
                    {active ? <Check size={15} /> : <i />}
                  </button>
                );
              })}
              {!error && !loading && options.length === 0 ? <p>没有匹配的本地标签</p> : null}
            </div>
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
