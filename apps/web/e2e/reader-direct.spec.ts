import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";

const workId = process.env.E2E_DIRECT_WORK_ID;
const root = process.env.E2E_DIRECT_ROOT;
test.skip(!workId || !root, "Requires an owned actual archive copy in /tmp/direct-reader-owned-* with cache off and original.cbz backup.");
const changeArchive = async (restore = false) => {
  const script = `
import shutil, sys, zipfile
from pathlib import Path
from app.config import Settings
from app.database import Database
from app.services.archive_service import ArchiveService
from app.services.library_index_service import LibraryIndexService
root = Path(sys.argv[1])
assert root.resolve() == root and str(root).startswith('/tmp/') and root.name.startswith('direct-reader-owned-')
source = root / 'media/selected.cbz'
assert source.resolve().is_relative_to(root) and not source.is_symlink()
if sys.argv[2] == 'restore':
    shutil.copyfile(root / 'original.cbz', source)
else:
    with zipfile.ZipFile(source, 'a') as book:
        first = next(info for info in book.infolist() if Path(info.filename).suffix.lower() in {'.jpg', '.jpeg', '.png', '.webp'})
        book.writestr('qa-version-page' + Path(first.filename).suffix, book.read(first))
settings = Settings(data_dir=root / 'data')
db = Database(settings.database_path)
archive = ArchiveService(db, settings)
library = db.fetchone("SELECT id FROM media_libraries WHERE kind = 'mounted'")
assert LibraryIndexService(settings, db, archive.libraries).scan(library['id'])['counts']['indexed'] == 1
archive.cache.close()
`;
  await promisify(execFile)(process.env.E2E_PYTHON ?? "/opt/nhentai/.venv/bin/python", ["-c", script, root!, restore ? "restore" : "mutate"], {
    env: { ...process.env, PYTHONPATH: resolve(process.cwd(), "../api") },
  });
};

for (const width of [1440, 390]) {
  test(`挂载直读在 ${width}px 阻止旧版进度并通过重试重新打开`, async ({ page }) => {
    test.setTimeout(45_000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.request.patch(`/api/works/${workId}/reader-state`, { data: { page_index: 1, completed: false } });
    const prepared = await (await page.request.post(`/api/works/${workId}/reading-source`)).json();
    expect(prepared.status).toBe("direct");
    let releaseStale: (() => void) | undefined;
    let staleHeld = false;
    const delayedStale = new Promise<void>((resolve) => { releaseStale = resolve; });
    if (width === 390) await page.route(`**/api/works/${workId}/reader-state`, async (route) => {
      const response = await route.fetch();
      if (response.status() === 409) { staleHeld = true; await delayedStale; }
      await route.fulfill({ response });
    });
    try {
      await page.goto(`/#reader/${workId}`);
      await expect(page.locator(".reader-counter")).toHaveText(new RegExp(`^1\\s*\\/\\s*${prepared.pages.length}$`));
      await page.getByRole("button", { name: "阅读设置", exact: true }).click();
      await page.getByRole("button", { name: "单页", exact: true }).click();
      await page.keyboard.press("Escape");
      const image = page.locator(".reader-single img");
      await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth > 0)).toBe(true);
      await expect(image).toHaveAttribute("src", new RegExp(`source_revision=${prepared.source_revision}`));
      expect(await page.locator(".reader-viewport").evaluate((node) => getComputedStyle(node).inset)).toBe("0px");

      await changeArchive();
      if (!await page.locator(".reader-toolbar").count()) await page.locator(".reader-zone-center").click({ position: { x: 30, y: 250 } });
      await page.getByRole("button", { name: "下一页" }).click();
      await expect(page.locator(".reader-img-error")).toBeVisible();
      if (width === 390) await expect.poll(() => staleHeld).toBe(true);
      else await expect(page.locator(".reader-feedback.is-error")).toContainText("重新打开作品");
      const state = await (await page.request.get(`/api/works/${workId}/reader-state`)).json();
      expect(state.completed).toBeFalsy();
      expect(state.page_index).toBe(1);
      expect(state.page_count).toBe(prepared.pages.length + 1);
      await page.getByRole("button", { name: "重试全部", exact: true }).click();
      await expect(page.locator(".reader-img-error")).toHaveCount(0);
      await expect(page.locator(".reader-counter")).toHaveText(new RegExp(`^1\\s*\\/\\s*${prepared.pages.length + 1}$`));
      await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth > 0)).toBe(true);
      await expect(image).not.toHaveAttribute("src", new RegExp(prepared.source_revision));
      const staleResponse = width === 390 ? page.waitForResponse((response) => response.status() === 409 && response.url().endsWith(`/api/works/${workId}/reader-state`)) : null;
      releaseStale?.();
      if (staleResponse) {
        await (await staleResponse).finished();
        await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      }
      await expect(page.locator(".reader-feedback.is-error")).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect((await (await page.request.get("/api/library/cache")).json()).ready_count).toBe(0);
      if (process.env.E2E_DIRECT_ARTIFACT_DIR) {
        await mkdir(process.env.E2E_DIRECT_ARTIFACT_DIR, { recursive: true });
        await page.screenshot({ path: `${process.env.E2E_DIRECT_ARTIFACT_DIR}/direct-reader-${width}.png` });
      }
      await page.goto("/#library");
      await expect(page.locator(".reader-shell")).toHaveCount(0);
      expect(errors).toEqual([]);
    } finally {
      releaseStale?.();
      await changeArchive(true);
    }
  });
}
