import { expect, test } from "@playwright/test";
test.skip(!process.env.E2E_STORAGE_STATE, "需要独立测试会话");

test("未缓存的页面模块加载时，占位不继承红色进度条样式", async ({ page }) => {
  let release = () => {};
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route(/\/(?:assets\/TasksPage-[^/]+\.js|src\/components\/tasks\/TasksPage\.tsx)(?:\?.*)?$/, async route => { await held; await route.continue(); });
  try {
    await page.goto('/#library');
    await expect(page.locator('.folio-library-card-title').first()).toBeVisible();
    await page.locator('.folio-topnav a[href="#tasks"]').click();
    const loading = page.locator('.folio-route-loading');
    await expect(loading).toBeVisible();
    await expect(loading).toHaveCSS('position','static');
    await expect(loading).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
    await expect(loading).toHaveCSS('transform','none');
    release();
    await expect(page.locator('.folio-tasks-page')).toBeVisible();
    await expect(loading).toHaveCount(0);
  } finally { release(); }
});

test("快速打断跨项切换时，指示条始终在导航内部并到达最终选项", async ({ page }) => {
  await page.goto('/#library');
  await expect(page.locator('.folio-library-card-title').first()).toBeVisible();
  const samples = await page.evaluate(async () => {
    const group = document.querySelector('.folio-topnav')!;
    const samples: Array<{x:number;y:number;right:number;width:number}> = [];
    for(const [index, route] of ['settings','discover','tasks','library'].entries()) {
      (group.querySelector('a[href="#'+route+'"]') as HTMLElement).click();
      for(let frame=0; frame < (index === 3 ? 30 : 4); frame++) {
        await new Promise(requestAnimationFrame);
        const rect = group.querySelector('.folio-slide-indicator')!.getBoundingClientRect();
        const bounds = group.getBoundingClientRect();
        samples.push({x:rect.x-bounds.x,y:rect.y-bounds.y,right:rect.right-bounds.x,width:bounds.width});
      }
    }
    return samples;
  });
  expect(samples.length).toBeGreaterThan(20);
  expect(samples.every(sample=>sample.x>=-1 && sample.y>=-1 && sample.right<=sample.width+1)).toBe(true);
  await expect(page.locator('.folio-topnav a[href="#library"]')).toHaveAttribute('aria-current','page');
  await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.folioSlide)).toBeUndefined();
});
