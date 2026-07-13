import { DiscoverSurface, TagFilter } from "./discoverTypes";

export const DISCOVER_STATE_KEY = "nh-archive:discover-state";

export type PersistedDiscoverState = {
  surface: DiscoverSurface;
  query: string;
  submittedQuery: string;
  language: string;
  kind: string;
  sort: string;
  unimportedOnly: boolean;
  selectedTags: TagFilter[];
  page: number;
  scrollY: number;
};

export type DiscoverFilterKeyInput = {
  activeQuery: string;
  kind: string;
  language: string;
  selectedTags: TagFilter[];
  sort: string;
  surface: DiscoverSurface;
  unimportedOnly: boolean;
};

export function defaultDiscoverState(): PersistedDiscoverState {
  return {
    surface: "feed",
    query: "",
    submittedQuery: "",
    language: "all",
    kind: "all",
    sort: "date",
    unimportedOnly: false,
    selectedTags: [],
    page: 1,
    scrollY: 0,
  };
}

export function readDiscoverStateFrom(hash: string, rawSession: string | null): PersistedDiscoverState {
  const defaults = defaultDiscoverState();
  if (!rawSession) return readDiscoverHashState(defaults, hash);

  try {
    const parsed = JSON.parse(rawSession) as Partial<PersistedDiscoverState>;
    return readDiscoverHashState({
      ...defaults,
      ...parsed,
      page: Math.max(1, Number(parsed.page) || 1),
      scrollY: Math.max(0, Number(parsed.scrollY) || 0),
      selectedTags: Array.isArray(parsed.selectedTags) ? parsed.selectedTags : [],
      surface: isDiscoverSurface(parsed.surface) ? parsed.surface : defaults.surface,
    }, hash);
  } catch {
    return readDiscoverHashState(defaults, hash);
  }
}

export function serializeDiscoverHash(state: PersistedDiscoverState): string {
  const params = new URLSearchParams();
  params.set("page", String(Math.max(1, state.page)));
  if (state.surface !== "feed") params.set("surface", state.surface);
  if (state.submittedQuery) params.set("q", state.submittedQuery);
  if (state.language !== "all") params.set("language", state.language);
  if (state.kind !== "all") params.set("kind", state.kind);
  if (state.sort !== "date") params.set("sort", state.sort);
  if (state.unimportedOnly) params.set("unimported", "true");
  if (state.selectedTags.length === 1) {
    const tag = state.selectedTags[0];
    params.set("tag_id", String(tag.id));
    if (tag.type) params.set("tag_type", tag.type);
    if (tag.name) params.set("tag_name", tag.name);
    if (tag.slug) params.set("tag_slug", tag.slug);
    if (tag.display) params.set("tag_display", tag.display);
  }
  return `#discover?${params.toString()}`;
}

export function canReplaceDiscoverHash(hash: string): boolean {
  const normalized = hash.replace(/^#/, "");
  const [route] = normalized.split("?");
  return !route || route === "discover";
}

export function discoverFilterKey(input: DiscoverFilterKeyInput): string {
  return JSON.stringify({
    activeQuery: input.activeQuery,
    kind: input.kind,
    language: input.language,
    selectedTags: input.selectedTags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      type: tag.type,
    })),
    sort: input.sort,
    surface: input.surface,
    unimportedOnly: input.unimportedOnly,
  });
}

export function nextDiscoverFeedLoad(
  previousFilterKey: string | null,
  currentFilterKey: string,
  restoredPage: number
): { page: number; isInitialLoad: boolean } {
  // Treat "no previous key" and "same key as before" both as an initial load so
  // that React StrictMode's double-invoked effect (dev only) doesn't mistake the
  // second run for a real filter change and reset the restored page to 1.
  const isInitialLoad = previousFilterKey === null || previousFilterKey === currentFilterKey;
  return {
    page: isInitialLoad ? Math.max(1, restoredPage) : 1,
    isInitialLoad,
  };
}

function readDiscoverHashState(base: PersistedDiscoverState, hash: string): PersistedDiscoverState {
  const normalized = hash.replace(/^#/, "");
  const [route, rawQuery = ""] = normalized.split("?");
  if (route && route !== "discover") return base;

  const params = new URLSearchParams(rawQuery);
  const hasPage = params.has("page");
  const page = Number(params.get("page"));
  const tagId = Number(params.get("tag_id"));
  const hasTag = Number.isFinite(tagId) && tagId > 0;

  return {
    ...base,
    page: hasPage && Number.isFinite(page) && page > 0 ? page : hasTag ? 1 : base.page,
    scrollY: hasTag && !hasPage ? 0 : base.scrollY,
    surface: isDiscoverSurface(params.get("surface")) ? (params.get("surface") as DiscoverSurface) : base.surface,
    query: params.get("q") ?? base.query,
    submittedQuery: params.get("q") ?? base.submittedQuery,
    language: params.get("language") ?? base.language,
    kind: params.get("kind") ?? base.kind,
    sort: params.get("sort") ?? base.sort,
    unimportedOnly: params.get("unimported") === "true" ? true : base.unimportedOnly,
    selectedTags: hasTag
      ? [{
          id: tagId,
          type: params.get("tag_type") || undefined,
          name: params.get("tag_name") || undefined,
          slug: params.get("tag_slug") || undefined,
          display: params.get("tag_display") || undefined,
        }]
      : base.selectedTags,
  };
}

function isDiscoverSurface(value: unknown): value is DiscoverSurface {
  return value === "feed" || value === "upload" || value === "scan";
}
