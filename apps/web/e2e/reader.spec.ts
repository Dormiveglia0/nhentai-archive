import { expect, test } from "@playwright/test";

const WORK_ID = process.env.E2E_WORK_ID ?? "1";

test.beforeEach(async ({ page }) => {
  await page.goto(`/#reader/${WORK_ID}`);
  await page.mouse.move(10, 10); // 唤出 chrome
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
  await page.getByRole("button", { name: "单页", exact: true }).click();
  await expect(page.locator(".reader-webtoon")).toBeVisible();
});

test("连续滚动触摸滑动不会唤出控制栏", async ({ page }) => {
  await page.getByRole("button", { name: "单页", exact: true }).click();
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

test("标签结果分页保留浏览器返回历史", async ({ page }) => {
  await page.getByRole("button", { name: "作品信息" }).click();
  const tag = page.locator(".reader-info-tag-groups a").first();
  await expect(tag).toBeVisible();
  const readerUrl = page.url();
  await tag.click();

  const next = page.getByRole("button", { name: "下一页" });
  await expect(next).toBeEnabled();
  await expect(page).toHaveURL(/[#&?]page=1(?:&|$)/);
  await next.scrollIntoViewIfNeeded();
  const pageOneUrl = page.url();
  await next.click();
  await expect(page).toHaveURL(/[#&?]page=2(?:&|$)/);

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
  await page.mouse.move(20, 20);
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
  await page.mouse.move(20, 20);
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
  await page.mouse.move(20, 20);
  await expect(page.locator(".reader-counter")).toContainText("3 /");
});
