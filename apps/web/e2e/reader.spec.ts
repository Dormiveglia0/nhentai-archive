import { expect, test } from "@playwright/test";

const WORK_ID = process.env.E2E_WORK_ID ?? "1";

test.beforeEach(async ({ page }) => {
  await page.goto(`/#reader/${WORK_ID}`);
  await expect(page.locator(".reader-counter")).toHaveText(/\d+\s*\/\s*\d+/);
});

test("显示页码计数并能下一页", async ({ page }) => {
  const counter = page.locator(".reader-counter");
  await expect(counter).toContainText("/");
  const before = await counter.textContent();
  await page.getByRole("button", { name: "下一页" }).click();
  await expect(counter).not.toHaveText(before ?? "");
});

test("切换到连续滚动模式", async ({ page }) => {
  if (!await page.locator(".reader-webtoon").count()) {
    await page.getByRole("button", { name: "单页", exact: true }).click();
  }
  await expect(page.locator(".reader-webtoon")).toBeVisible();
});

test("连续滚动触摸滑动不会唤出控制栏", async ({ page }) => {
  if (!await page.locator(".reader-webtoon").count()) {
    await page.getByRole("button", { name: "单页", exact: true }).click();
  }
  const webtoon = page.locator(".reader-webtoon");
  await expect(webtoon).toBeVisible();
  await webtoon.click({ position: { x: 195, y: 500 } });
  await expect(page.locator(".reader-toolbar")).toHaveCount(0);

  await webtoon.dispatchEvent("pointerdown", {
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
    clientX: 195,
    clientY: 650,
  });
  await page.locator(".reader-viewport").evaluate((node) => {
    node.scrollTop += 420;
    node.dispatchEvent(new Event("scroll", { bubbles: true }));
  });

  await expect(page.locator(".reader-toolbar")).toHaveCount(0);
  await expect(page.locator(".reader-scrubber")).toHaveCount(0);
});

test("单页模式移动鼠标和侧边翻页不唤出控制栏，只有中间点击会显示", async ({ page }) => {
  if (await page.locator(".reader-webtoon").count()) {
    await page.getByRole("button", { name: /连续/ }).click();
  }
  await page.mouse.move(720, 500);
  await page.waitForTimeout(2700);
  await expect(page.locator(".reader-toolbar")).toHaveCount(0);

  await page.mouse.move(120, 500);
  await page.waitForTimeout(250);
  await expect(page.locator(".reader-toolbar")).toHaveCount(0);

  await page.locator(".reader-zone-left").click({ position: { x: 20, y: 300 } });
  await expect(page.locator(".reader-toolbar")).toHaveCount(0);
  await page.locator(".reader-zone-center").click({ position: { x: 20, y: 300 } });
  await expect(page.locator(".reader-toolbar")).toBeVisible();
  await expect(page.getByRole("button", { name: "隐私遮罩" })).toHaveCount(0);
});

test("打开和退出阅读器都有可见的擦页转场", async ({ page }) => {
  await page.goto("/#workbench");
  await page.evaluate(() => { window.location.hash = "library"; });
  await expect(page.locator(".folio-library-page")).toBeVisible();
  await page.locator(".folio-library-read-action").first().click();
  await expect(page.locator(".reader-shell")).toBeVisible();
  await revealChrome(page);
  await page.getByRole("button", { name: "返回我的库" }).click();
  expect(hasIntermediateClip(await sampleReaderClip(page))).toBeTruthy();
  await expect(page.locator(".folio-library-page")).toBeVisible();

  await page.goBack();
  await expect(page.locator(".folio-workbench-page")).toBeVisible();

  await page.evaluate((workId) => { window.location.hash = `reader/${workId}`; }, WORK_ID);
  expect(hasIntermediateClip(await sampleReaderClip(page))).toBeTruthy();
  await expect(page.locator(".reader-shell")).toBeVisible();
});

test("任一失败图片会批量重试当前所有失败页", async ({ page }) => {
  const attempts = new Map<string, number>();
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  await page.route(new RegExp(`/api/works/${WORK_ID}/pages/\\d+$`), async (route) => {
    const path = new URL(route.request().url()).pathname;
    const pageIndex = Number(path.split("/").at(-1));
    if (pageIndex > 2) {
      await route.continue();
      return;
    }
    const attempt = (attempts.get(path) ?? 0) + 1;
    attempts.set(path, attempt);
    if (attempt === 1) await route.fulfill({ status: 503, body: "retry" });
    else await route.fulfill({ status: 200, contentType: "image/png", body: png });
  });
  await page.request.patch(`/api/works/${WORK_ID}/reader-state`, { data: { page_index: 1, completed: false } });
  await page.reload();
  await expect(page.locator(".reader-viewport")).toBeVisible();
  await expect.poll(() => page.locator(".reader-webtoon, .reader-single").count()).toBeGreaterThan(0);
  if (!await page.locator(".reader-webtoon").count()) {
    await revealChrome(page);
    await page.getByRole("button", { name: "单页", exact: true }).click();
  }

  await expect.poll(() => page.locator(".reader-img-error").count()).toBeGreaterThanOrEqual(2);
  const failedPaths = await page.locator(".reader-img-error").evaluateAll((items, workId) => items.map((item) => `/api/works/${workId}/pages/${item.getAttribute("data-page-index")}`), WORK_ID);
  await page.getByRole("button", { name: "重试全部" }).first().click();
  await expect.poll(() => failedPaths.every((path) => (attempts.get(path) ?? 0) >= 2)).toBeTruthy();
  await expect(page.locator(".reader-img-error")).toHaveCount(0);
});

