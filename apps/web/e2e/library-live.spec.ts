import { copyFile, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const root = process.env.E2E_METADATA_ROOT ?? "";
const libraryId = Number(process.env.E2E_METADATA_LIBRARY_ID);
const workId = Number(process.env.E2E_METADATA_WORK_ID);
const secondary = process.env.E2E_MONITOR_ACTUAL_SOURCE ?? "";
const artifacts = process.env.E2E_LIVE_LIBRARY_ARTIFACT_DIR;
test.skip(!(root === "/tmp/nh-reader-media-update-20261009/owned" || root.startsWith("/tmp/nh-media-update-20261009/metadata-browser-owned-")) || !libraryId || !workId ||
  !(secondary === "/tmp/nh-reader-media-update-20261009/owned/monitor-actual-secondary.cbz" || secondary === "/tmp/nh-media-update-20261009/monitor-actual-secondary.cbz"), "Requires owned copies of two different actual archives");

test("原生文件监听自动刷新作品墙、更新封面且保留打开的详情", async ({ page, request }) => {
  test.setTimeout(90_000);
  const libraries = await (await request.get("/api/library/directories")).json();
  const original = libraries.result.find((library: { id: number }) => library.id === libraryId);
  expect(original.root_path).toBe(join(root, "media"));
  const primary = await (await request.get("/api/works/" + workId)).json();
  const beforeCache = await (await request.get("/api/library/cache")).json();
  const beforeJobs = (await (await request.get("/api/jobs")).json()).result.length;
  const fileName = "monitor-ui-" + Date.now() + ".cbz";
  const target = join(root, "media", fileName);
  let addedId: number | undefined;
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    expect((await request.patch("/api/library/directories/" + libraryId, { data: { config: { watch: true, stable_seconds: 0,
      scan_interval_seconds: 10, auto_bind: false, auto_scrape: false } } })).ok()).toBe(true);
    await page.goto("/#library?library_id=" + libraryId);
    await expect(page.locator(".folio-library-card")).toHaveCount(1);
    await page.locator('.folio-library-card-title[href="#reader/' + workId + '"]').click();
    const dialog = page.locator(".folio-work-dialog");
    await expect(dialog).toBeVisible();
    const started = performance.now();
    await copyFile(secondary, target + ".part");
    await rename(target + ".part", target);
    await expect(page.locator(".folio-library-card")).toHaveCount(2, { timeout: 20_000 });
    const addedMs = performance.now() - started;
    await expect(dialog).toBeVisible();
    const added = (await (await request.get("/api/library/search?library_id=" + libraryId)).json()).result.find((work: { id: number }) => work.id !== workId);
    expect(added?.page_count).toBeGreaterThan(0);
    addedId = added.id;
    expect(added.remote_gallery_id).toBeNull();
    const card = page.locator(".folio-library-card").filter({ has: page.locator('.folio-library-cover[href="#reader/' + addedId + '"]') });
    const cover = card.locator(".folio-library-cover .folio-ambient-cover-artwork");
    const beforeSrc = await cover.getAttribute("src");
    expect(beforeSrc).toContain("&v=");
    const replaced = performance.now();
    await copyFile(join(root, "media", "selected.cbz"), target + ".part");
    await rename(target + ".part", target);
    await expect(cover).not.toHaveAttribute("src", beforeSrc!, { timeout: 20_000 });
    const updatedMs = performance.now() - replaced;
    await expect(dialog).toBeVisible();
    const changed = await (await request.get("/api/works/" + addedId)).json();
    expect(changed.page_count).toBe(primary.page_count);
    expect((await (await request.get("/api/library/cache")).json()).ready_bytes).toBe(beforeCache.ready_bytes);
    expect((await (await request.get("/api/jobs")).json()).result.length).toBe(beforeJobs);
    await dialog.getByRole("button", { name: "关闭作品详情", exact: true }).click();
    if (artifacts) {
      await mkdir(artifacts, { recursive: true });
      await page.screenshot({ path: join(artifacts, "wall-updated.png"), animations: "disabled" });
      await writeFile(join(artifacts, "monitor-timings.json"), JSON.stringify({ addedMs, updatedMs, originalWorkPreserved: true, noArchiveCacheCopy: true, noBackgroundJobs: true }));
    }
    expect(errors).toEqual([]);
  } finally {
    await request.patch("/api/library/directories/" + libraryId, { data: { config: original.config } });
    await rm(target, { force: true });
    await rm(target + ".part", { force: true });
    await expect.poll(async () => (await (await request.get("/api/library/directories")).json()).result.find((library: { id: number }) => library.id === libraryId)?.scanning).toBe(false);
    if (addedId) {
      const cleaned = spawnSync("/opt/nhentai/.venv/bin/python", ["-c", "import sqlite3,sys; from pathlib import Path; root=Path(sys.argv[1]); c=sqlite3.connect(root/'data/archive.db'); c.execute('PRAGMA foreign_keys=ON'); c.execute('BEGIN IMMEDIATE'); row=c.execute('SELECT w.cover_path FROM works w JOIN library_items i ON i.work_id=w.id WHERE w.id=? AND i.library_id=? AND i.relative_path=?', (int(sys.argv[2]),int(sys.argv[3]),sys.argv[4])).fetchone(); assert row; c.execute('DELETE FROM works WHERE id=?', (int(sys.argv[2]),)); c.commit(); c.close(); cover=Path(row[0]); cover=cover if cover.is_absolute() else root/'data'/cover; assert (root/'data/covers').resolve() in cover.resolve().parents; cover.unlink(missing_ok=True)", root, String(addedId), String(libraryId), fileName], { encoding: "utf8" });
      expect(cleaned.status, cleaned.stderr).toBe(0);
    }
  }
});
