import { expect, test } from "@playwright/test";

test.skip(!process.env.E2E_STORAGE_STATE, "需要隔离数据与测试会话");

for (const width of [1440, 390, 320]) {
  test(`${width}px 作品详情弹窗隔离焦点，关闭后恢复入口，阅读时释放遮罩`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.goto("/#library");
    const entry = page.locator(".folio-library-card-title").first();
    await expect(entry).toBeVisible();
    await entry.focus();
    await entry.click();
    const dialog = page.locator(".folio-work-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveCSS("transform", "none");
    expect(await dialog.evaluate(node => node.matches(":modal"))).toBe(true);
    const tools = await dialog.locator(".folio-work-detail-tools > :is(button, a)").evaluateAll(nodes => nodes.map(node => {
      const rect = node.getBoundingClientRect();
      return { y: rect.y, width: rect.width, height: rect.height, text: node.textContent?.trim() };
    }));
    expect(tools.map(item => item.text)).toEqual(["编辑", "导出", "删除"]);
    expect(new Set(tools.map(item => Math.round(item.y))).size).toBe(1);
    expect(Math.max(...tools.map(item => item.width)) - Math.min(...tools.map(item => item.width))).toBeLessThan(1);
    expect(tools.every(item => item.height >= 44)).toBe(true);
    for (let index = 0; index < 24; index++) {
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate(node => document.activeElement === document.body || node.contains(document.activeElement))).toBe(true);
    }
    expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(entry).toBeFocused();

    await entry.click();
    await expect(dialog).toBeVisible();
    await page.mouse.click(2, 2);
    await expect(dialog).toHaveCount(0);

    await entry.click();
    await dialog.locator(".folio-work-detail-actions a.is-primary").click();
    await expect(page.locator(".reader-shell")).toBeVisible();
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await expect(page.locator(".reader-toolbar")).toBeVisible();
  });

  test(`${width}px 过长语言标签省略且不改变作品卡片高度`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/#discover");
    const card = page.locator(".folio-discover-card").first();
    await expect(card).toBeVisible({ timeout: 20_000 });
    const language = card.locator(".folio-discover-card-meta em");
    await expect(language).toHaveAttribute("title", /.+/);
    const before = (await card.boundingBox())!.height;
    await language.evaluate(node => { node.textContent = (node.textContent ?? "").repeat(80); });
    await expect(language).toHaveCSS("text-overflow", "ellipsis");
    await expect(language).toHaveCSS("white-space", "nowrap");
    expect(await language.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(true);
    expect(Math.abs((await card.boundingBox())!.height - before)).toBeLessThan(1);
  });

  test(`${width}px 多标签在固定搜索栏内滚动，不增高或挤走搜索`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/#library");
    const input = page.locator(".folio-library-search-field");
    const search = page.getByRole("button", { name: "搜索", exact: true });
    await expect(input).toBeVisible();
    const query = page.locator(".folio-library-query");
    const before = (await query.boundingBox())!;
    const searchBefore = (await search.boundingBox())!;
    const add = page.locator(".folio-library-tag-filter > button");
    await add.click();
    for (let index = 0; index < 10; index++) {
      const candidate = page.locator(".folio-library-tag-options a:not(.is-active)").first();
      await expect(candidate).toBeVisible();
      await candidate.click();
    }
    await page.getByRole("searchbox", { name: "搜索作品", exact: true }).click();
    await expect(page.locator(".folio-library-tag-panel")).toHaveCount(0);
    expect((await query.boundingBox())!.height).toBe(before.height);
    const searchAfter = (await search.boundingBox())!;
    expect(searchAfter.x).toBe(searchBefore.x);
    expect(searchAfter.width).toBe(searchBefore.width);
    const addBox = (await add.boundingBox())!;
    expect(addBox.x + addBox.width).toBeLessThanOrEqual(searchAfter.x);
    expect(addBox.y).toBe(searchAfter.y);
    await expect(add.locator("strong")).toHaveText("标签 10");
    expect(await add.locator("strong").evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    await expect(page.getByRole("button", { name: "清空标签", exact: true })).toHaveText("");
    const chips = (await page.locator(".folio-library-tag-selection").boundingBox())!;
    expect(chips.y).toBe(searchAfter.y);
    expect(chips.x + chips.width).toBeLessThanOrEqual(searchAfter.x + 1);
    expect(await page.locator(".folio-library-tag-chips").evaluate(node => node.scrollWidth > node.clientWidth)).toBe(true);
    expect(await query.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    if (width <= 390) {
      expect((await input.boundingBox())!.width).toBe(before.width);
      expect((await page.locator(".folio-library-filters").boundingBox())!.width).toBe(before.width);
      await expect(page.locator(".folio-library-filters")).not.toHaveAttribute("open", "");
      await page.locator(".folio-library-filters > summary").click();
      await expect(page.locator(".folio-library-filter-row")).toBeVisible();
    }
  });
}

