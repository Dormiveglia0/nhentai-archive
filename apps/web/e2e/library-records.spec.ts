import { mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { expect, test } from "@playwright/test";

const dataRoot = process.env.E2E_RECORDS_DATA_DIR ?? "";
test.skip(!/^\/tmp\/nh-(media|metadata)-audit-/.test(dataRoot) || !process.env.E2E_STORAGE_STATE,
  "需要隔离正式库副本与真实会话");

test.beforeEach(async ({ request }) => {
  const settings = await (await request.get("/api/settings")).json();
  expect(settings.storage.data_dir).toBe(dataRoot);
});

for (const width of [1440, 390]) {
  test(`${width}px 缺失计数进入元数据管理，导出、取消与清理保留原作品`, async ({ page, request }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const libraries = await (await request.get("/api/library/directories")).json();
    const library = libraries.result.find((item: { kind: string }) => item.kind === "managed");
    const before = await (await request.get(`/api/library/directories/${library.id}/items?status=missing`)).json();
    const item = before.result.find((item: { work_id: number | null }) => item.work_id === null);
    expect(item).toBeDefined();
    const works = await (await request.get("/api/library/summary")).json();
    await page.goto("/#files");
    const row = page.locator(".folio-library-directory").filter({ has: page.getByRole("heading", { name: library.name, exact: true }) });
    await row.getByRole("link", { name: `${before.total} 缺失 · 元数据`, exact: true }).click();
    await expect(page.getByRole("heading", { name: "本地元数据", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "元数据状态：源文件缺失", exact: true })).toBeVisible();
    const entry = page.locator(`[data-record="item-${item.id}"]`);
    await expect(entry).toContainText(item.title);
    await entry.getByRole("button", { name: "查看元数据", exact: true }).click();
    const detail = page.locator(".folio-metadata-dialog");
    await expect(detail.getByRole("heading", { name: "数据库内容", exact: true })).toBeVisible();
    await expect(detail.getByRole("heading", { name: "ComicInfo", exact: true })).toBeVisible();
    const download = page.waitForEvent("download");
    await detail.getByRole("button", { name: "导出 JSON", exact: true }).click();
    const exported = await download;
    expect(exported.suggestedFilename()).toBe(`metadata-item-${item.id}.json`);
    const data = JSON.parse(await readFile((await exported.path())!, "utf8"));
    expect(data.id).toBe(item.id);
    expect(data.archive_metadata.comicinfo.Title).toBe(item.metadata.Title);
    await detail.getByRole("button", { name: "预览元数据清理", exact: true }).click();
    const cleanup = page.getByRole("dialog", { name: "元数据清理预览", exact: true });
    await expect(cleanup).toContainText("源文件不删除 · 扫描日志不删除");
    await cleanup.getByRole("button", { name: "取消", exact: true }).click();
    await expect(cleanup).toHaveCount(0);
    expect((await (await request.get(`/api/library/directories/${library.id}/items?status=missing`)).json()).total).toBe(before.total);
    await detail.getByRole("button", { name: "预览元数据清理", exact: true }).click();
    await cleanup.getByRole("button", { name: "确认清理元数据", exact: true }).click();
    await expect(cleanup).toHaveCount(0);
    await expect(detail).toHaveCount(0);
    await expect(entry).toHaveCount(0);
    await expect(page.getByRole("status")).toContainText("源文件和扫描日志未删除");
    expect((await (await request.get(`/api/library/directories/${library.id}/items?status=missing`)).json()).total).toBe(before.total - 1);
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

test("320px 媒体库操作按钮不挤成竖排", async ({ page, request }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const libraries = await (await request.get("/api/library/directories")).json();
  const library = libraries.result.find((item: { kind: string }) => item.kind === "managed");
  await page.goto("/#files");
  const row = page.locator(".folio-library-directory").filter({ has: page.getByRole("heading", { name: library.name, exact: true }) });
  const buttons = row.locator(".folio-media-actions button");
  await expect(buttons).toHaveCount(4);
  for (const button of await buttons.all()) {
    const box = await button.boundingBox();
    expect(box?.height).toBeLessThanOrEqual(48);
    expect(box!.x + box!.width).toBeLessThanOrEqual(320);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("已移除库的保留资料进入独立元数据管理", async ({ page, request }) => {
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
    await row.getByRole("link", { name: `${items.total} 条保留资料`, exact: true }).click();
    await expect(page.locator(".folio-data-list > li")).toHaveCount(items.total);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 390) {
      await page.getByRole("button", { name: "查看元数据", exact: true }).first().click();
      await page.getByRole("button", { name: "预览元数据清理", exact: true }).click();
      await page.getByRole("button", { name: "确认清理元数据", exact: true }).click();
      await expect.poll(async () => (await (await request.get(`/api/library/directories/${library.id}/items`)).json()).total).toBe(items.total - 1);
      if (items.total === 1) await expect(page.getByText("没有符合筛选条件的元数据。可切换状态或媒体库查看其他资料。", { exact: true })).toBeVisible();
    }
  }
  expect((await (await request.get("/api/library/summary")).json()).total).toBe(workCount);
});

for (const width of [1440, 390, 320, 844]) {
  test(`${width}px 存储数值字号一致，链接无默认下划线，五个文件子页可用`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 844 ? 390 : 1000 });
    await page.goto("/#settings?section=storage");
    const grid = page.locator(".folio-settings-storage-grid");
    await expect(grid.locator(".folio-metric-card")).toHaveCount(6);
    const sizes = await grid.locator(".folio-metric-card-copy > strong").evaluateAll(elements => elements.map(element => getComputedStyle(element).fontSize));
    expect(new Set(sizes).size).toBe(1);
    const links = await grid.locator("a").evaluateAll(elements => elements.map(element => ({ decoration: getComputedStyle(element).textDecorationLine, color: getComputedStyle(element).color })));
    expect(links.every(link => link.decoration === "none" && link.color !== "rgb(0, 0, 238)")).toBe(true);
    await page.getByRole("link", { name: "管理元数据", exact: true }).click();
    await expect(page.getByRole("heading", { name: "本地元数据", exact: true })).toBeVisible();
    const tabs = page.getByRole("navigation", { name: "文件内容", exact: true });
    await expect(tabs.getByRole("button")).toHaveCount(5);
    await tabs.getByRole("button", { name: "派生文件", exact: true }).click();
    await expect(page.getByRole("heading", { name: "实际文件清单", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("派生文件可预览和单独清理，所属元数据仍在，当前封面受保护", async ({ page, request }) => {
  const before = await (await request.get("/api/files/derived?category=thumbnail&status=linked")).json();
  const file = before.result.find((item: { work_id: number | null }) => item.work_id);
  expect(file).toBeDefined();
  const detailBefore = await (await request.get(`/api/files/metadata/work/${file.work_id}`)).json();
  const allWorks = await (await request.get("/api/library/summary")).json();
  await page.goto(`/#files?view=derived&work_id=${file.work_id}&category=thumbnail`);
  const row = page.locator("[data-path]").filter({ hasText: file.name }).first();
  await row.getByRole("button", { name: "预览清理", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "确认删除", exact: true });
  await expect(dialog).toContainText("作品元数据和阅读进度均保留");
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "预览清理", exact: true }).click();
  await dialog.getByRole("button", { name: "确认删除", exact: true }).click();
  await expect(row).toHaveCount(0);
  expect((await (await request.get("/api/library/summary")).json()).total).toBe(allWorks.total);
  const detailAfter = await (await request.get(`/api/files/metadata/work/${file.work_id}`)).json();
  expect(detailAfter.record).toEqual(detailBefore.record);
  expect(detailAfter.fields).toEqual(detailBefore.fields);
  await page.goto(`/#files?view=derived&work_id=${file.work_id}&category=cover`);
  await expect(page.getByRole("button", { name: "预览清理", exact: true }).first()).toBeDisabled();
  await page.getByRole("link", { name: "查看所属资料", exact: true }).first().click();
  await expect(page).toHaveURL(new RegExp(`view=metadata&work_id=${file.work_id}`));
  await page.getByRole("button", { name: "查看元数据", exact: true }).click();
  const detail = page.locator(".folio-metadata-dialog");
  await expect(detail.getByRole("link", { name: "编辑作品资料", exact: true })).toHaveAttribute("href", `#governance/${file.work_id}`);
  await detail.getByRole("button", { name: "预览元数据清理", exact: true }).click();
  const cleanup = page.getByRole("dialog", { name: "元数据清理预览", exact: true });
  await expect(cleanup).toContainText("作品仍有可用");
  await expect(cleanup.getByRole("button", { name: "确认清理元数据", exact: true })).toBeDisabled();
  await cleanup.getByRole("button", { name: "取消", exact: true }).click();
  await detail.getByRole("button", { name: "关闭", exact: true }).click();
});
