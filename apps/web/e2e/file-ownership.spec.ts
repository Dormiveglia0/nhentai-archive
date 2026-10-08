import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const workId = process.env.E2E_READONLY_WORK_ID;
test.skip(!workId, "Requires an actual indexed work in an isolated read-only library.");

for (const width of [1440, 390]) {
  test(`只读作品在 ${width}px 的详情、批量和文件删除均显示拒绝原因`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const inventory = await (await page.request.get("/api/files/inventory?category=work")).json();
    expect(inventory.result.find((item: { work_id: number }) => item.work_id === Number(workId)).read_only).toBe(true);

    await page.goto("/#library");
    const cover = page.locator(`.folio-library-card .folio-library-cover[href$='#reader/${workId}']`);
    await cover.click();
    const detail = page.locator(".folio-work-dialog");
    await expect(detail).toBeVisible();
    await detail.getByRole("button", { name: "删除", exact: true }).click();
    const deletion = page.locator(".folio-work-delete-dialog");
    await expect(deletion.getByText("作品暂时无法删除。", { exact: true })).toBeVisible();
    await expect(deletion.getByText("该目录库只读，不能修改源文件", { exact: true })).toBeVisible();
    await expect(deletion.getByRole("button", { name: "确认永久删除" })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(detail.getByRole("button", { name: "删除", exact: true })).toBeFocused();
    await detail.getByRole("button", { name: "关闭作品详情" }).click();

    await page.getByRole("button", { name: "批量选择", exact: true }).click();
    await cover.click();
    await page.getByRole("button", { name: "删除所选", exact: true }).click();
    const batch = page.locator(".folio-library-delete-confirm");
    await expect(batch).toContainText("所选作品暂时无法删除。");
    await expect(batch).toContainText("该目录库只读，不能修改源文件");
    await expect(batch.getByRole("button", { name: "确认删除", exact: true })).toBeDisabled();
    await batch.getByRole("button", { name: "取消", exact: true }).click();

    await page.goto("/#files");
    await page.locator(".folio-files-row-main").first().click();
    const fileDetail = page.locator(".folio-files-detail");
    await expect(fileDetail.getByText("只读", { exact: true })).toBeVisible();
    await fileDetail.getByRole("button", { name: "预览删除影响", exact: true }).click();
    const fileDeletion = page.locator(".folio-files-delete-dialog");
    await expect(fileDeletion.getByText("所选文件暂时无法删除。", { exact: true })).toBeVisible();
    await expect(fileDeletion.getByText(/该目录库只读，不能修改源文件/)).toBeVisible();
    await expect(fileDeletion.getByRole("button", { name: "确认删除", exact: true })).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await fileDeletion.evaluate((element) => getComputedStyle(element).borderRadius)).toBe("0px");
    if (process.env.E2E_FILE_ARTIFACT_DIR) {
      await mkdir(process.env.E2E_FILE_ARTIFACT_DIR, { recursive: true });
      await fileDeletion.screenshot({ path: `${process.env.E2E_FILE_ARTIFACT_DIR}/read-only-delete-${width}.png` });
    }
    await page.keyboard.press("Escape");
    await expect(fileDetail.getByRole("button", { name: "预览删除影响", exact: true })).toBeFocused();
    expect(errors).toEqual([]);
  });
}
