import { copyFile, mkdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const root = process.env.E2E_METADATA_ROOT ?? "";
const libraryId = Number(process.env.E2E_METADATA_LIBRARY_ID);
const workId = Number(process.env.E2E_METADATA_WORK_ID);
const artifacts = process.env.E2E_MEDIA_SETTINGS_ARTIFACT_DIR;
test.skip(!(root === "/tmp/nh-reader-media-update-20261009/owned" || root.startsWith("/tmp/nh-media-update-20261009/metadata-browser-owned-")) || !libraryId || !workId,
  "Requires an owned actual archive in the isolated metadata QA database");

for (const width of [1440, 390]) {
  test(width + "px 实际目录库配置、扫描、暂停、移除与缓存保护", async ({ page, request }) => {
    test.setTimeout(90_000);
    const libraries = await (await request.get("/api/library/directories")).json();
    const originalLibrary = libraries.result.find((item: { id: number }) => item.id === libraryId);
    expect(originalLibrary.root_path).toBe(join(root, "media"));
    const originalCache = await (await request.get("/api/library/cache")).json();
    expect(originalCache.active_count).toBe(0);
    expect((await request.post("/api/library/cache/clear")).ok()).toBe(true);
    const source = join(root, "media", "selected.cbz");
    const before = await stat(source);
    const directory = join(root, "settings-ui-" + width);
    const name = "媒体库验收 " + width;
    await mkdir(directory, { recursive: true });
    await copyFile(source, join(directory, "selected.cbz"));
    let addedId: number | undefined;
    let scanJobId: number | undefined;
    let lease: string | null = null;
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    try {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await page.goto("/#files");
      const section = page.getByRole("region", { name: "媒体库", exact: true });
      await section.getByRole("button", { name: "添加库", exact: true }).click();
      const editor = page.getByRole("dialog", { name: "添加媒体库", exact: true });
      await expect(editor.getByLabel("库名", { exact: true })).toBeFocused();
      await editor.getByLabel("库名", { exact: true }).fill(name);
      await editor.getByLabel("目录路径", { exact: true }).fill(directory);
      await editor.locator(".folio-toggle-row").filter({ hasText: "自动检查文件变化" }).click();
      await editor.getByRole("button", { name: /^语言策略：/ }).click();
      await page.keyboard.press("Escape");
      await expect(editor).toBeVisible();
      await expect(editor.getByRole("button", { name: /^语言策略：/ })).toBeFocused();
      await editor.getByRole("button", { name: /^语言策略：/ }).click();
      await editor.getByRole("group", { name: "语言策略选项" }).getByRole("button", { name: "只匹配指定语言", exact: true }).click();
      await editor.getByRole("button", { name: /^目标语言：/ }).click();
      await editor.getByRole("group", { name: "目标语言选项" }).getByRole("button", { name: "日文", exact: true }).click();
      await editor.getByText("扫描参数", { exact: true }).click();
      await editor.getByLabel("文件稳定等待（秒）", { exact: true }).fill("0");
      await editor.getByLabel("定时检查间隔（秒）", { exact: true }).fill("10");
      expect(await editor.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      expect(await editor.evaluate(element => getComputedStyle(element).borderRadius)).toBe("0px");
      if (artifacts) {
        await mkdir(artifacts, { recursive: true });
        await editor.screenshot({ path: join(artifacts, "library-editor-" + width + ".png") });
      }
      const added = page.waitForResponse(response => response.url().endsWith("/api/library/directories") && response.request().method() === "POST");
      await editor.getByRole("button", { name: "添加媒体库", exact: true }).click();
      const saved = await (await added).json();
      addedId = saved.id;
      expect(saved.config).toMatchObject({ watch: false, stable_seconds: 0, language_mode: "strict", language: "japanese", auto_scrape: false });
      expect(saved.read_only).toBe(true);
      await expect(editor).toHaveCount(0);
      const row = section.locator(".folio-library-directory").filter({ has: page.getByRole("heading", { name, exact: true }) });
      const enqueued = page.waitForResponse(response => response.url().endsWith("/api/library/scan") && response.request().method() === "POST");
      await row.getByRole("button", { name: "扫描", exact: true }).click();
      const job = await (await enqueued).json();
      scanJobId = job.id;
      expect(job.target.library_id).toBe(addedId);
      await expect.poll(async () => (await (await request.get("/api/jobs/" + job.id)).json()).status).toBe("completed");
      await expect(row).toContainText("1 部作品", { timeout: 12_000 });
      await row.getByRole("button", { name: "文件状态", exact: true }).click();
      await row.getByRole("button", { name: /^文件状态：/ }).click();
      await row.getByRole("group", { name: "文件状态选项" }).getByRole("button", { name: "全部文件", exact: true }).click();
      await expect(row.locator(".folio-library-issues")).toContainText("selected.cbz");
      await row.getByRole("button", { name: "暂停", exact: true }).click();
      await expect(row).toContainText("已暂停");
      await expect(row.getByRole("button", { name: "扫描", exact: true })).toBeDisabled();
      await row.getByRole("button", { name: "启用", exact: true }).click();
      await expect(row.getByRole("button", { name: "扫描", exact: true })).toBeEnabled();

      await page.goto("/#settings?section=storage");
      const cache = page.getByRole("region", { name: "阅读缓存", exact: true });
      await cache.getByLabel("缓存配额（GiB）", { exact: true }).fill("1");
      await cache.getByLabel("空闲保留期限（小时）", { exact: true }).fill("24");
      await cache.getByRole("button", { name: "保存缓存设置", exact: true }).click();
      await expect(cache.getByRole("status")).toContainText("阅读缓存设置已保存");
      const configured = await (await request.get("/api/library/cache")).json();
      expect(configured.config).toMatchObject({ max_bytes: 1024 ** 3, ttl_hours: 24 });
      await request.patch("/api/library/directories/" + libraryId, { data: { config: { cache_mode: "always" } } });
      await request.patch("/api/library/directories/" + addedId, { data: { config: { cache_mode: "always" } } });
      await expect.poll(async () => {
        const prepared = await (await request.post("/api/works/" + workId + "/reading-source")).json();
        if (prepared.lease) lease = prepared.lease;
        return prepared.status;
      }).toBe("ready");
      expect(lease).toBeTruthy();
      await cache.getByRole("button", { name: "刷新缓存用量", exact: true }).click();
      await expect(cache).toContainText("1 部在用");
      page.once("dialog", dialog => dialog.accept());
      await cache.getByRole("button", { name: "清理缓存", exact: true }).click();
      await expect(cache.getByRole("status")).toContainText("已清理 0 部缓存");
      expect((await (await request.get("/api/library/cache")).json()).ready_bytes).toBe(before.size);
      await request.delete("/api/works/" + workId + "/reading-source/" + lease);
      lease = null;
      page.once("dialog", dialog => dialog.accept());
      await cache.getByRole("button", { name: "清理缓存", exact: true }).click();
      await expect(cache.getByRole("status")).toContainText("已清理 1 部缓存");
      expect((await (await request.get("/api/library/cache")).json()).ready_bytes).toBe(0);
      expect(await cache.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await page.goto("/#files");
      expect(await section.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      if (artifacts) await section.screenshot({ path: join(artifacts, "libraries-" + width + ".png") });
      await row.getByRole("button", { name: "移除媒体库 " + name, exact: true }).click();
      await page.getByRole("dialog", { name: "移除媒体库", exact: true }).getByRole("button", { name: "确认移除", exact: true }).click();
      await expect(row).toHaveCount(0);
      expect((await stat(join(directory, "selected.cbz"))).size).toBe(before.size);
      expect((await stat(source)).mtimeMs).toBe(before.mtimeMs);
      expect(errors).toEqual([]);
    } finally {
      if (scanJobId) {
        const job = await (await request.get("/api/jobs/" + scanJobId)).json();
        if (["queued", "running", "paused", "cancelling"].includes(job.status)) {
          await request.post("/api/jobs/" + scanJobId + "/cancel");
          await expect.poll(async () => (await (await request.get("/api/jobs/" + scanJobId)).json()).status).toMatch(/^(completed|cancelled|failed)$/);
        }
      }
      if (lease) await request.delete("/api/works/" + workId + "/reading-source/" + lease);
      await request.patch("/api/library/directories/" + libraryId, { data: { config: { cache_mode: originalLibrary.config.cache_mode } } });
      await request.patch("/api/library/cache", { data: originalCache.config });
      if (addedId) await request.delete("/api/library/directories/" + addedId);
      await rm(directory, { recursive: true, force: true });
    }
  });
}