test("标签结果分页保留浏览器返回历史", async ({ page }) => {
  await page.getByRole("button", { name: "作品信息" }).click();
  const tag = page.locator(".reader-info-tag-groups a").first();
  await expect(tag).toBeVisible();
  const readerUrl = page.url();
  await tag.click();

  const discover = page.locator(".folio-discover-page");
  await expect(discover.getByRole("button", { name: "下一页" })).toBeEnabled();
  await expect(page).toHaveURL(/[#&?]page=1(?:&|$)/);
  const next = discover.getByRole("button", { name: "下一页" });
  await expect(next).toBeVisible();
  const pageOneUrl = page.url();
  await next.click();
  await expect(page).toHaveURL(/[#&?]page=2(?:&|$)/);
  await expect(page.locator(".folio-discover-results")).not.toHaveClass(/is-loading/);
  await expect.poll(() => page.evaluate(() => {
    const scroll = document.querySelector<HTMLElement>(".folio-scroll")!;
    const feed = document.querySelector<HTMLElement>(".folio-discover-feed")!;
    return Math.abs(feed.getBoundingClientRect().top - scroll.getBoundingClientRect().top);
  })).toBeLessThanOrEqual(2);

  await page.goBack();
  await expect(page).toHaveURL(pageOneUrl);
  await expect(page.locator(".folio-discover-page")).toBeVisible();
  await expect(next).toBeInViewport();

  await page.goBack();
  await expect(page).toHaveURL(readerUrl);
  await expect(page.locator(".reader-shell")).toBeVisible();
});

test("打开缩略图浮层并跳页", async ({ page }) => {
  await page.getByRole("button", { name: "页面索引" }).click();
  await expect(page.locator(".reader-thumb-field")).toBeVisible();
  await page.locator(".reader-thumb-tile").nth(2).click();
  await expect(page.locator(".reader-thumb-field")).toHaveCount(0);
  await revealChrome(page);
  await expect(page.locator(".reader-counter")).toContainText("3 /");
});

test("打开作品信息面板", async ({ page }) => {
  await page.getByRole("button", { name: "作品信息" }).click();
  await expect(page.getByText("本地阅读进度")).toBeVisible();
});

test("底部进度条点击跳页", async ({ page }) => {
  const track = page.locator(".reader-scrubber-track");
  const box = await track.boundingBox();
  if (!box) throw new Error("scrubber track not found");
  await track.click({ position: { x: box.width - 2, y: box.height / 2 } });
  await revealChrome(page);
  const counter = page.locator(".reader-counter");
  const text = (await counter.textContent()) ?? "";
  const [current, total] = text.split("/").map((part) => Number(part.trim()));
  expect(current).toBe(total);
});

test("g 键数字跳页", async ({ page }) => {
  await page.keyboard.press("g");
  const input = page.getByRole("textbox", { name: "目标页码" });
  await expect(input).toBeVisible();
  await input.fill("3");
  await input.press("Enter");
  await expect(page.locator(".reader-jump")).toHaveCount(0);
  await revealChrome(page);
  await expect(page.locator(".reader-counter")).toContainText("3 /");
});

async function revealChrome(page: import("@playwright/test").Page) {
  if (await page.locator(".reader-toolbar").count()) return;
  if (await page.locator(".reader-webtoon").count()) {
    await page.locator(".reader-webtoon").click({ position: { x: 40, y: 120 } });
  } else {
    await page.locator(".reader-zone-center").click({ position: { x: 20, y: 300 } });
  }
  await expect(page.locator(".reader-toolbar")).toBeVisible();
}

async function sampleReaderClip(page: import("@playwright/test").Page) {
  return page.evaluate(async () => {
    const values: string[] = [];
    for (let index = 0; index < 36; index += 1) {
      const route = document.querySelector<HTMLElement>(".app-route-reader");
      if (route) values.push(getComputedStyle(route).clipPath);
      await new Promise(requestAnimationFrame);
    }
    return values;
  });
}

function hasIntermediateClip(values: string[]) {
  return values.some((value) => (value.match(/-?[\d.]+/g) ?? []).some((number) => Number(number) > 1 && Number(number) < 99));
}
