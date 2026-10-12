import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { expect, test } from "@playwright/test";

const dataRoot = process.env.E2E_RECORDS_DATA_DIR ?? "";
test.skip(!dataRoot.startsWith("/tmp/nh-media-audit-") || !process.env.E2E_STORAGE_STATE,
  "需要隔离正式库副本与真实会话");

test.beforeEach(async ({ request }) => {
  const settings = await (await request.get("/api/settings")).json();
  expect(settings.storage.data_dir).toBe(dataRoot);
});

for (const width of [1440, 390]) {
  test(`${width}px 缺失计数直接打开详情，取消与移除保留原作品`, async ({ page, request }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const libraries = await (await request.get("/api/library/directories")).json();
    const library = libraries.result.find((item: { kind: string }) => item.kind === "managed");
    const before = await (await request.get(`/api/library/directories/${library.id}/items?status=missing`)).json();
    const item = before.result.find((item: { work_id: number | null }) => item.work_id === null);
    expect(item).toBeDefined();
    const works = await (await request.get("/api/library/summary")).json();
    await page.goto("/#files");
    const row = page.locator(".folio-library-directory").filter({ has: page.getByRole("heading", { name: library.name, exact: true }) });
    await row.getByRole("button", { name: `${before.total} 缺失`, exact: true }).click();
    await expect(row.getByRole("button", { name: "文件状态：源文件缺失", exact: true })).toBeVisible();
    const entry = row.locator(".folio-library-issues li").filter({ hasText: item.relative_path }).first();
    await expect(entry).toContainText(item.title);
    await entry.locator("summary").click();
    await expect(entry.locator("dl")).toBeVisible();
    expect(await entry.locator("dt").count()).toBe(Object.keys(item.metadata).length);
    expect(await row.locator(".folio-library-scan-history").getAttribute("open")).toBeNull();
    page.once("dialog", dialog => dialog.dismiss());
    await entry.getByRole("button", { name: "移除缺失记录", exact: true }).click();
    expect((await (await request.get(`/api/library/directories/${library.id}/items?status=missing`)).json()).total).toBe(before.total);
    page.once("dialog", async dialog => {
      expect(dialog.message()).toContain("不会删除任何源文件");
      await dialog.accept();
    });
    await entry.getByRole("button", { name: "移除缺失记录", exact: true }).click();
    await expect(entry).toHaveCount(0);
    await expect(row.getByRole("status")).toContainText("缺失记录已移除");
    if (before.total > 1) await expect(row.getByRole("button", { name: `${before.total - 1} 缺失`, exact: true })).toBeVisible();
    else await expect(row.getByText("没有源文件缺失记录", { exact: true })).toBeVisible();
    expect((await (await request.get("/api/library/summary")).json()).total).toBe(works.total);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test(`${width}px 默认下载库可保存，暂停后明确报错`, async ({ page, request }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const original = await (await request.get("/api/settings")).json();
    const root = join(dirname(dataRoot), `browser-target-${width}`);
    await mkdir(root, { recursive: true });
    const name = `下载目标验收 ${width}`;
    let id: number | undefined;
    try {
      await page.goto("/#files");
      await page.getByRole("button", { name: "添加库", exact: true }).click();
      const editor = page.getByRole("dialog", { name: "添加媒体库", exact: true });
      await editor.getByLabel("库名", { exact: true }).fill(name);
      await editor.getByLabel("目录路径", { exact: true }).fill(root);
      await editor.getByRole("button", { name: "访问方式：本地目录", exact: true }).click();
      await editor.getByRole("group", { name: "访问方式选项" }).getByRole("button", { name: "挂载目录（rclone / 网络存储）", exact: true }).click();
      await editor.getByRole("checkbox", { name: /^允许存入下载作品/ }).check();
      await editor.getByRole("checkbox", { name: /^自动检查文件变化/ }).uncheck();
      const saved = page.waitForResponse(response => response.url().endsWith("/api/library/directories") && response.request().method() === "POST");
      await editor.getByRole("button", { name: "添加媒体库", exact: true }).click();
      id = (await (await saved).json()).id;
      await expect(editor).toHaveCount(0);
      const row = page.locator(".folio-library-directory").filter({ has: page.getByRole("heading", { name, exact: true }) });
      await page.getByRole("button", { name: /^默认下载到：/ }).click();
      await page.getByRole("group", { name: "默认下载到选项" }).getByRole("button", { name, exact: true }).click();
      await expect.poll(async () => (await (await request.get("/api/settings")).json()).downloads.default_library_id).toBe(id);
      await row.getByRole("button", { name: "暂停", exact: true }).click();
      await expect(page.locator(".folio-download-library")).toContainText("不会自动改存本地");
      expect((await (await request.get("/api/settings")).json()).downloads.default_library_id).toBe(id);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    } finally {
      await request.patch("/api/settings", { data: { downloads: original.downloads } });
      if (id) await request.delete(`/api/library/directories/${id}`);
    }
  });

  test(`${width}px 设置与文件健康指标打开具体筛选`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.goto("/#settings?section=storage");
    await page.getByRole("link", { name: "查看具体文件", exact: true }).click();
    await expect(page.getByRole("button", { name: "文件状态：缺失源", exact: true })).toBeVisible();
    await page.getByRole("button", { name: /^查看缺失封面 / }).click();
    await expect(page.getByRole("button", { name: "文件状态：缺失封面", exact: true })).toBeVisible();
    await expect(page).toHaveURL(/status=missing_cover/);
    await page.goto("/#settings?section=data");
    const missing = page.locator(".folio-settings-maintenance .folio-metric-card").filter({ hasText: "缺失源文件" });
    await missing.getByRole("link").click();
    await expect(page.getByRole("button", { name: "文件状态：缺失源", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("已移除库的保留记录可以查看和移除", async ({ page, request }) => {
  const libraries = await (await request.get("/api/library/directories?include_removed=true")).json();
  const library = libraries.result.find((item: { removed_at: string | null; item_count: number }) => item.removed_at && item.item_count > 0);
  expect(library).toBeDefined();
  const items = await (await request.get(`/api/library/directories/${library.id}/items`)).json();
  const workCount = (await (await request.get("/api/library/summary")).json()).total;
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.goto("/#files");
    const row = page.locator(".folio-library-directory").filter({ has: page.getByRole("heading", { name: library.name, exact: true }) });
    await expect(row).toContainText("已移除");
    await row.getByRole("button", { name: `${items.total} 条保留记录`, exact: true }).click();
    await expect(row.locator(".folio-library-issues li")).toHaveCount(items.total);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 390) {
      page.once("dialog", dialog => dialog.accept());
      await row.getByRole("button", { name: "移除保留记录", exact: true }).first().click();
      await expect.poll(async () => (await (await request.get(`/api/library/directories/${library.id}/items`)).json()).total).toBe(items.total - 1);
      if (items.total === 1) await expect(row).toHaveCount(0);
    }
  }
  expect((await (await request.get("/api/library/summary")).json()).total).toBe(workCount);
});
