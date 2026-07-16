import type { RemoteTag } from "./api";

export type Page =
  | { name: "workbench" }
  | { name: "discover"; tag?: RemoteTag }
  | { name: "library" }
  | { name: "reader"; workId: number }
  | { name: "readerRemote"; galleryId: number }
  | { name: "gallery"; galleryId: number; returnTo?: string }
  | { name: "governance"; workId?: number }
  | { name: "export"; workId?: number }
  | { name: "dictionary" }
  | { name: "tasks" }
  | { name: "files" }
  | { name: "history" }
  | { name: "settings" };

export function pageFromLocation(): Page {
  const hash = window.location.hash.replace(/^#/, "");
  const [route, rawQuery = ""] = hash.split("?");
  const query = new URLSearchParams(rawQuery);
  const remoteReaderMatch = hash.match(/^reader\/remote\/(\d+)$/);
  if (remoteReaderMatch) return { name: "readerRemote", galleryId: Number(remoteReaderMatch[1]) };
  const readerMatch = hash.match(/^reader\/(\d+)$/);
  if (readerMatch) return { name: "reader", workId: Number(readerMatch[1]) };
  const galleryMatch = route.match(/^gallery\/(\d+)$/);
  if (galleryMatch) return { name: "gallery", galleryId: Number(galleryMatch[1]), returnTo: query.get("return_to") || undefined };
  const governanceMatch = hash.match(/^governance\/(\d+)$/);
  if (governanceMatch) return { name: "governance", workId: Number(governanceMatch[1]) };
  const exportMatch = hash.match(/^export\/(\d+)$/);
  if (exportMatch) return { name: "export", workId: Number(exportMatch[1]) };
  if (route === "workbench") return { name: "workbench" };
  if (route === "library") return { name: "library" };
  if (route === "governance") return { name: "governance" };
  if (route === "dictionary") return { name: "dictionary" };
  if (route === "tasks") return { name: "tasks" };
  if (route === "export") return { name: "export" };
  if (route === "files") return { name: "files" };
  if (route === "history") return { name: "history" };
  if (route === "settings") return { name: "settings" };
  if (route === "discover") {
    const tagId = Number(query.get("tag_id"));
    if (Number.isFinite(tagId) && tagId > 0) {
      return {
        name: "discover",
        tag: {
          id: tagId,
          type: query.get("tag_type") || undefined,
          name: query.get("tag_name") || undefined,
          slug: query.get("tag_slug") || undefined,
          display: query.get("tag_display") || undefined,
        },
      };
    }
    return { name: "discover" };
  }
  return { name: "discover" };
}

export function navigate(page: Page) {
  const hash =
    page.name === "reader"
      ? `reader/${page.workId}`
      : page.name === "readerRemote"
        ? `reader/remote/${page.galleryId}`
        : page.name === "gallery"
          ? `gallery/${page.galleryId}${page.returnTo ? `?return_to=${encodeURIComponent(page.returnTo)}` : ""}`
          : page.name === "governance" && page.workId
            ? `governance/${page.workId}`
            : page.name === "export" && page.workId
              ? `export/${page.workId}`
            : page.name === "discover" && page.tag
              ? `discover?${tagQuery(page.tag)}`
            : page.name;
  window.location.hash = hash;
}

export function tagSearchHref(tag: {
  id?: number | null;
  type?: string | null;
  name?: string | null;
  slug?: string | null;
  display?: string | null;
}) {
  const id = Number(tag.id);
  if (Number.isFinite(id) && id > 0) {
    return `#discover?${tagQuery({
      id,
      type: tag.type || undefined,
      name: tag.name || undefined,
      slug: tag.slug || undefined,
      display: tag.display || undefined,
    })}`;
  }
  const query = tag.name || tag.slug || tag.display;
  return `#discover${query ? `?q=${encodeURIComponent(query)}` : ""}`;
}

function tagQuery(tag: RemoteTag) {
  const query = new URLSearchParams();
  query.set("tag_id", String(tag.id));
  if (tag.type) query.set("tag_type", tag.type);
  if (tag.name) query.set("tag_name", tag.name);
  if (tag.slug) query.set("tag_slug", tag.slug);
  if (tag.display) query.set("tag_display", tag.display);
  return query.toString();
}
