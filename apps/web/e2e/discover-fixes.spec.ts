import { expect, test, type Locator } from "@playwright/test";

const LANDSCAPE_WORK_ID = process.env.E2E_LANDSCAPE_WORK_ID ?? "5";

test.describe("界面与封面回归", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("移动端馆藏和发现作品均显示居中的 Tag", async ({ page }) => {
    await page.goto("/#library");
    const libraryTags = page.locator(".folio-library-card-tags:has(a)").first();
    await expect(libraryTags).toBeVisible({ timeout: 15_000 });
    await expectCenteredTag(libraryTags.locator("a").first());

    await page.goto("/#discover");
    const discoverTags = page.locator(".folio-discover-card-tags:has(a)").first();
    await expect(discoverTags).toBeVisible({ timeout: 15_000 });
    await expectCenteredTag(discoverTags.locator("a").first());
    await expect(discoverTags.locator("a").first()).toHaveAttribute("draggable", "false");
    expect(await discoverTags.locator("a").first().evaluate((tag) => !tag.dispatchEvent(new DragEvent("dragstart", { bubbles: true, cancelable: true })))).toBeTruthy();
    await expect(discoverTags.locator('[aria-label^="另有"]')).toHaveCount(0);
    await discoverTags.scrollIntoViewIfNeeded();
    await page.screenshot({ path: "/tmp/nh-archive-discover-mobile.png" });
  });

  test("作品、Tag 与主导航均可用鼠标中键原生打开新页面", async ({ page, context }) => {
    await page.setViewportSize({ width: 1280, height: 860 });
    await page.goto("/#discover");
    await expect(page.locator(".folio-topnav a[href]")).toHaveCount(9);
    await expect.poll(() => new URL(page.url()).hash).toContain("page=1");

    const currentUrl = page.url();
    const workLink = page.locator(".folio-discover-cover[href^='#gallery/']").first();
    await expect(workLink).toBeVisible({ timeout: 15_000 });
    const workPagePromise = context.waitForEvent("page");
    await workLink.click({ button: "middle" });
    const workPage = await workPagePromise;
    await expect.poll(() => new URL(workPage.url()).hash).toMatch(/^#gallery\/\d+/);
    expect(page.url()).toBe(currentUrl);
    await workPage.close();

    const tagLink = page.locator(".folio-discover-card-tags a[href^='#discover?']").first();
    await expect(tagLink).toBeVisible();
    const tagPagePromise = context.waitForEvent("page");
    await tagLink.click({ button: "middle" });
    const tagPage = await tagPagePromise;
    await expect.poll(() => new URL(tagPage.url()).hash).toContain("#discover?");
    expect(page.url()).toBe(currentUrl);
    await tagPage.close();
  });

  test("Tag 检索可明确排除条件并发送负向远端查询", async ({ page }) => {
    let excludedQuery = "";
    await page.route("**/api/discover/feed?**", async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get("tag_names")?.startsWith("-")) excludedQuery = url.searchParams.get("tag_names") ?? "";
      await route.continue();
    });
    await page.goto("/#discover");
    await page.getByRole("button", { name: "添加标签" }).click();
    await page.getByRole("button", { name: "− 排除所选" }).click();
    const option = page.locator(".folio-discover-tag-options > a").first();
    await expect(option).toBeVisible({ timeout: 15_000 });
    const label = (await option.locator("strong").textContent())?.trim() ?? "";
    await option.click();

    await expect.poll(() => excludedQuery).toMatch(/^-/);
    await expect(page.locator(".folio-discover-tag-chips .is-excluded")).toContainText(label);
    await expect(page.locator(".folio-discover-message")).toContainText("排除");
  });

  test("横向发现封面保留完整画面并用同图氛围层填满固定卡框", async ({ page, request }) => {
    const libraryResponse = await request.get("/api/library/search?page=1&per_page=100");
    const work = (await libraryResponse.json()).result.find((item: { id: number }) => item.id === Number(LANDSCAPE_WORK_ID));
    expect(work?.remote_gallery_id).toBeTruthy();
    const galleryResponse = await request.get(`/api/discover/galleries/${work.remote_gallery_id}`);
    expect(galleryResponse.ok()).toBeTruthy();
    const detail = await galleryResponse.json();

    await page.route("**/api/discover/feed?**", (route) => route.fulfill({
      json: {
        result: [{
          remote: "nhentai",
          gallery_id: detail.gallery_id,
          media_id: detail.media_id,
          title: detail.title.english,
          title_japanese: detail.title.japanese,
          pretty_title: detail.title.pretty,
          thumbnail: { url: `/api/works/${work.id}/cover`, width: 1280, height: 960 },
          page_count: detail.page_count,
          favorites: detail.favorites,
          tag_ids: detail.tags.map((tag: { id: number }) => tag.id),
          tags: detail.tags,
          blacklisted: false,
          imported: true,
          work_id: work.id,
        }],
        total: 1,
        num_pages: 1,
        per_page: 8,
      },
    }));
    await page.goto("/#discover");

    const cover = page.locator(".folio-discover-cover.is-landscape");
    const artwork = cover.locator(".folio-ambient-cover-artwork");
    await expect(artwork).toBeVisible({ timeout: 15_000 });
    await cover.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => {
      const image = document.querySelector<HTMLImageElement>(".folio-discover-cover.is-landscape .folio-ambient-cover-artwork");
      return Boolean(image?.complete && image.naturalWidth > 0);
    });
    const metrics = await cover.evaluate((node) => {
      const frame = node.getBoundingClientRect();
      const foreground = node.querySelector<HTMLImageElement>(".folio-ambient-cover-artwork")!;
      const foregroundBox = foreground.getBoundingClientRect();
      const backdrop = node.querySelector<HTMLImageElement>(".folio-ambient-cover-backdrop")!;
      const backdropStyle = getComputedStyle(backdrop);
      return {
        frame: { left: frame.left, top: frame.top, right: frame.right, bottom: frame.bottom },
        foreground: { left: foregroundBox.left, top: foregroundBox.top, right: foregroundBox.right, bottom: foregroundBox.bottom, ratio: foregroundBox.width / foregroundBox.height },
        naturalRatio: foreground.naturalWidth / foreground.naturalHeight,
        sameSource: foreground.currentSrc === backdrop.currentSrc,
        backdropFilter: backdropStyle.filter,
        backdropOpacity: Number(backdropStyle.opacity),
      };
    });
    expect(Math.abs(metrics.foreground.ratio - metrics.naturalRatio)).toBeLessThanOrEqual(0.01);
    expect(metrics.foreground.left).toBeGreaterThan(metrics.frame.left);
    expect(metrics.foreground.right).toBeLessThan(metrics.frame.right);
    expect(metrics.foreground.top).toBeGreaterThan(metrics.frame.top);
    expect(metrics.foreground.bottom).toBeLessThan(metrics.frame.bottom);
    expect(metrics.sameSource).toBeTruthy();
    expect(metrics.backdropFilter).toContain("blur(7px)");
    expect(metrics.backdropOpacity).toBeGreaterThanOrEqual(0.89);
    await cover.screenshot({ path: "/tmp/nh-archive-landscape-discover-card.png" });

    await page.setViewportSize({ width: 1440, height: 900 });
    await cover.scrollIntoViewIfNeeded();
    await cover.screenshot({ path: "/tmp/nh-archive-landscape-discover-card-desktop.png" });
  });

  test("移动端五个热门作品同屏，馆藏只展示内容 Tag", async ({ page }) => {
    await page.goto("/#discover");
    const popular = page.locator(".folio-discover-popular-card");
    await expect(popular).toHaveCount(5, { timeout: 15_000 });
    await page.waitForTimeout(1_200);

    const geometry = await page.locator(".folio-discover-popular-track").evaluate((track) => ({
      clientWidth: track.clientWidth,
      scrollWidth: track.scrollWidth,
      cards: Array.from(track.querySelectorAll<HTMLElement>(".folio-discover-popular-card")).map((card) => {
        const box = card.getBoundingClientRect();
        const center = document.elementFromPoint((box.left + box.right) / 2, (box.top + box.bottom) / 2);
        return { left: box.left, right: box.right, centerVisible: Boolean(center && card.contains(center)) };
      }),
      viewportWidth: window.innerWidth,
    }));
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
    expect(geometry.cards.every((card) => card.left >= -1 && card.right <= geometry.viewportWidth + 1)).toBeTruthy();
    expect(geometry.cards.every((card) => card.centerVisible)).toBeTruthy();
    await expect(page.locator(".folio-discover-popular-media")).toHaveCount(5);
    await page.waitForFunction(() => Array.from(document.querySelectorAll<HTMLImageElement>(".folio-discover-popular-artwork .folio-ambient-cover-artwork")).every((image) => image.complete && image.naturalWidth > 0));
    await expectExactCoverRatios(page.locator(".folio-discover-popular-media"));
    await expect(popular.first()).not.toHaveCSS("animation-name", "none");
    await page.locator(".folio-discover-popular").screenshot({ path: "/tmp/nh-archive-popular-mobile.png" });

    await page.goto("/#library");
    const libraryTags = page.locator(".folio-library-card-tags:has(a)").first();
    await expect(libraryTags).toBeVisible({ timeout: 15_000 });
    await expect(libraryTags).toHaveCSS("display", "flex");
    await expect(libraryTags.locator('[aria-label^="另有"]')).toHaveCount(0);
    expect(await libraryTags.locator("a").evaluateAll((tags) => tags.every((tag) => tag.dataset.tagType === "tag"))).toBeTruthy();
    await expect(page.locator(".folio-library-card-meta em").filter({ hasText: /translat/i })).toHaveCount(0);
    await page.locator(".folio-library-card:has(.folio-library-card-tags a)").first().screenshot({ path: "/tmp/nh-archive-library-card-mobile.png" });
  });

  test("桌面热门榜单按真实比例组成等高动态封面墙", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/#discover");
    const popular = page.locator(".folio-discover-popular-card");
    await expect(popular).toHaveCount(5, { timeout: 15_000 });
    await page.waitForTimeout(1_200);
    const boxes = await page.locator(".folio-discover-popular-media").evaluateAll((media) => media.map((item) => {
      const box = item.getBoundingClientRect();
      return { left: box.left, right: box.right, width: box.width, height: box.height };
    }));
    expect(boxes.every((box) => box.width > 120 && box.height > 100)).toBeTruthy();
    expect(Math.max(...boxes.map((box) => box.height)) - Math.min(...boxes.map((box) => box.height))).toBeLessThanOrEqual(6);
    await expectExactCoverRatios(page.locator(".folio-discover-popular-media"));
    await expect(popular.first()).not.toHaveCSS("animation-name", "none");
    await page.locator(".folio-discover-popular").screenshot({ path: "/tmp/nh-archive-popular-desktop.png" });
  });

  test("移动端按两列四行请求八项并严格等宽等高顺序排列", async ({ page }) => {
    const feed = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname === "/api/discover/feed" && url.searchParams.get("per_page") === "8";
    });
    await page.goto("/#discover");
    await feed;
    const cards = page.locator(".folio-discover-card-cell");
    await expect(cards.first()).toBeVisible({ timeout: 15_000 });
    const geometry = await page.locator(".folio-discover-grid").evaluate((grid) => {
      const items = Array.from(grid.querySelectorAll<HTMLElement>(".folio-discover-card-cell"));
      const boxes = items.map((item) => {
        const box = item.getBoundingClientRect();
        const card = item.querySelector<HTMLElement>(".folio-discover-card")!.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width, height: box.height, cardHeight: card.height };
      });
      return {
        count: items.length,
        columns: getComputedStyle(grid).gridTemplateColumns.split(/\s+/).filter(Boolean).length,
        gridWidth: grid.getBoundingClientRect().width,
        boxes,
      };
    });
    expect(geometry.count).toBe(8);
    expect(geometry.columns).toBe(2);
    expect(geometry.count % 2).toBe(0);
    expect(Math.max(...geometry.boxes.map((box) => box.width)) - Math.min(...geometry.boxes.map((box) => box.width))).toBeLessThanOrEqual(1);
    expect(Math.max(...geometry.boxes.map((box) => box.height)) - Math.min(...geometry.boxes.map((box) => box.height))).toBeLessThanOrEqual(1);
    expect(geometry.boxes.every((box) => Math.abs(box.height - box.cardHeight) <= 1)).toBeTruthy();
    expect(Math.abs(geometry.boxes[0].y - geometry.boxes[1].y)).toBeLessThanOrEqual(1);
    expect(geometry.boxes[0].x).toBeLessThan(geometry.boxes[1].x);
    expect(geometry.boxes[2].y).toBeGreaterThan(geometry.boxes[0].y);
    expect(geometry.boxes.at(-1)!.width).toBeLessThan(geometry.gridWidth * 0.55);
    await page.locator(".folio-discover-grid").screenshot({ path: "/tmp/nh-archive-discover-grid-mobile.png" });
  });

  test("所有主页面使用同一页头场景尺寸且切页不缩放", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const routes = [
      ["workbench", "工作台"],
      ["library", "我的库"],
      ["discover", "发现 / 导入"],
      ["governance", "治理工作台"],
      ["dictionary", "词典治理"],
      ["tasks", "任务中心"],
      ["export", "导出中心"],
      ["files", "文件管理"],
      ["settings", "设置"],
    ] as const;
    const heights: number[] = [];
    const titleSizes: number[] = [];
    for (const [route, expectedTitle] of routes) {
      await page.goto(`/#${route}`);
      await expect(page.locator(".folio-page")).toHaveCount(1);
      const root = page.locator(`.folio-page-${route}`);
      const title = root.locator(".folio-page-copy h1");
      const head = root.locator(".folio-page-head");
      const scene = root.locator(".folio-scene");
      const body = root.locator(".folio-page-body");
      await expect(title).toHaveText(expectedTitle);
      await expect(head).toBeVisible();
      await expect(scene).toBeVisible();
      await expect(body).toBeVisible();
      const [headBox, sceneBox, bodyBox] = await Promise.all([head.boundingBox(), scene.boundingBox(), body.boundingBox()]);
      expect(headBox).not.toBeNull();
      expect(sceneBox).not.toBeNull();
      expect(bodyBox).not.toBeNull();
      const geometry = {
        headBottom: headBox!.y + headBox!.height,
        sceneBottom: sceneBox!.y + sceneBox!.height,
        bodyTop: bodyBox!.y,
      };
      heights.push(headBox!.height);
      let titleSize = Number.NaN;
      await expect.poll(async () => {
        const value = await title.evaluate((node) => getComputedStyle(node).fontSize).catch(() => "");
        titleSize = Number.parseFloat(value);
        return Number.isFinite(titleSize);
      }).toBeTruthy();
      titleSizes.push(titleSize);
      expect(geometry.sceneBottom).toBeLessThanOrEqual(geometry.headBottom + 1);
      expect(geometry.bodyTop).toBeGreaterThanOrEqual(geometry.headBottom - 1);
    }
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1);
    expect(Math.max(...titleSizes) - Math.min(...titleSizes)).toBeLessThanOrEqual(0.1);

    await page.setViewportSize({ width: 390, height: 844 });
    const mobileTitleSizes: number[] = [];
    for (const [route, expectedTitle] of routes) {
      await page.goto(`/#${route}`);
      await expect(page.locator(".folio-page")).toHaveCount(1);
      const title = page.locator(`.folio-page-${route} .folio-page-copy h1`);
      await expect(title).toHaveText(expectedTitle);
      let titleSize = Number.NaN;
      await expect.poll(async () => {
        const value = await title.evaluate((node) => getComputedStyle(node).fontSize).catch(() => "");
        titleSize = Number.parseFloat(value);
        return Number.isFinite(titleSize);
      }).toBeTruthy();
      mobileTitleSizes.push(titleSize);
    }
    expect(Math.max(...mobileTitleSizes) - Math.min(...mobileTitleSizes)).toBeLessThanOrEqual(0.1);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/#workbench");
    await page.locator(".folio-topnav a").filter({ hasText: "设置" }).click();
    const scales = await page.evaluate(async () => {
      const values: number[] = [];
      for (let index = 0; index < 24; index += 1) {
        document.querySelectorAll<HTMLElement>(".folio-page").forEach((node) => {
          const matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform);
          values.push(matrix.a, matrix.d);
        });
        await new Promise(requestAnimationFrame);
      }
      return values;
    });
    expect(scales.every((value) => Math.abs(value - 1) <= 0.0001)).toBeTruthy();
  });

  test("登出使用完整顶栏单元且文案保持简洁", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/#settings");
    const logout = page.getByRole("button", { name: "登出并锁定本地馆藏" });
    await expect(logout).toContainText("登出");
    const geometry = await logout.evaluate((button) => {
      const box = button.getBoundingClientRect();
      const topbar = button.closest(".folio-topbar")!.getBoundingClientRect();
      return { height: box.height, topbarHeight: topbar.height, width: box.width, right: box.right, topbarRight: topbar.right };
    });
    expect(Math.abs(geometry.height - geometry.topbarHeight)).toBeLessThanOrEqual(1);
    expect(geometry.width).toBeGreaterThanOrEqual(110);
    expect(Math.abs(geometry.right - geometry.topbarRight)).toBeLessThanOrEqual(1);
  });

  test("阅读偏好移除无效隐私模式，两个作品入口均可安全预览删除", async ({ page, request }) => {
    await page.goto("/#settings");
    await page.getByRole("button", { name: "访问与阅读" }).click();
    await expect(page.getByText("隐私模式默认开启")).toHaveCount(0);
    await expect(page.getByText("封面模糊默认开启")).toBeVisible();
    await expect(page.getByText("默认阅读模式")).toBeVisible();

    await page.goto("/#library");
    await page.locator(".folio-library-cover").first().click();
    const inspector = page.locator(".folio-library-inspector.is-open");
    await expect(inspector).toBeVisible();
    await inspector.getByRole("button", { name: "删除本地作品" }).click();
    const dialog = page.getByRole("dialog", { name: "确认删除本地作品" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "取消" }).click();
    await expect(dialog).not.toBeVisible();

    const libraryResponse = await request.get("/api/library/search?page=1&per_page=24");
    expect(libraryResponse.ok()).toBeTruthy();
    const work = (await libraryResponse.json()).result.find((item: { remote_gallery_id?: number }) => item.remote_gallery_id);
    expect(work?.remote_gallery_id).toBeTruthy();
    await page.goto(`/#gallery/${work.remote_gallery_id}`);
    const detailDelete = page.getByRole("button", { name: "删除本地作品" });
    await expect(detailDelete).toBeVisible({ timeout: 15_000 });
    await detailDelete.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "取消" }).click();

    await page.goto("/#files");
    await expect(page.locator(".folio-files-row-delete")).toHaveCount(0);
  });

  test("Tag、语言和类型组合后返回内容也符合三个条件", async ({ request }) => {
    const popularResponse = await request.get("/api/discover/popular");
    expect(popularResponse.ok()).toBeTruthy();
    const popular = (await popularResponse.json()).result as Array<{
      tags: Array<{ type?: string; name?: string; slug?: string }>;
    }>;
    const supportedNamespaces = new Set(["artist", "character", "group", "parody", "tag"]);
    const supportedLanguages = new Set(["chinese", "english", "japanese"]);
    const supportedCategories = new Set(["doujinshi", "manga"]);
    const candidate = popular.map((item) => ({
      tag: item.tags.find((tag) => supportedNamespaces.has(tag.type || "") && (tag.name || tag.slug)),
      language: item.tags.find((tag) => tag.type === "language" && supportedLanguages.has(tag.name || tag.slug || "")),
      category: item.tags.find((tag) => tag.type === "category" && supportedCategories.has(tag.name || tag.slug || "")),
    })).find((item) => item.tag && item.language && item.category);
    expect(candidate).toBeTruthy();

    const tagType = candidate!.tag!.type!;
    const tagName = candidate!.tag!.name || candidate!.tag!.slug || "";
    const language = candidate!.language!.name || candidate!.language!.slug || "";
    const category = candidate!.category!.name || candidate!.category!.slug || "";
    const query = new URLSearchParams({
      page: "1",
      per_page: "8",
      language,
      type: category,
      tag_names: `${tagType}:${tagName}`,
      sort: "date",
      unimported_only: "false",
    });
    const response = await request.get(`/api/discover/feed?${query}`);
    expect(response.ok()).toBeTruthy();
    const payload = await response.json();
    expect(payload.query).toBe(`language:${language} category:${category} ${tagType}:"${tagName}"`);
    expect(payload.result.length).toBeGreaterThan(0);
    expect(payload.result.every((item: { tags: Array<{ type?: string; name?: string; slug?: string }> }) => {
      const values = item.tags.map((tag) => `${tag.type}:${tag.name || tag.slug || ""}`);
      return values.includes(`${tagType}:${tagName}`)
        && values.includes(`language:${language}`)
        && values.includes(`category:${category}`);
    })).toBeTruthy();
  });

  test("横向作品详情封面按原比例贴边显示", async ({ page, request }) => {
    const response = await request.get("/api/library/search?page=1&per_page=100");
    const work = (await response.json()).result.find((item: { id: number }) => item.id === Number(LANDSCAPE_WORK_ID));
    expect(work?.remote_gallery_id).toBeTruthy();
    await page.goto(`/#gallery/${work.remote_gallery_id}`);

    const cover = page.locator(".folio-gallery-cover-slot");
    const image = cover.locator(".folio-ambient-cover-artwork");
    await expect(image).toBeVisible();
    await expect(image).toHaveCSS("object-fit", "contain");
    await expectExactCoverRatios(cover);
    await cover.screenshot({ path: "/tmp/nh-archive-landscape-cover.png" });
  });

  test("移动端作品详情 Tag 文字视觉居中", async ({ page, request }) => {
    const popularResponse = await request.get("/api/discover/popular");
    expect(popularResponse.ok()).toBeTruthy();
    const galleryId = (await popularResponse.json()).result[0]?.gallery_id as number | undefined;
    expect(galleryId).toBeTruthy();
    await page.goto(`/#gallery/${galleryId}`);

    const tag = page.locator(".folio-gallery-tag-group a").first();
    await expect(tag).toBeVisible({ timeout: 15_000 });
    await expect(tag).toHaveCSS("align-items", "center");
    await expect(tag).toHaveCSS("justify-content", "center");
    await expect(tag).toHaveCSS("text-align", "center");
    const centerOffset = await tag.evaluate((link) => {
      const text = link.querySelector("span")!.getBoundingClientRect();
      const box = link.getBoundingClientRect();
      return ((text.left + text.right) / 2) - ((box.left + box.right) / 2);
    });
    expect(Math.abs(centerOffset)).toBeLessThanOrEqual(1);
    await page.locator(".folio-gallery-tags").screenshot({ path: "/tmp/nh-archive-gallery-tags-mobile.png" });
  });
});

async function expectCenteredTag(tag: Locator) {
  await expect(tag).toBeVisible();
  await expect(tag).toHaveCSS("align-items", "center");
  await expect(tag).toHaveCSS("justify-content", "center");
}

async function expectExactCoverRatios(frames: Locator) {
  const metrics = await frames.evaluateAll((nodes) => nodes.map((node) => {
    const image = node.querySelector<HTMLImageElement>(".folio-ambient-cover-artwork")!;
    const style = getComputedStyle(image);
    return {
      frame: node.clientWidth / node.clientHeight,
      image: image.naturalWidth / image.naturalHeight,
      padding: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft],
    };
  }));
  expect(metrics.length).toBeGreaterThan(0);
  expect(metrics.every((item) => Math.abs(item.frame - item.image) <= 0.015)).toBeTruthy();
  expect(metrics.every((item) => item.padding.every((value) => Number.parseFloat(value) === 0))).toBeTruthy();
}
