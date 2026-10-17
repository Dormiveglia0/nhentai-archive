import { expect, test } from "@playwright/test";

for (const width of [1440, 1365, 390, 320]) {
  test(`文件标题操作与派生文件预览 ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1365 ? 768 : width <= 390 ? 844 : 1000 });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("/#files?view=libraries");
    const head = page.locator(".folio-media-libraries > .folio-settings-subhead");
    await expect(head.getByRole("button", { name: /默认下载到/ })).toBeVisible();
    await expect(head.getByRole("button", { name: "添加库" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    await page.goto("/#files?view=files");
    await expect(page.locator(".folio-files-inventory[aria-busy]")).toHaveAttribute("aria-busy", "false");
    const actions = page.getByRole("group", { name: "文件批量操作", exact: true });
    const rows = page.locator(".folio-files-row");
    const count = await rows.count();
    if (count) {
      await actions.getByRole("button", { name: "全选本页", exact: true }).click();
      await expect(page.locator('.folio-files-select[aria-pressed="true"]')).toHaveCount(count);
      await actions.getByRole("button", { name: "预览删除影响" }).click();
      const dialog = page.getByRole("dialog", { name: "确认删除" });
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "取消" }).click();
      await expect(actions.getByRole("button", { name: "预览删除影响" })).toBeFocused();
      await actions.getByRole("button", { name: "取消本页全选" }).click();
      await expect(page.locator('.folio-files-select[aria-pressed="true"]')).toHaveCount(0);
    } else {
      await expect(actions.getByRole("button", { name: "全选本页", exact: true })).toBeDisabled();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    await page.goto("/#files?view=derived");
    await expect(page.locator(".folio-data-list")).toHaveAttribute("aria-busy", "false");
    const checkboxes = page.locator('.folio-derived-record input[type="checkbox"]:enabled');
    const selectable = await checkboxes.count();
    const batch = page.getByRole("group", { name: "派生文件批量操作" });
    if (selectable) {
      await batch.getByRole("button", { name: "全选本页可清理项" }).click();
      await expect(page.locator('.folio-derived-record input:checked')).toHaveCount(selectable);
      await expect(page.locator('.folio-derived-record input:disabled:checked')).toHaveCount(0);
      await batch.getByRole("button", { name: "预览批量清理" }).click();
      const dialog = page.getByRole("dialog", { name: "确认删除" });
      await expect(dialog).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(batch.getByRole("button", { name: "预览批量清理" })).toBeFocused();
      await page.getByRole("button", { name: "刷新派生文件列表" }).click();
      await expect(page.locator('.folio-derived-record input:checked')).toHaveCount(0);
    }
    const view = page.getByRole("button", { name: "查看文件", exact: true }).first();
    if (await view.count()) {
      await view.click();
      const dialog = page.getByRole("dialog", { name: "查看派生文件" });
      await expect(dialog).toBeVisible();
      const image = dialog.locator("img");
      if (await image.count()) await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
      await expect(dialog.getByRole("link", { name: "下载文件" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(view).toBeFocused();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
    if (process.env.E2E_FILE_ARTIFACT_DIR) await page.screenshot({ path: `${process.env.E2E_FILE_ARTIFACT_DIR}/derived-${width}.png`, fullPage: true });
  });
}
