export type Page =
  | { name: "discover" }
  | { name: "library" }
  | { name: "reader"; workId: number }
  | { name: "tasks" }
  | { name: "settings" };

export function pageFromLocation(): Page {
  const hash = window.location.hash.replace(/^#/, "");
  const readerMatch = hash.match(/^reader\/(\d+)$/);
  if (readerMatch) return { name: "reader", workId: Number(readerMatch[1]) };
  if (hash === "library") return { name: "library" };
  if (hash === "tasks") return { name: "tasks" };
  if (hash === "settings") return { name: "settings" };
  return { name: "discover" };
}

export function navigate(page: Page) {
  const hash = page.name === "reader" ? `reader/${page.workId}` : page.name;
  window.location.hash = hash;
}