test("顶部、设置和队列只更新目标状态，队列保持直角线条", async ({ page }) => {
  await page.addInitScript(() => {
    const updates: Array<{ scope?: string; page?: string; settings?: string; tasks?: string }> = [];
    Object.assign(window, { slideUpdates: updates });
    const start = document.startViewTransition.bind(document);
    document.startViewTransition = callback => start(async () => {
      if (typeof callback === "function") await callback();
      updates.push({
        scope: document.documentElement.dataset.folioSlide,
        page: document.querySelector(".folio-app")?.className,
        settings: document.querySelector(".folio-settings-nav button[aria-current='page'] strong")?.textContent ?? undefined,
        tasks: document.querySelector(".folio-tasks-tabs button[aria-pressed='true'] > span:last-of-type")?.textContent ?? undefined,
      });
    });
  });
  await page.goto("/#workbench");
  await page.locator(".folio-topnav a[href='#discover']").click();
  await expect(page.locator(".folio-app")).toHaveClass(/folio-page-discover/);
  let updates = await page.evaluate(() => (window as unknown as { slideUpdates: Array<{ scope: string; page: string; settings: string; tasks: string }> }).slideUpdates);
  expect(updates.filter(item => item.scope === "page").map(item => item.page.match(/folio-page-(\w+)/)?.[1])).toEqual(["discover"]);

  await page.goto("/#settings");
  await page.locator(".folio-settings-nav").getByRole("button", { name: "访问与阅读", exact: true }).click();
  await expect(page.locator(".folio-settings-nav button[aria-current='page'] strong")).toHaveText("访问与阅读");
  updates = await page.evaluate(() => (window as unknown as { slideUpdates: typeof updates }).slideUpdates);
  expect(updates.filter(item => item.scope === "settings").map(item => item.settings)).toEqual(["访问与阅读"]);

  await page.goto("/#tasks");
  const tabs = page.locator(".folio-tasks-tabs");
  await tabs.getByRole("button", { name: /^已暂停/ }).click();
  await expect(tabs.getByRole("button", { name: /^已暂停/ })).toHaveAttribute("aria-pressed", "true");
  updates = await page.evaluate(() => (window as unknown as { slideUpdates: typeof updates }).slideUpdates);
  expect(updates.filter(item => item.scope === "tasks").map(item => item.tasks)).toEqual(["已暂停"]);
  await expect(tabs).toHaveCSS("border-radius", "0px");
  await expect(tabs.locator("button").first()).toHaveCSS("border-radius", "0px");

  await page.goto("/demo");
  await page.locator(".folio-topnav a[href='#tasks']").click();
  await expect(page.locator(".folio-app")).toHaveClass(/folio-page-tasks/);
  await page.locator(".folio-topnav a[href='#dictionary']").evaluate((link: HTMLAnchorElement) => link.click());
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.folioSlide)).toBeUndefined();
  await expect(page.locator(".folio-app")).toHaveClass(/folio-page-dictionary/);
});

test("移动端阅读控件覆盖图片且不改变图片尺寸，进度与设置可用", async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const payload = await (await request.get("/api/library/search?per_page=1")).json();
  const work = payload.result[0];
  expect(work).toBeTruthy();
  await request.patch(`/api/works/${work.id}/reader-state`, { data: { page_index: 1, completed: false } });
  await page.goto(`/#reader/${work.id}`);
  await expect(page.locator(".reader-counter")).toBeVisible();
  await expect(page.locator(".reader-single, .reader-webtoon")).toBeVisible();
  await page.getByRole("button", { name: "阅读设置", exact: true }).click();
  const options = page.locator(".reader-display-options");
  await expect(options).toBeVisible();
  await options.getByRole("button", { name: "单页", exact: true }).click();
  const fit = options.locator(".reader-option-row").filter({ hasText: "页面适配" }).getByRole("button");
  for (let index = 0; index < 3 && await fit.textContent() !== "适配高度"; index++) await fit.click();
  await expect(fit).toHaveText("适配高度");
  await page.keyboard.press("Escape");
  await expect(options).not.toBeVisible();
  await expect.poll(() => page.locator(".reader-single-img").evaluate((image: HTMLImageElement) => image.naturalHeight > 0)).toBe(true);
  const image = (await page.locator(".reader-single-img").boundingBox())!;
  const viewport = (await page.locator(".reader-viewport").boundingBox())!;
  expect(viewport.y).toBe(0);
  expect(viewport.height).toBe(844);
  await page.locator(".reader-zone-center").click({ position: { x: 10, y: 300 } });
  await expect(page.locator(".reader-toolbar")).toHaveCount(0);
  const hidden = (await page.locator(".reader-single-img").boundingBox())!;
  expect(hidden).toEqual(image);
  await page.locator(".reader-zone-center").click({ position: { x: 10, y: 300 } });
  const track = page.getByRole("slider", { name: "阅读进度" });
  await track.focus();
  await page.keyboard.press("Home");
  await expect(page.locator(".reader-counter")).toHaveText(/^1\s*\//);
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".reader-counter")).toHaveText(/^2\s*\//);
});

