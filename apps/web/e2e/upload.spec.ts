import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.skip(!process.env.E2E_UPLOAD_ARCHIVE, "需要隔离副本中的真实 CBZ");
for (const width of [1440, 1365, 390, 320]) {
  test(`网页上传 ZIP 与手动整理 ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1365 ? 768 : width < 400 ? 844 : 1000 });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("/#library");
    const trigger = page.getByRole("button", { name: "上传", exact: true });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "上传作品" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("checkbox", { name: /自动刮削/ }).uncheck();
    await dialog.getByLabel("选择归档文件").setInputFiles({ name: "upload-check.zip", mimeType: "application/zip", buffer: await readFile(process.env.E2E_UPLOAD_ARCHIVE!) });
    if (process.env.E2E_FILE_ARTIFACT_DIR) await page.screenshot({ path: `${process.env.E2E_FILE_ARTIFACT_DIR}/upload-${width}.png` });
    const response = page.waitForResponse(response => response.url().includes("/api/library/upload") && response.request().method() === "POST");
    await dialog.getByRole("button", { name: "上传", exact: true }).click();
    expect((await response).status()).toBe(201);
    await expect(dialog.getByText("已导入 upload-check.cbz")).toBeVisible();
    await expect(dialog.getByRole("textbox", { name: "标题", exact: true })).not.toBeEmpty();
    await dialog.getByRole("button", { name: "保存元数据" }).click();
    await expect(dialog.getByRole("status")).toHaveText("元数据已保存");
    await dialog.getByRole("button", { name: "远端匹配" }).click();
    await expect(dialog.getByRole("textbox", { name: "作品名称或 ID" })).toBeVisible();
    await dialog.getByRole("textbox", { name: "作品名称或 ID" }).fill("1");
    await expect(dialog.getByRole("button", { name: "搜索", exact: true })).toBeEnabled();
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (process.env.E2E_FILE_ARTIFACT_DIR) await page.screenshot({ path: `${process.env.E2E_FILE_ARTIFACT_DIR}/upload-metadata-${width}.png` });
    await dialog.getByRole("button", { name: "完成", exact: true }).click();
    await expect(trigger).toBeFocused();
    expect(errors).toEqual([]);
  });
}
