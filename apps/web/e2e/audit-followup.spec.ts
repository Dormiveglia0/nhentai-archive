import { expect, test } from "@playwright/test";
import { parseUtcTimestamp, workTitle } from "../src/lib/format";
import { dateBucket, timeOfDay } from "../src/components/history/historyHelpers";

test.skip(!process.env.E2E_STORAGE_STATE, "需要隔离数据与真实会话");

test("UTC 时间按本地时区显示，保留显式时区并处理无效时间", () => {
  const previous = process.env.TZ;
  process.env.TZ = "Asia/Shanghai";
  try {
    for (const value of ["2026-06-20 16:30:00", "2026-06-20T16:30:00", "2026-06-21T00:30:00+08:00"]) {
      expect(parseUtcTimestamp(value)?.toISOString()).toBe("2026-06-20T16:30:00.000Z");
      expect(timeOfDay(value)).toBe("00:30");
    }
    expect(parseUtcTimestamp("invalid")).toBeNull();
    expect(parseUtcTimestamp(null)).toBeNull();
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    expect(dateBucket(today)).toBe("今天");
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

for (const width of [1440, 390, 320]) test(`${width}px 滚动后队列长短列表切换，逐帧保持高度且无纵向滑块溢出`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/#tasks");
  await expect(page.locator(".folio-tasks-row").first()).toBeVisible();
  for (const index of [1, 0, 6, 7, 0]) {
    await page.locator(".folio-scroll").evaluate(node => { node.scrollTop = 240; });
    const frames = await page.evaluate(async index => {
      const group = document.querySelector<HTMLElement>(".folio-tasks-tabs")!;
      const result: Array<{ height: number; overflow: number; y: number }> = [];
      const start = performance.now();
      function sample() {
        const rect = group.getBoundingClientRect();
        const indicator = group.querySelector(".folio-slide-indicator")!.getBoundingClientRect();
        result.push({ height: rect.height, overflow: group.scrollHeight - group.clientHeight, y: indicator.y - rect.y });
      }
      sample();
      group.querySelectorAll<HTMLButtonElement>("button")[index].click();
      await new Promise<void>(resolve => {
        function tick() { sample(); if (performance.now() - start < 800) requestAnimationFrame(tick); else resolve(); }
        requestAnimationFrame(tick);
      });
      return result;
    }, index);
    expect(frames.length).toBeGreaterThan(10);
    expect(frames.every(frame => Math.abs(frame.height - 52) < .1 && frame.overflow === 0 && Math.abs(frame.y - 1) < .5)).toBe(true);
  }
});

test("手机任务详情保留列表位置，原生弹窗可用键盘退出并恢复焦点", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#tasks");
  const entry = page.locator(".folio-tasks-row-main").first();
  await entry.scrollIntoViewIfNeeded();
  const before = await page.locator(".folio-scroll").evaluate(node => node.scrollTop);
  await entry.click();
  const dialog = page.getByRole("dialog", { name: "任务详情", exact: true });
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate(node => node.matches(":modal"))).toBe(true);
  expect(await page.locator(".folio-scroll").evaluate(node => node.scrollTop)).toBe(before);
  for (let index = 0; index < 12; index++) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate(node => document.activeElement === document.body || node.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(entry).toBeFocused();
  await entry.click();
  await dialog.getByRole("button", { name: "关闭任务详情", exact: true }).click();
  await expect(dialog).not.toBeVisible();
});

test("手机文件可连续多选，详情和删除预览均可取消且恢复入口", async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const total = (await (await request.get("/api/library/summary")).json()).total;
  await page.goto("/#files?view=files");
  await page.locator(".folio-files-select").nth(0).click();
  await page.locator(".folio-files-select").nth(1).click();
  await expect(page.locator(".folio-files-select[aria-pressed='true']")).toHaveCount(2);
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await page.getByRole("group", { name: "文件批量操作", exact: true }).getByRole("button", { name: "删除", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "确认删除", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  const entry = page.locator(".folio-files-row-main").first();
  await entry.click();
  const detail = page.getByRole("dialog", { name: "文件详情", exact: true });
  await expect(detail).toBeVisible();
  expect(await detail.evaluate(node => node.matches(":modal"))).toBe(true);
  await detail.evaluate(node => { node.scrollTop = node.scrollHeight; });
  await expect(detail.getByRole("button", { name: "关闭文件详情", exact: true })).toBeInViewport({ ratio: 1 });
  await page.keyboard.press("Escape");
  await expect(detail).toHaveCount(0);
  await expect(entry).toBeFocused();
  expect((await (await request.get("/api/library/summary")).json()).total).toBe(total);
});

test("手机从作品详情打开导出，预览对应作品并恢复入口", async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const { result } = await (await request.get("/api/library/search?per_page=1")).json();
  await page.goto(`/#export/${result[0].id}`);
  const dialog = page.getByRole("dialog", { name: "导出作品", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".folio-export-inspector-head-text > strong")).toHaveText(workTitle(result[0]));
  await expect(dialog.locator(".folio-export-summary-line")).toContainText("当前作品");
  await dialog.getByRole("button", { name: "关闭导出" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".folio-library-page")).toBeVisible();
});

test("批量导出保留外部选择，取消到零项后不下载预览作品", async ({ page, request }) => {
  const { result } = await (await request.get("/api/library/search?per_page=100&sort=recent_updated")).json();
  expect(result.length).toBeGreaterThanOrEqual(2);
  await page.goto("/#library");
  await page.getByRole("button", { name: "批量选择", exact: true }).click();
  const entries = page.locator(".folio-library-cover");
  await entries.nth(0).click(); await entries.nth(1).click();
  await page.getByRole("button", { name: "导出下载", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "导出作品", exact: true });
  await expect(dialog.getByRole("button", { name: "下载所选 2 项 (.zip)", exact: true })).toBeEnabled();
  await dialog.getByRole("button", { name: "关闭导出" }).click();
  await entries.nth(1).click();
  await page.getByRole("button", { name: "导出下载", exact: true }).click();
  await page.route("**/api/works/*/export/download*", route => route.abort());
  const download = page.waitForRequest(request => /\/api\/works\/\d+\/export\/download/.test(new URL(request.url()).pathname));
  await dialog.getByRole("button", { name: "下载此作品", exact: true }).click();
  expect(new URL((await download).url()).pathname).toBe(`/api/works/${result[0].id}/export/download`);
  await expect(dialog.getByRole("button", { name: "关闭导出" })).toBeEnabled();
  await dialog.getByRole("button", { name: "关闭导出" }).click();
  await entries.nth(0).click();
  await expect(page.getByRole("button", { name: "导出下载", exact: true })).toBeDisabled();
});

for (const width of [390, 320]) test(`${width}px 词典搜索与首个真实候选位于固定操作栏上方`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 740 });
  await page.goto("/#dictionary");
  const first = page.locator(".folio-dictionary-row").first();
  await expect(first).toBeVisible();
  const footer = page.locator(".folio-dictionary-actions");
  const search = page.getByRole("searchbox", { name: "搜索原文或中文词条", exact: true });
  const searchBox = (await search.boundingBox())!;
  expect(searchBox.y + searchBox.height).toBeLessThan((await footer.boundingBox())!.y);
  await expect.poll(async () => {
    const row = (await first.boundingBox())!, actions = (await footer.boundingBox())!;
    return row.y + row.height - actions.y;
  }).toBeLessThan(0);
  expect((await footer.boundingBox())!.height).toBeLessThanOrEqual(96);
  await first.click();
  await expect(first).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("heading", { name: "编辑词条", exact: true })).toBeInViewport({ ratio: 1 });
  await expect(page.getByLabel("原文 *", { exact: true })).toBeInViewport({ ratio: 1 });
  await page.locator(".folio-dictionary-filter-details > summary").click();
  await expect(page.locator(".folio-dictionary-filter-row")).toBeVisible();
  await expect(page.locator(".folio-dictionary-suggest")).toBeVisible();
});

