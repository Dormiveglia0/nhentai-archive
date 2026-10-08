import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const workId = process.env.E2E_READONLY_WORK_ID;
test.skip(!workId, "Requires an actual indexed archive in an isolated read-only library.");

for (const width of [1440, 390]) {
  test(`只读库在 ${width}px 可预览及下载，整理禁用源回写`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`/#governance/${workId}`);
    const writeback = page.locator(".folio-governance-writeback-section");
    await expect(writeback.getByRole("checkbox")).toBeDisabled();
    await expect(writeback.getByRole("checkbox")).not.toBeChecked();
    await expect(writeback).toContainText("源目录只读");
    await expect(page.getByRole("button", { name: "保存修改", exact: true })).toBeDisabled();
    if (process.env.E2E_SOURCE_ARTIFACT_DIR) {
      await mkdir(process.env.E2E_SOURCE_ARTIFACT_DIR, { recursive: true });
      await writeback.screenshot({ path: `${process.env.E2E_SOURCE_ARTIFACT_DIR}/readonly-writeback-${width}.png` });
    }

    await page.goto(`/#export/${workId}`);
    const comicinfo = page.getByRole("checkbox", { name: "写入 ComicInfo.xml", exact: true });
    await comicinfo.uncheck();
    await expect(page.locator(".folio-export-comicinfo")).toHaveClass(/is-off/);
    await comicinfo.check();
    await expect(page.locator(".folio-export-comicinfo")).not.toHaveClass(/is-off/);
    const primary = page.getByRole("button", { name: "下载此作品", exact: true });
    await expect(primary).toBeEnabled();
    const responsePromise = page.waitForResponse((response) => new URL(response.url()).pathname === `/api/works/${workId}/export/download`);
    const downloadPromise = page.waitForEvent("download");
    await primary.click();
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("application/vnd.comicbook+zip");
    expect(Number(response.headers()["content-length"])).toBeGreaterThan(0);
    const download = await downloadPromise;
    expect(await download.failure()).toBeNull();
    expect(download.suggestedFilename()).toMatch(/\.cbz$/);
    if (process.env.E2E_SOURCE_ARTIFACT_DIR) {
      await download.saveAs(`${process.env.E2E_SOURCE_ARTIFACT_DIR}/download-${width}.cbz`);
      await page.locator(".folio-export-inspector").screenshot({ path: `${process.env.E2E_SOURCE_ARTIFACT_DIR}/export-${width}.png` });
    }
    await expect(primary).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}
