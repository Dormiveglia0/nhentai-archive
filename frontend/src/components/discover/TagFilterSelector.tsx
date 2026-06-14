import { ChevronDown, Search, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";

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
      .then((payload) => setCached(payload.result.filter((tag): tag is RemoteTag => typeof tag.id === "number")))
      .catch((exc) => setError(exc instanceof Error ? exc.message : String(exc)))
      .finally(() => setCachedLoading(false));
  }, [cached.length, cachedLoading, open]);

  useEffect(() => {
    const q = query.trim();
    latestQuery.current = q;
    setError(null);
    if (!open || q.length < 2) {
      setSuggestions([]);
      return;
    }
    const handle = window.setTimeout(async () => {
      setLoading(true);
      try {
        const payload = await api.dictionaryAutocomplete(q, 12);
        if (latestQuery.current === q) setSuggestions(payload.result.filter((tag): tag is RemoteTag => typeof tag.id === "number"));
      } catch (exc) {
        if (latestQuery.current === q) setError(exc instanceof Error ? exc.message : String(exc));
      } finally {
        if (latestQuery.current === q) setLoading(false);
      }
    }, 220);
    return () => window.clearTimeout(handle);
  }, [query, open]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const first = (query.trim().length >= 2 ? suggestions : cached)[0];
    if (first) {
      choose(first);
    }
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
  const visible = q.length >= 2 ? suggestions : cached;

  return (
    <div ref={rootRef} className={open ? "tag-filter-shell open" : "tag-filter-shell"}>
      <button className="tag-filter tag-filter-trigger" type="button" onClick={() => setOpen((value) => !value)}>
        <Search size={15} />
        <span>{selected.length ? `已选 ${selected.length} 个 tag` : "选择或搜索远端 tag"}</span>
        <ChevronDown size={15} />
      </button>
      {selected.length ? (
        <div className="tag-filter-chips">
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
      ) : null}
      {open ? (
        <div className="tag-picker">
          <form className="tag-picker-search" onSubmit={submit}>
            <Search size={15} />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="输入 tag，词典接入后支持中文映射"
            />
            {loading || cachedLoading ? <span className="tag-filter-state">...</span> : null}
            {error ? <span className="tag-filter-state error">!</span> : null}
          </form>
          <div className="tag-picker-list">
            {visible.map((tag) => {
              const active = selected.some((item) => item.id === tag.id);
              return (
                <button key={tag.id} className={active ? "active" : ""} type="button" onClick={() => toggle(tag)}>
                  <strong>{defaultDisplayTag(tag)}</strong>
                  <span>{active ? "已选" : tag.type || "tag"}</span>
                </button>
              );
            })}
            {!visible.length && !loading && !cachedLoading ? (
              <div className="tag-picker-empty">
                {q.length >= 2 ? "没有真实 tag 结果" : "暂无缓存 tag，输入至少 2 个字符搜索远端"}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
