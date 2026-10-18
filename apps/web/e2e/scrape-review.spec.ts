import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const ownedRoot = process.env.E2E_REVIEW_ROOT || "";
const workId = Number(process.env.E2E_REVIEW_WORK_ID);
const libraryId = Number(process.env.E2E_REVIEW_LIBRARY_ID);
const galleryId = Number(process.env.E2E_REVIEW_GALLERY_ID);
const artifacts = process.env.E2E_REVIEW_ARTIFACT_DIR;
test.skip(!ownedRoot.startsWith("/tmp/nh-governance-review-") || !workId || !libraryId || !galleryId,
  "Requires an isolated copy of an actual archive and its recorded remote gallery");
test.use({ reducedMotion: "reduce" });

for (const width of [1440, 1365, 390, 320]) {
  test(`${width}px 整理页审批、封面、手动保存和远端绑定信息`, async ({ page, request }) => {
    test.setTimeout(60_000);
    const errors: string[] = [];
    const previews: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", req => { if (req.url().includes("/api/governance/metadata-refresh/preview")) previews.push(req.url()); });
    await page.setViewportSize({ width, height: width >= 1000 ? 1000 : 844 });
    const before = await (await request.get(`/api/works/${workId}`)).json();
    await page.goto(`/#scrape?library_id=${libraryId}&status=all`);
    await expect(page.locator('.folio-governance-tabs a[aria-current="page"]')).toHaveText("刮削审批");
    if (width >= 1000) await expect(page.locator('.folio-topnav a[href="#governance"]')).toHaveClass(/is-active/);
    const entry = page.locator('.folio-scrape-review-list > button');
    await expect(entry).toHaveCount(1);
    await entry.click();
    const detail = page.getByRole("region", { name: "刮削审批详情", exact: true });
    const cover = detail.locator('.folio-governance-work-cover img');
    await expect(cover).toHaveAttribute("src", `/api/works/${workId}/cover?w=384`);
    await cover.evaluate((image: HTMLImageElement) => image.decode());
    if (!before.remote_gallery_id) await expect(detail.getByRole("region", { name: "已绑定的远端信息", exact: true })).toHaveCount(0);
    expect(previews).toEqual([]);

    await detail.getByRole("button", { name: "手动编辑", exact: true }).click();
    await expect(detail.locator('.folio-governance-field-card')).toHaveCount(10);
    const author = detail.getByRole("combobox", { name: "本地最终值：作者", exact: true });
    const originalAuthor = await author.inputValue();
    const candidates = await (await request.get(`/api/dictionary/candidates?type=artist&limit=1`)).json();
    if (candidates.result.length) {
      const candidate = candidates.result[0];
      await author.fill(candidate.name || candidate.slug || candidate.display);
      await expect(detail.getByRole("listbox", { name: "词典建议" })).toBeVisible();
      await detail.getByRole("option").first().click();
      await author.fill(originalAuthor);
      await author.blur();
    }
    const language = detail.getByRole("group", { name: "本地最终值：语言（可多选）" });
    const languageLabels = await language.getByRole("button").allTextContents();
    expect(new Set(languageLabels).size).toBe(languageLabels.length);
    const extra = language.locator('button[aria-pressed="false"]').first();
    if (await extra.count()) {
      const label = await extra.textContent();
      await extra.click();
      await expect(language.getByRole("button", { name: label!, exact: true })).toHaveAttribute("aria-pressed", "true");
      await language.getByRole("button", { name: label!, exact: true }).click();
    }
    const summary = detail.getByRole("textbox", { name: "本地最终值：简介", exact: true });
    const originalSummary = await summary.inputValue();
    await summary.fill(originalSummary || before.title);
    if (artifacts) {
      await mkdir(artifacts, { recursive: true });
      await detail.locator('.folio-governance-field-card').first().scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${artifacts}/manual-${width}.png`, mask: [page.locator('img')], maskColor: '#e8e2d7' });
    }
    const saved = page.waitForResponse(response => response.url().endsWith(`/api/works/${workId}/governance/apply`));
    await detail.getByRole("button", { name: "保存并完成", exact: true }).click();
    expect((await saved).ok()).toBe(true);
    await expect(detail.getByRole("status")).toContainText("审批完成");
    await expect(cover).toBeVisible();
    await expect(detail.getByRole("button", { name: "保存并完成", exact: true })).toBeEnabled();
    const savedAgain = page.waitForResponse(response => response.url().endsWith(`/api/works/${workId}/governance/apply`));
    await detail.getByRole("button", { name: "保存并完成", exact: true }).click();
    expect((await savedAgain).ok()).toBe(true);
    await expect(detail.getByRole("button", { name: "保存并完成", exact: true })).toBeEnabled();

    await detail.getByRole("button", { name: "远端匹配", exact: true }).click();
    const panel = detail.locator('.folio-scrape');
    await detail.locator('.folio-scrape-review-bind input').check();
    await panel.getByRole("textbox", { name: "作品名称或 ID" }).fill(String(galleryId));
    await panel.getByRole("button", { name: "搜索", exact: true }).click();
    const confirm = panel.getByRole("button", { name: "确认应用并绑定", exact: true });
    await expect(confirm).toBeEnabled({ timeout: 20_000 });
    const applied = page.waitForResponse(response => response.url().endsWith('/api/governance/metadata-refresh/apply'));
    await confirm.click();
    expect((await applied).ok()).toBe(true);
    const remote = detail.getByRole("region", { name: "已绑定的远端信息", exact: true });
    await expect(remote).toContainText(`远端绑定 #${galleryId}`);
    await expect(remote.getByRole("link", { name: "远端详情", exact: true })).toHaveAttribute("href", `#gallery/${galleryId}`);
    await expect(detail.getByRole("button", { name: "手动编辑", exact: true })).toBeEnabled();
    const aggregate = await (await request.get(`/api/works/${workId}/governance`)).json();
    const remoteTitle = aggregate.remote.fields.find((field: { field: string }) => field.field === "title").value;
    await expect(remote).toContainText(remoteTitle);
    await cover.evaluate((image: HTMLImageElement) => image.decode());
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await detail.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    if (artifacts) {
      await remote.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${artifacts}/bound-${width}.png`, mask: [page.locator('img')], maskColor: '#e8e2d7' });
    }
    const after = await (await request.get(`/api/works/${workId}`)).json();
    expect(after.remote_gallery_id).toBe(galleryId);
    expect(after.cover_path).toBe(before.cover_path);
    expect(after.page_count).toBe(before.page_count);

    await page.getByRole("button", { name: /^已完成\s*\d+$/ }).click();
    await expect(page).toHaveURL(/#governance\?view=scrape&status=completed/);
    await expect(entry).toHaveCount(1);
    await page.locator('.folio-governance-tabs a').getByText("作品整理", { exact: true }).click();
    await expect(page.locator('.folio-governance-queue')).toBeVisible();
    expect(errors).toEqual([]);
  });
}
