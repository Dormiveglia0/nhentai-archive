import { expect, test } from "@playwright/test";

test.use({ storageState: process.env.E2E_STORAGE_STATE });

test("首页日期切片、快速切换和键盘读数对应真实统计", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const statisticsResponse = page.waitForResponse(response => response.url().includes("/api/library/statistics") && response.ok());
  await page.goto("/#workbench");
  const response = await statisticsResponse;
  const statistics = await response.json();
  const activity = statistics.activity;
  await expect(page.locator(".reading-slice")).toHaveCount(activity.length);
  const slider = page.getByRole("slider", { name: /选择日期/ });
  await slider.focus();
  await page.keyboard.press("Home");
  await expect(slider).toHaveValue("0");
  await expect(page.locator(".reading-day-date strong")).toHaveText(activity[0].date.slice(5).replace("-", " / "));
  await expect(page.locator(".reading-day-duration strong")).toHaveText(String(Math.round(activity[0].seconds / 60)));
  for (let i = 0; i < 12; i++) await page.keyboard.press("ArrowRight");
  await expect(slider).toHaveValue("12");
  await expect(page.locator(".reading-slice.is-selected")).toHaveAttribute("data-date", activity[12].date);
  await page.keyboard.press("End");
  await page.getByRole("button", { name: "前一天", exact: true }).click();
  await expect(slider).toHaveValue(String(activity.length - 2));
  await expect(page.locator(".reading-day-duration strong")).toHaveText(String(Math.round(activity[activity.length - 2].seconds / 60)));
  await page.getByRole("button", { name: "暂停动效" }).click();
  await expect(page.locator(".reading-home")).toHaveClass(/is-still/);
  const link = page.locator(".reading-recent a").first();
  await expect(link).toHaveAttribute("href", /^#reader\//);
});

test("连续切页和长页面滚动不移动顶栏，手机导航保留键盘隔离", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/#workbench");
  for (const name of ["我的库", "设置", "队列", "我的库"]) {
    await page.locator(".folio-topnav").getByRole("link", { name, exact: true }).click();
  }
  await page.locator(".folio-scroll").evaluate(node => { node.scrollTop = node.scrollHeight; });
  await expect.poll(async () => (await page.locator(".folio-topbar").boundingBox())!.y).toBe(0);
  await expect(page.locator(".folio-scroll")).toHaveCSS("transform", "none");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "打开导航" }).click();
  await expect(page.locator(".folio-scroll")).toHaveJSProperty("inert", true);
  await page.locator(".folio-mobile-nav").getByRole("link", { name: "首页", exact: true }).click();
  await expect(page.locator(".reading-home")).toBeVisible();
  await expect(page.locator(".folio-scroll")).toHaveJSProperty("inert", false);
  expect(await page.locator(".reading-home").evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
});
