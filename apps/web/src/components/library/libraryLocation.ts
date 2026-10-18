import type { LibraryGrouping, LibraryTagFilter } from "../../lib/api";
import type { LibraryView } from "./LibraryToolbar";

export type LibraryLocation = {
  q: string; tags: LibraryTagFilter[]; language: string; readStatus: string;
  libraryId: string; sort: string; favoriteOnly: boolean; view: LibraryView; page: number; groupBy: LibraryGrouping;
};

export function readLibraryLocation(): LibraryLocation {
  const p = new URLSearchParams(window.location.hash.split("?")[1]);
  const id = Number(p.get("tag_id")), key = p.get("tag_key") || undefined;
  let tags: LibraryTagFilter[] = [];
  try {
    const saved: unknown = JSON.parse(p.get("tags") || "[]");
    if (Array.isArray(saved)) tags = saved.filter(tag => tag && typeof tag === "object" && typeof tag.display === "string").slice(0, 50);
  } catch { /* Old tag links remain valid without a serialized filter list. */ }
  if (!tags.length && (key || (Number.isSafeInteger(id) && id > 0))) tags = [{
    id: id > 0 ? id : null, key, type: p.get("tag_type") || undefined,
    name: p.get("tag_name") || undefined, slug: p.get("tag_slug") || undefined,
    display: p.get("tag_display") || p.get("tag_name") || p.get("tag_slug") || String(id), count: 0,
  }];
  const library = Number(p.get("library_id"));
  const page = Number(p.get("page"));
  return {
    q: p.get("q") || "", tags, language: p.get("language") || "all", readStatus: p.get("read_status") || "all",
    libraryId: Number.isSafeInteger(library) && (library > 0 || library === -1) ? String(library) : "all",
    sort: p.get("sort") || "recent_updated", favoriteOnly: p.get("favorite") === "true",
    groupBy: p.get("group_by") === "author" ? "author" : p.get("group_by") === "none" ? "none" : "manual",
    view: p.get("view") === "list" ? "list" : "grid", page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  };
}

export function libraryLocationHash(state: LibraryLocation) {
  const p = new URLSearchParams({ page: String(state.page) });
  if (state.q) p.set("q", state.q);
  if (state.tags.length) p.set("tags", JSON.stringify(state.tags));
  if (state.libraryId !== "all") p.set("library_id", state.libraryId);
  if (state.language !== "all") p.set("language", state.language);
  if (state.readStatus !== "all") p.set("read_status", state.readStatus);
  if (state.sort !== "recent_updated") p.set("sort", state.sort);
  if (state.favoriteOnly) p.set("favorite", "true");
  if (state.view !== "grid") p.set("view", state.view);
  if (state.groupBy !== "manual") p.set("group_by", state.groupBy);
  return `#library?${p}`;
}
