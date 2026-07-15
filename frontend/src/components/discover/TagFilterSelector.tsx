import { Check, ChevronDown, Search, Tag, X } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";

import { api, type RemoteTag } from "../../lib/api";
import { duration, ease } from "../../lib/motion";
import { tagSearchHref } from "../../lib/navigation";
import type { TagFilter } from "./discoverTypes";
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
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<"tag" | "meta">("tag");
  const cachedRequested = useRef(false);
  const latestQuery = useRef("");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape" || !open) return;
      setOpen(false);
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!open || cachedRequested.current) return;
    let cancelled = false;
    cachedRequested.current = true;
    setLoading(true);
    setError(null);
    void api.dictionaryCandidates({ limit: 80 })
      .then((payload) => {
        if (!cancelled) {
          setCached(uniqueRemoteTags(payload.result.filter((tag): tag is RemoteTag => typeof tag.id === "number")));
        }
      })
      .catch((exception) => {
        if (!cancelled) {
          cachedRequested.current = false;
          setError(exception instanceof Error ? exception.message : String(exception));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    const normalizedQuery = query.trim();
    latestQuery.current = normalizedQuery;
    setError(null);
    if (!open || !canSearchTag(normalizedQuery)) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;
    const handle = window.setTimeout(async () => {
      setLoading(true);
      try {
        const payload = await api.dictionaryAutocomplete(normalizedQuery, 12);
        if (!cancelled && latestQuery.current === normalizedQuery) {
          setSuggestions(uniqueRemoteTags(payload.result));
        }
      } catch (exception) {
        if (!cancelled && latestQuery.current === normalizedQuery) {
          setError(exception instanceof Error ? exception.message : String(exception));
        }
      } finally {
        if (!cancelled && latestQuery.current === normalizedQuery) setLoading(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [open, query]);

  function chooseFirst() {
    const first = (canSearchTag(query.trim()) ? suggestions : cached).find((tag) => matchesScope(tag, scope));
    if (first) toggle(first);
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    chooseFirst();
  }

  function remove(tag: RemoteTag) {
    onSelect(selected.filter((item) => item.id !== tag.id));
  }

  function toggle(tag: RemoteTag) {
    if (typeof tag.id !== "number") {
      setError("该词条尚未映射远端 tag，不能用于远端筛选。");
      return;
    }
    if (selected.some((item) => item.id === tag.id)) remove(tag);
    else onSelect([...selected, tag]);
    setQuery("");
    setSuggestions([]);
  }

  const normalizedQuery = query.trim();
  const visible = uniqueRemoteTags([...selected, ...(canSearchTag(normalizedQuery) ? suggestions : cached)])
    .filter((tag) => matchesScope(tag, scope));

  return (
    <div ref={rootRef} className={open ? "folio-discover-tags is-open" : "folio-discover-tags"}>
      {selected.length ? (
        <div className="folio-discover-tag-selection">
          <div className="folio-discover-tag-chips" aria-label="已选远端标签">
            {selected.map((tag) => (
              <span key={tag.id}>
                <a href={tagSearchHref(tag)}>{defaultDisplayTag(tag)}</a>
                <button type="button" aria-label={`移除标签 ${defaultDisplayTag(tag)}`} onClick={() => remove(tag)}><X size={12} /></button>
              </span>
            ))}
          </div>
          <button className="folio-discover-tag-clear" type="button" onClick={() => onSelect([])}><X size={13} />清空</button>
        </div>
      ) : null}

      <button
        ref={triggerRef}
        className="folio-discover-tag-trigger"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <Tag size={15} />
        <strong>{selected.length ? `${selected.length} 个标签` : "添加标签"}</strong>
        <ChevronDown size={14} />
      </button>

      <AnimatePresence>
        {open ? (
          <m.div
            id={panelId}
            className="folio-discover-tag-panel"
            role="dialog"
            aria-label="选择远端检索标签"
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
                onKeyDown={onSearchKeyDown}
                placeholder="中文译名、别名或原始 tag"
                aria-label="搜索远端标签"
              />
              {loading ? <span role="status">检索中</span> : null}
            </label>

            <div className="folio-discover-tag-scope" role="tablist" aria-label="标签候选分类">
              <button type="button" role="tab" aria-selected={scope === "tag"} className={scope === "tag" ? "is-active" : ""} onClick={() => setScope("tag")}>内容标签</button>
              <button type="button" role="tab" aria-selected={scope === "meta"} className={scope === "meta" ? "is-active" : ""} onClick={() => setScope("meta")}>作者与作品信息</button>
            </div>

            <div className="folio-discover-tag-options">
              {error ? <p role="alert">{error}</p> : null}
              {!error && visible.map((tag) => {
                const active = selected.some((item) => item.id === tag.id);
                return (
                  <a
                    key={tag.id}
                    href={tagSearchHref(tag)}
                    className={active ? "is-active" : ""}
                    aria-current={active ? "true" : undefined}
                    onClick={(event) => {
                      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
                      event.preventDefault();
                      toggle(tag);
                    }}
                  >
                    <span><strong>{defaultDisplayTag(tag)}</strong><small>{tag.name || tag.slug || `#${tag.id}`}</small></span>
                    <em>{tagTypeLabel(tag.type)}</em>
                    {active ? <Check size={15} /> : <i />}
                  </a>
                );
              })}
              {!error && !loading && !visible.length ? (
                <p>{canSearchTag(normalizedQuery) ? "没有真实 tag 结果" : "暂无缓存 tag；输入中文或至少两个字符检索"}</p>
              ) : null}
            </div>
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function canSearchTag(value: string) {
  return /[^\x00-\x7F]/.test(value) || value.length >= 2;
}

function uniqueRemoteTags(tags: RemoteTag[]) {
  const seen = new Set<number>();
  return tags.filter((tag) => {
    if (seen.has(tag.id)) return false;
    seen.add(tag.id);
    return true;
  });
}

function matchesScope(tag: RemoteTag, scope: "tag" | "meta") {
  return scope === "tag" ? (tag.type || "tag") === "tag" : (tag.type || "tag") !== "tag";
}

function tagTypeLabel(type?: string) {
  return ({ artist: "作者", group: "社团", parody: "原作", character: "角色", category: "分类", language: "语言", tag: "标签" } as Record<string, string>)[type || "tag"] || type || "标签";
}
