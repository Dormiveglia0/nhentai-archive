import { expect, test } from "@playwright/test";

test("界面唤醒演示覆盖输入、错误与成功转场", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/auth-concept");

  const input = page.getByLabel("访问密码", { exact: true });
  await expect(input).toBeFocused();
  await expect(page.locator(".auth-wake-demo")).toHaveCSS("cursor", "default");
  await page.screenshot({ path: "/tmp/auth-wake-desktop-idle.png", fullPage: true });

  await input.fill("archive");
  await page.screenshot({ path: "/tmp/auth-wake-desktop-filled.png", fullPage: true });
  await input.fill("");

  await input.fill("wrong");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByRole("alert")).toHaveText("演示密码不匹配，请重新输入。");
  await page.screenshot({ path: "/tmp/auth-wake-desktop-error.png", fullPage: true });

  await input.fill("archive");
  await page.getByRole("button", { name: "显示密码" }).click();
  await expect(input).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.locator(".auth-wake-demo")).toHaveClass(/auth-wake-awake/, { timeout: 4_000 });
  await expect(page.getByRole("heading", { name: "工作台" })).toBeVisible();
  await page.waitForTimeout(900);
  await page.screenshot({ path: "/tmp/auth-wake-desktop-awake.png", fullPage: true });

  await page.getByRole("button", { name: "锁定" }).click();
  await expect(input).toBeFocused();
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByRole("alert")).toHaveText("请输入访问密码");
  await page.getByLabel("访问密码", { exact: true }).fill("archive");
  await page.getByLabel("访问密码", { exact: true }).press("Enter");
  await expect(page.locator(".auth-wake-demo")).toHaveClass(/auth-wake-awake/, { timeout: 4_000 });
  expect(consoleErrors).toEqual([]);
});

test("界面唤醒演示在手机与低高度视口保持完整", async ({ page }) => {
  for (const viewport of [
    { width: 390, height: 844, name: "mobile" },
    { width: 932, height: 430, name: "landscape" },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/auth-concept");
    const access = page.locator(".auth-wake-access");
    await expect(access).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    const box = await access.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);

    await page.getByLabel("访问密码", { exact: true }).fill("archive");
    await page.getByRole("button", { name: "登录" }).click();
    await expect(page.locator(".auth-wake-demo")).toHaveClass(/auth-wake-awake/, { timeout: 4_000 });
    await page.waitForTimeout(900);
    await page.screenshot({ path: `/tmp/auth-wake-${viewport.name}-awake.png`, fullPage: true });
  }
});

test("界面唤醒演示尊重减少动态效果设置", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 834, height: 1194 });
  await page.goto("/auth-concept");
  await page.getByLabel("访问密码", { exact: true }).fill("archive");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.locator(".auth-wake-demo")).toHaveClass(/auth-wake-awake/);
  await expect(page.getByRole("heading", { name: "工作台" })).toBeVisible();
});