test("桌面作品编辑将字段放在检查前，辅助翻译可展开且不抢占主编辑区", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/#governance/${process.env.E2E_WORK_ID ?? 113}`);
  const fields = page.locator(".folio-governance-fields");
  await expect(fields).toBeVisible();
  expect(await fields.evaluate(node => Boolean(node.compareDocumentPosition(document.querySelector(".folio-governance-review")!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  const subtitle = page.locator(".folio-governance-work-copy > p");
  if (await subtitle.count()) expect((await subtitle.textContent())!.trim()).not.toBe((await page.locator(".folio-governance-work-copy > h2").textContent())!.trim());
  const translation = page.locator(".folio-governance-translation");
  await expect(translation).not.toHaveAttribute("open", "");
  await expect(fields.getByRole("textbox").first()).toBeInViewport();
  const input = (await fields.getByRole("textbox").first().boundingBox())!;
  expect(input.y + input.height + 8).toBeLessThan((await page.locator(".folio-governance-actions").boundingBox())!.y);
  await translation.locator("summary").click();
  const choices = translation.getByRole("group", { name: "选择生成中文建议的字段", exact: true });
  for (const name of ["标题", "副标题", "简介"]) await choices.getByRole("button", { name, exact: true }).click();
  await expect(translation.getByRole("button", { name: "生成建议", exact: true })).toBeDisabled();
  await choices.getByRole("button", { name: "标题", exact: true }).click();
  await expect(translation.getByRole("button", { name: "生成建议", exact: true })).toBeEnabled();
  const passed = page.locator('.folio-governance-check-card[data-status="passed"]');
  for (let index = 0; index < await passed.count(); index++) expect((await passed.nth(index).boundingBox())!.height).toBeLessThanOrEqual(90);
});

test("手机单部编辑选作品后直接到编辑区，批量复选保持在列表", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#governance");
  const entry = page.locator(".folio-governance-queue-card-body").nth(1);
  await expect(entry).toBeVisible();
  await entry.click();
  await expect(page.locator(".folio-governance-work-copy > h2")).toBeInViewport();
  expect(await page.locator(".folio-scroll").evaluate(node => node.scrollTop)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "进入批量", exact: true }).click();
  const selection = page.locator(".folio-governance-queue-check input");
  await selection.nth(0).scrollIntoViewIfNeeded();
  const before = await page.locator(".folio-scroll").evaluate(node => node.scrollTop);
  await selection.nth(0).check();
  await selection.nth(1).check();
  await expect(page.locator(".folio-governance-queue-check input:checked")).toHaveCount(2);
  expect(await page.locator(".folio-scroll").evaluate(node => node.scrollTop)).toBe(before);
});

test("阅读器暂停后台无限装饰动画，返回后恢复页面", async ({ page }) => {
  await page.goto("/#library");
  const running = () => page.evaluate(() => document.getAnimations().filter(animation => animation.playState === "running" && animation.effect?.getTiming().iterations === Infinity && (animation.effect as KeyframeEffect).target?.closest(".app-route-archive")).length);
  await expect.poll(running).toBeGreaterThan(0);
  await page.locator(".folio-shelf-item").first().click();
  await expect(page.locator(".reader-counter")).toBeVisible();
  await expect.poll(running).toBe(0);
  await page.getByRole("button", { name: "返回我的库", exact: true }).click();
  await expect(page.locator(".folio-library-query")).toBeVisible();
  await expect.poll(running).toBeGreaterThan(0);
});
