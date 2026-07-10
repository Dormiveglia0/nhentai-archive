import { ChevronDown, Search, X } from "lucide-react";
import { KeyboardEvent, useEffect, useRef, useState } from "react";

import { api, RemoteTag } from "../../lib/api";
import { TagFilter } from "./discoverTypes";
import { defaultDisplayTag } from "./TagScroller";

type Props = {
  selected: TagFilter[];
  onSelect: (tags: TagFilter[]) => void;
};

export function TagFilterSelector({ selected, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [cached, setCached] = useState<RemoteTag[]>([]);
  const [suggestions, setSuggestions] = useState<RemoteTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [cachedLoading, setCachedLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestQuery = useRef("");
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  useEffect(() => {
    if (!open || cached.length || cachedLoading) return;
    setCachedLoading(true);
    api
      .dictionaryCandidates({ limit: 80 })
      .then((payload) => setCached(uniqueRemoteTags(payload.result.filter((tag): tag is RemoteTag => typeof tag.id === "number"))))
      .catch((exc) => setError(exc instanceof Error ? exc.message : String(exc)))
      .finally(() => setCachedLoading(false));
  }, [cached.length, cachedLoading, open]);

  useEffect(() => {
    const q = query.trim();
    latestQuery.current = q;
    setError(null);
    if (!open || !canSearchTag(q)) {
      setSuggestions([]);
      return;
    }
    const handle = window.setTimeout(async () => {
      setLoading(true);
      try {
        const payload = await api.dictionaryAutocomplete(q, 12);
        if (latestQuery.current === q) {
          setSuggestions(uniqueRemoteTags(payload.result.filter((tag): tag is RemoteTag => typeof tag.id === "number")));
        }
      } catch (exc) {
        if (latestQuery.current === q) setError(exc instanceof Error ? exc.message : String(exc));
      } finally {
        if (latestQuery.current === q) setLoading(false);
      }
    }, 220);
    return () => window.clearTimeout(handle);
  }, [query, open]);

  function submit() {
    const first = (canSearchTag(query.trim()) ? suggestions : cached)[0];
    if (first) {
      choose(first);
    }
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    submit();
  }

  function remove(tag: RemoteTag) {
    onSelect(selected.filter((item) => item.id !== tag.id));
  }

  function clear() {
    onSelect([]);
  }

  function choose(tag: RemoteTag) {
    if (typeof tag.id !== "number") {
      setError("该词条尚未映射远端 tag，不能用于远端筛选。");
      return;
    }
    const exists = selected.some((item) => item.id === tag.id);
    if (!exists) onSelect([...selected, tag]);
    setQuery("");
    setSuggestions([]);
    setOpen(false);
  }

  function toggle(tag: RemoteTag) {
    if (selected.some((item) => item.id === tag.id)) {
      remove(tag);
    } else {
      onSelect([...selected, tag]);
    }
    setQuery("");
    setSuggestions([]);
  }

  const q = query.trim();
  const visible = canSearchTag(q) ? suggestions : cached;
  const selectedSummary = selected.length
    ? `${defaultDisplayTag(selected[0])}${selected.length > 1 ? ` +${selected.length - 1}` : ""}`
    : "选择或搜索远端 tag";

  return (
    <div ref={rootRef} className={open ? "tag-filter-shell open" : "tag-filter-shell"}>
      <button className="tag-filter tag-filter-trigger" type="button" onClick={() => setOpen((value) => !value)}>
        <Search size={15} />
        <span>{selectedSummary}</span>
        <ChevronDown size={15} />
      </button>
      {open ? (
        <div className="tag-picker">
          <div className="tag-picker-search">
            <Search size={15} />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="输入中文译名、别名或原始 tag"
            />
            {loading || cachedLoading ? <span className="tag-filter-state">...</span> : null}
            {error ? <span className="tag-filter-state error">!</span> : null}
          </div>
          {selected.length ? (
            <div className="tag-picker-selected">
              <span>已选</span>
              <div>
                {selected.map((tag) => (
                  <button key={tag.id} type="button" onClick={() => remove(tag)}>
                    {defaultDisplayTag(tag)}
                    <X size={12} />
                  </button>
                ))}
                <button className="clear-tags" type="button" onClick={clear} aria-label="清除全部标签">
                  清除
                </button>
              </div>
            </div>
          ) : null}
          <div className="tag-picker-list">
            {visible.map((tag) => {
              const active = selected.some((item) => item.id === tag.id);
              return (
                <button key={tag.id} className={active ? "active" : ""} type="button" onClick={() => toggle(tag)}>
                  <span className="tag-picker-labels">
                    <strong>{defaultDisplayTag(tag)}</strong>
                    <small>{tag.name || tag.slug || `#${tag.id}`}</small>
                  </span>
                  <span>{active ? "已选" : tag.type || "tag"}</span>
                </button>
              );
            })}
            {!visible.length && !loading && !cachedLoading ? (
              <div className="tag-picker-empty">
                {canSearchTag(q) ? "没有真实 tag 结果" : "暂无缓存 tag，输入中文或至少 2 个字符搜索"}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function canSearchTag(value: string) {
  return /[^\x00-\x7F]/.test(value) || value.length >= 2;
}

function uniqueRemoteTags(tags: RemoteTag[]) {
  const seen = new Set<number>();
  return tags.filter((tag) => {
    if (typeof tag.id !== "number" || seen.has(tag.id)) return false;
    seen.add(tag.id);
    return true;
  });
}
