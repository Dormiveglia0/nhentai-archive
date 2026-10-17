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
      await actions.getByRole("button", { name: "全选", exact: true }).click();
      await expect(page.locator('.folio-files-select[aria-pressed="true"]')).toHaveCount(count);
      await actions.getByRole("button", { name: "删除" }).click();
      const dialog = page.getByRole("dialog", { name: "确认删除" });
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "取消" }).click();
      await expect(actions.getByRole("button", { name: "删除" })).toBeFocused();
      await actions.getByRole("button", { name: "全选" }).click();
      await expect(page.locator('.folio-files-select[aria-pressed="true"]')).toHaveCount(0);
    } else {
      await expect(actions.getByRole("button", { name: "全选", exact: true })).toBeDisabled();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    await page.goto("/#files?view=derived");
    await expect(page.locator(".folio-data-list")).toHaveAttribute("aria-busy", "false");
    await expect(page.locator('.folio-derived-files input[type="checkbox"]')).toHaveCount(0);
    const batch = page.getByRole("group", { name: "派生文件批量操作" });
    const batchButton = batch.getByRole("button", { name: "批量", exact: true });
    const hasSelectable = await batchButton.isEnabled();
    if (hasSelectable) await batchButton.click();
    await expect(page.locator(".folio-derived-selection-hint")).toHaveCount(0);
    const selectable = await page.locator('.folio-derived-row-select').count();
    if (selectable) {
      const selectAll = batch.getByRole("button", { name: "全选", exact: true });
      const before = await selectAll.boundingBox();
      await selectAll.click();
      await expect(page.locator('.folio-derived-row-select[aria-pressed="true"]')).toHaveCount(selectable);
      expect(await selectAll.boundingBox()).toEqual(before);
      await batch.getByRole("button", { name: "清理", exact: true }).click();
      await expect(page.getByRole("dialog", { name: "确认删除" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(batch.getByRole("button", { name: "清理", exact: true })).toBeFocused();
      await batch.getByRole("button", { name: "清空", exact: true }).click();
      await expect(page.locator('.folio-derived-row-select[aria-pressed="true"]')).toHaveCount(0);
      const first = page.locator('.folio-derived-row-select').first();
      const spacing = await first.locator("..").evaluate(row => { const box = row.getBoundingClientRect(); const content = row.querySelector(".folio-data-record")!.getBoundingClientRect(); const state = row.querySelector(".folio-derived-selection-state")!.getBoundingClientRect(); return { left: content.left - box.left, right: box.right - state.right }; });
      expect(spacing.left).toBeGreaterThanOrEqual(12);
      expect(spacing.right).toBeGreaterThanOrEqual(12);
      await first.focus();
      await page.keyboard.press("Space");
      await expect(first).toHaveAttribute("aria-pressed", "true");
      await first.hover();
      if (process.env.E2E_FILE_ARTIFACT_DIR) await page.screenshot({ path: `${process.env.E2E_FILE_ARTIFACT_DIR}/derived-selected-${width}.png`, fullPage: true });
    }
    if (hasSelectable) await batch.getByRole("button", { name: "取消", exact: true }).click();
    if (hasSelectable) await batchButton.click();
    await page.getByRole("button", { name: /派生文件类型：/ }).click();
    await page.getByRole("button", { name: "封面", exact: true }).click();
    await expect(page.locator(".folio-data-list")).toHaveAttribute("aria-busy", "false");
    const protectedOnly = await page.locator('.folio-data-list > li').count() > 0 && await page.locator('.folio-data-row-actions').getByRole('button', { name: '清理', exact: true }).count() === 0;
    if (protectedOnly) {
      await expect(batchButton).toBeDisabled();
      await expect(batchButton).toHaveAttribute("aria-pressed", "false");
      await expect(batch.getByRole("button", { name: "全选", exact: true })).toHaveCount(0);
      await expect(batch.getByRole("button", { name: "清理", exact: true })).toHaveCount(0);
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
    await page.getByRole("searchbox", { name: "搜索派生文件路径或作品标题" }).fill("no-matching-derived-file-928340281");
    await expect(page.locator(".folio-data-list > li")).toHaveCount(0);
    await expect(batchButton).toBeDisabled();
    await expect(batchButton).toHaveAttribute("aria-pressed", "false");
    await expect(batch.getByRole("button", { name: /全选|清空|清理|取消/ })).toHaveCount(0);
    expect(errors).toEqual([]);
    if (process.env.E2E_FILE_ARTIFACT_DIR) await page.screenshot({ path: `${process.env.E2E_FILE_ARTIFACT_DIR}/derived-${width}.png`, fullPage: true });
  });
}

test("派生列表加载失败后不能沿用上一页批量状态", async ({ page }) => {
  await page.goto("/#files?view=derived");
  await expect(page.locator(".folio-data-list")).toHaveAttribute("aria-busy", "false");
  const actions = page.getByRole("group", { name: "派生文件批量操作" });
  const batch = actions.getByRole("button", { name: "批量", exact: true });
  if (await batch.isEnabled()) {
    await batch.click();
    await actions.getByRole("button", { name: "全选", exact: true }).click();
  }
  await page.route("**/api/files/derived?**", route => route.abort(), { times: 1 });
  await page.getByRole("button", { name: "刷新派生文件列表" }).click();
  await expect(page.locator(".folio-derived-files").getByRole("alert")).toBeVisible();
  await expect(batch).toBeDisabled();
  await expect(batch).toHaveAttribute("aria-pressed", "false");
  await expect(actions.getByRole("button", { name: /全选|清空|清理|取消/ })).toHaveCount(0);
  await expect(page.locator(".folio-derived-row-select")).toHaveCount(0);
});
