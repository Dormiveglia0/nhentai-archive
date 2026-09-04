import { expect, test } from "@playwright/test";

test("已登录刷新期间不挂载访问栏", async ({ page }) => {
  let releaseStatus!: () => void;
  const statusPending = new Promise<void>((resolve) => { releaseStatus = resolve; });
  await page.route("**/api/auth/status", async (route) => {
    await statusPending;
    await route.fulfill({ json: { configured: true, authenticated: true, session_days: 90 } });
  });

  await page.goto("/demo");
  await expect(page.locator(".auth-wake-access")).toHaveCount(0);
  await page.screenshot({ path: "/tmp/auth-refresh-pending.png", fullPage: true });
  releaseStatus();
  await expect(page.locator(".auth-wake-demo")).toHaveClass(/auth-wake-awake/);
});

test("界面唤醒完成首次密码设置与确认", async ({ page }) => {
  let submittedPassword = "";
  await page.route("**/api/auth/status", (route) => route.fulfill({
    json: { configured: false, authenticated: false, session_days: 90 },
  }));
  await page.route("**/api/auth/setup", async (route) => {
    submittedPassword = (route.request().postDataJSON() as { password: string }).password;
    await route.fulfill({ json: { configured: true, authenticated: true, session_days: 90 } });
  });

  await page.goto("/demo");
  const password = page.locator('input[type="password"]');
  await expect(password).toHaveAccessibleName("设置密码");
  await expect(password).toBeFocused();

  await page.getByRole("button", { name: "继续" }).click();
  await expect(page.getByRole("alert")).toHaveText("请设置访问密码");
  await password.fill("archive-check");
  await expect(password).toHaveValue("archive-check");
  await page.getByRole("button", { name: "继续" }).click();

  const confirmation = page.locator('input[type="password"]');
  await expect(confirmation).toHaveAccessibleName("再次输入");
  await expect(confirmation).toBeFocused();
  await confirmation.fill("archive-check");
  await page.getByRole("button", { name: "确认并进入" }).click();

  await expect.poll(() => submittedPassword).toBe("archive-check");
  await expect(page.locator(".auth-wake-demo")).toHaveClass(/auth-wake-awake/, { timeout: 4_000 });
});

test("真实登录失败后可直接修正并通过", async ({ page }) => {
  let attempts = 0;
  await page.route("**/api/auth/status", (route) => route.fulfill({
    json: { configured: true, authenticated: false, session_days: 90 },
  }));
  await page.route("**/api/auth/login", async (route) => {
    attempts += 1;
    if (attempts === 1) {
      await route.fulfill({ status: 401, json: { detail: "密码错误" } });
      return;
    }
    await route.fulfill({ json: { configured: true, authenticated: true, session_days: 90 } });
  });

  await page.goto("/demo");
  const password = page.getByRole("textbox", { name: "访问密码" });
  await password.fill("wrong");
  await page.getByRole("button", { name: "验证并进入" }).click();
  await expect(page.getByRole("alert")).toContainText("密码错误");

  await password.fill("correct");
  await password.press("Enter");
  await expect(page.locator(".auth-wake-demo")).toHaveClass(/auth-wake-awake/, { timeout: 4_000 });
  expect(attempts).toBe(2);
});

test("真实登录入口在手机视口完整显示", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/auth/status", (route) => route.fulfill({
    json: { configured: true, authenticated: false, session_days: 90 },
  }));

  await page.goto("/demo");
  await expect(page.getByRole("textbox", { name: "访问密码" })).toBeFocused();
  await expect(page.locator(".auth-wake-access")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "/tmp/auth-wake-production-mobile.png", fullPage: true });
});
