import { expect, test } from "@playwright/test";

const WORK_ID = process.env.E2E_WORK_ID ?? "1";

test.beforeEach(async ({ page }) => {
  await page.goto(`/#reader/${WORK_ID}`);
  await page.mouse.move(10, 10); // 唤出 chrome
});

test("显示页码计数并能下一页", async ({ page }) => {
  const counter = page.locator(".reader-counter");
  await expect(counter).toContainText("/");
  const before = await counter.textContent();
  await page.getByRole("button", { name: "下一页" }).click();
  await expect(counter).not.toHaveText(before ?? "");
});

test("切换到连续滚动模式", async ({ page }) => {
  await page.getByRole("button", { name: "滚动阅读" }).click();
  await expect(page.locator(".reader-webtoon")).toBeVisible();
});

test("打开缩略图浮层并跳页", async ({ page }) => {
  await page.getByRole("button", { name: "缩略图" }).click();
  await expect(page.locator(".reader-thumb-field")).toBeVisible();
  await page.locator(".reader-thumb-tile").nth(2).click();
  await expect(page.locator(".reader-thumb-field")).toHaveCount(0);
  await page.mouse.move(20, 20);
  await expect(page.locator(".reader-counter")).toContainText("3 /");
});

test("打开信息面板含阅读设置", async ({ page }) => {
  await page.getByRole("button", { name: "信息" }).click();
  await expect(page.getByText("阅读设置")).toBeVisible();
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
  const input = page.locator(".reader-jump input");
  await expect(input).toBeVisible();
  await input.fill("3");
  await input.press("Enter");
  await expect(page.locator(".reader-jump")).toHaveCount(0);
  await page.mouse.move(20, 20);
  await expect(page.locator(".reader-counter")).toContainText("3 /");
});
