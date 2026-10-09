import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const root = process.env.E2E_METADATA_ROOT || "";
const workId = Number(process.env.E2E_METADATA_WORK_ID);
const galleryId = Number(process.env.E2E_METADATA_GALLERY_ID);
const libraryId = Number(process.env.E2E_METADATA_LIBRARY_ID);
const artifacts = process.env.E2E_METADATA_ARTIFACT_DIR;
test.skip(!root.startsWith("/tmp/nh-media-update-20261009/metadata-browser-owned-") || !workId || !galleryId || !libraryId,
  "Requires an owned actual archive and its actual remote reference");

for (const width of [1440, 390]) {
  test(width + "px 真实名称和ID预览、元数据应用及本地标签范围", async ({ page, request }) => {
    test.setTimeout(60_000);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const before = await (await request.get("/api/works/" + workId)).json();
    expect(before.remote_gallery_id).toBeNull();
    const localTag = before.tags.find((tag: { key?: string; type: string }) => tag.type === "tag" && tag.key?.startsWith("local:"));
    expect(localTag?.key).toMatch(/^local:/);
    await page.goto("/#library");
    await page.locator(".folio-library-card-title").first().click();
    const dialog = page.locator(".folio-work-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveCSS("transform", "none");
    const tagQuery = new URLSearchParams({ tag_key: localTag.key }).toString();
    const localLink = dialog.locator('a[href*="' + tagQuery + '"]').first();
    await expect(localLink).toHaveAttribute("href", /^#library/);
    const searched = page.waitForResponse(response => response.url().includes("/api/library/search") && new URL(response.url()).searchParams.getAll("tag_keys").includes(localTag.key));
    await localLink.click();
    expect((await (await searched).json()).result.some((work: { id: number }) => work.id === workId)).toBe(true);
    await expect(dialog).toHaveCount(0);
    await page.locator(".folio-library-card-title").first().click();
    await dialog.getByRole("button", { name: "刮削元数据", exact: true }).click();
    const panel = page.getByRole("region", { name: "刮削元数据", exact: true });
    await expect(panel.getByRole("textbox")).toBeFocused();
    await panel.getByRole("textbox").fill(String(galleryId));
    await panel.getByRole("button", { name: "搜索", exact: true }).click();
    await expect(panel.locator("tbody tr")).toHaveCount(7);
    await expect(panel.getByRole("button", { name: "确认应用元数据" })).toBeEnabled();
    expect(await panel.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    expect(await panel.getByRole("button", { name: "确认应用元数据" }).evaluate(node => getComputedStyle(node).borderRadius)).toBe("0px");
    if (artifacts) {
      await mkdir(artifacts, { recursive: true });
      await panel.screenshot({ path: artifacts + "/preview-" + width + ".png" });
      await panel.locator("details > summary").click();
      await panel.locator("details tbody tr").first().screenshot({ path: artifacts + "/comparison-" + width + ".png" });
      await panel.locator("details > summary").click();
    }
    await panel.getByRole("button", { name: "确认应用元数据" }).click();
    await expect(panel.getByRole("status")).toContainText("元数据已更新");
    const after = await (await request.get("/api/works/" + workId)).json();
    expect(after.remote_gallery_id).toBeNull();
    expect(after.metadata_gallery_id).toBe(galleryId);
    expect(after.page_count).toBe(before.page_count);
    expect(after.cover_path).toBe(before.cover_path);
    expect(after.source).toBe(before.source);
    await expect(dialog.getByRole("link", { name: "远端详情" })).toHaveCount(0);
    await panel.getByRole("button", { name: "关闭刮削" }).click();
    await dialog.locator("a.is-primary").click();
    await expect(page.locator(".reader-counter")).toContainText("/");
    await page.getByRole("button", { name: "作品信息", exact: true }).click();
    const info = page.locator(".reader-info-panel");
    await expect(info).toBeVisible();
    const readerTag = info.locator('a[href*="' + tagQuery + '"]').first();
    await expect(readerTag).toHaveAttribute("href", /^#library/);
    await readerTag.click();
    await expect(page.locator(".folio-library-card")).toHaveCount(1);
    expect(errors).toEqual([]);
  });
}

test("绑定后原生远端详情链接和远端标签范围", async ({ page, request }) => {
  test.setTimeout(60_000);
  expect((await request.patch("/api/library/directories/" + libraryId, { data: { config: { auto_bind: true } } })).ok()).toBe(true);
  await page.goto("/#library");
  await page.locator(".folio-library-card-title").first().click();
  const dialog = page.locator(".folio-work-dialog");
  await dialog.getByRole("button", { name: "刮削元数据", exact: true }).click();
  const panel = page.getByRole("region", { name: "刮削元数据", exact: true });
  await panel.getByRole("textbox").fill(String(galleryId));
  await panel.getByRole("button", { name: "搜索", exact: true }).click();
  await panel.getByRole("button", { name: "确认应用并绑定" }).click();
  await expect(panel.getByRole("status")).toContainText("元数据已更新");
  const link = dialog.getByRole("link", { name: "远端详情", exact: true });
  await expect(link).toHaveAttribute("href", new RegExp("^#gallery/" + galleryId));
  await link.click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".folio-gallery-detail")).toBeVisible();
  await expect(page.locator(".folio-gallery-tags a").first()).toHaveAttribute("href", /^#discover/);
});