test("切页有完整进出动画，快速切换与减少动态效果均到达最后页面", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/demo");
  await page.locator(".folio-topnav a[href='#library']").click();
  await expect.poll(() => page.evaluate(() => document.getAnimations().some(animation => "animationName" in animation && animation.animationName === "folio-page-arrive"))).toBe(true);
  await page.evaluate(() => {
    for (const name of ["tasks", "discover", "settings"]) document.querySelector<HTMLAnchorElement>(`.folio-topnav a[href='#${name}']`)?.click();
  });
  await expect(page.locator(".folio-page-settings")).toBeVisible();
  await expect(page.locator(".folio-panel-heading p")).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator(".folio-topnav a[href='#dictionary']").click();
  await expect(page.locator(".folio-page-dictionary")).toBeVisible();
  expect(errors).toEqual([]);
});

test("任务按状态分组，作品标题可搜索，选择任务同步日志详情", async ({ page, request }) => {
  const payload = await (await request.get("/api/jobs")).json();
  const job = payload.result.find((entry: { meta?: { title?: string } }) => entry.meta?.title);
  expect(job).toBeTruthy();
  await page.goto("/#tasks");
  const search = page.getByRole("searchbox", { name: "搜索任务、编号或错误" });
  await search.fill(job.meta.title);
  const entry = page.locator(`.folio-tasks-row-main[aria-label^='查看任务 ${job.id}：']`);
  await expect(entry).toBeVisible();
  await entry.click();
  await expect(page.locator(".folio-tasks-inspector-head > strong")).toHaveText(`#${job.id}`);
  await expect(page.locator(".folio-tasks-log-section")).toBeVisible();
  await search.fill("");
  await page.locator(".folio-tasks-tabs").getByRole("button", { name: /^已完成/ }).click();
  await expect(page.locator(".folio-tasks-tabs").getByRole("button", { name: /^已完成/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".folio-tasks-row").first()).toHaveAttribute("data-status", "completed");
  await expect(page.locator(".folio-tasks-row:not([data-status='completed'])")).toHaveCount(0);
});

test("切页动画尚未完成时打开阅读器，旧页面回调不会覆盖阅读器", async ({ page, request }) => {
  const payload = await (await request.get("/api/library/search?per_page=1")).json();
  await page.goto("/#library");
  await expect(page.locator(".folio-library-card-title").first()).toBeVisible();
  await page.evaluate(() => {
    const original = document.startViewTransition.bind(document);
    let release: () => void = () => undefined;
    const pending = new Promise<void>(resolve => { release = resolve; });
    Object.assign(window, { releasePageTransition: release, pageTransitionStarted: false, pageTransitionApplied: false });
    document.startViewTransition = callback => original(async () => {
      Object.assign(window, { pageTransitionStarted: true });
      await pending;
      if (typeof callback === "function") await callback();
      Object.assign(window, { pageTransitionApplied: true });
    });
  });
  await page.locator(".folio-topnav a[href='#tasks']").click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { pageTransitionStarted: boolean }).pageTransitionStarted)).toBe(true);
  await page.evaluate(id => { window.location.hash = `reader/${id}`; }, payload.result[0].id);
  await expect(page.locator(".reader-shell")).toBeVisible();
  await page.evaluate(() => (window as unknown as { releasePageTransition: () => void }).releasePageTransition());
  await expect.poll(() => page.evaluate(() => (window as unknown as { pageTransitionApplied: boolean }).pageTransitionApplied)).toBe(true);
  await expect(page.locator(".reader-counter")).toBeVisible();
});

test("读取默认模式不会覆盖用户刚选择的阅读模式", async ({ page, request }) => {
  const payload = await (await request.get("/api/library/search?per_page=1")).json();
  const settings = await (await request.get("/api/settings")).json();
  const chosen = settings.reader.default_mode === "scroll" ? "单页" : "连续";
  let release: () => void = () => undefined;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/settings", async route => {
    const response = await route.fetch();
    await pending;
    await route.fulfill({ response });
  });
  await page.goto(`/#reader/${payload.result[0].id}`);
  await page.getByRole("button", { name: "阅读设置", exact: true }).click();
  const mode = page.locator(".reader-display-options").getByRole("button", { name: chosen, exact: true });
  await mode.click();
  await expect(mode).toHaveAttribute("aria-pressed", "true");
  release();
  await page.waitForResponse(response => new URL(response.url()).pathname === "/api/settings");
  await expect(mode).toHaveAttribute("aria-pressed", "true");
});
