export type Page =
  | { name: "workbench" }
  | { name: "discover" }
  | { name: "library" }
  | { name: "reader"; workId: number }
  | { name: "governance" }
  | { name: "dictionary" }
  | { name: "tasks" }
  | { name: "export" }
  | { name: "files" }
  | { name: "settings" };

export function pageFromLocation(): Page {
  const hash = window.location.hash.replace(/^#/, "");
  const readerMatch = hash.match(/^reader\/(\d+)$/);
  if (readerMatch) return { name: "reader", workId: Number(readerMatch[1]) };
  if (hash === "workbench") return { name: "workbench" };
  if (hash === "library") return { name: "library" };
  if (hash === "governance") return { name: "governance" };
  if (hash === "dictionary") return { name: "dictionary" };
  if (hash === "tasks") return { name: "tasks" };
  if (hash === "export") return { name: "export" };
  if (hash === "files") return { name: "files" };
  if (hash === "settings") return { name: "settings" };
  return { name: "discover" };
}

export function navigate(page: Page) {
  const hash = page.name === "reader" ? `reader/${page.workId}` : page.name;
  window.location.hash = hash;
}
