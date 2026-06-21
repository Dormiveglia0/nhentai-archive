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
  await page.getByRole("button", { name: "连续滚动模式" }).click();
  await expect(page.locator(".reader-webtoon")).toBeVisible();
});

test("打开缩略图面板并跳页", async ({ page }) => {
  await page.getByRole("button", { name: "缩略图" }).click();
  await expect(page.locator(".reader-thumbs")).toBeVisible();
  await page.locator(".reader-thumbs-grid button").nth(2).click();
  await expect(page.locator(".reader-counter")).toContainText("3 /");
});

test("打开信息面板含阅读设置", async ({ page }) => {
  await page.getByRole("button", { name: "信息" }).click();
  await expect(page.getByText("阅读设置")).toBeVisible();
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
