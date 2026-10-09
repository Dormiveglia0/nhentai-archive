import { expect, test } from '@playwright/test';
const workId = process.env.E2E_BRIDGE_WORK_ID;
test.skip(!workId, '需要实际已逐页核验一致的作品及自有缓存库');
for (const width of [1440, 390]) test(`${width}px 慢本地先读取远端，解码后交接保留位置及阅读会话`, async ({page, request}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({width,height:width === 390 ? 844 : 1000});
  const proof = await (await request.get(`/api/works/${workId}/bridge`)).json();
  expect(proof.eligible).toBe(true);
  await request.patch(`/api/works/${workId}/reader-state`, {data:{page_index:1,completed:false}});
  await request.post('/api/library/cache/clear');
  let releaseSource!: () => void, releaseImage!: () => void;
  const sourceGate = new Promise<void>(resolve => {releaseSource=resolve;});
  const imageGate = new Promise<void>(resolve => {releaseImage=resolve;});
  const leases = new Set<string>(), remotePages = new Set<number>();
  let sessions = 0;
  page.on('request', value => {
    const path = new URL(value.url()).pathname;
    if (path === `/api/works/${workId}/reading-sessions` && value.method() === 'POST') sessions++;
    if (path.includes('/bridge/pages/')) remotePages.add(Number(path.split('/').at(-1)));
  });
  await page.route(`**/api/works/${workId}/reading-source`, async route => {
    const response=await route.fetch(), actual=await response.json();
    if (actual.lease) leases.add(actual.lease);
    if (actual.status==='ready') await sourceGate;
    await route.fulfill({response});
  });
  await page.route(new RegExp(`/api/works/${workId}/pages/3\\?lease=`),async route => {
    const response=await route.fetch(); await imageGate; await route.fulfill({response});
  });
  try {
    await page.goto(`/#reader/${workId}`);
    await expect(page.locator('img[src*="/bridge/pages/"]').first()).toBeVisible();
    await page.getByRole('button',{name:'阅读设置',exact:true}).click();
    await page.getByRole('button',{name:'连续',exact:true}).click(); await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'阅读设置',exact:true}).blur();
    await page.keyboard.press('g'); await page.getByRole('textbox',{name:'目标页码'}).fill('3');
    await page.getByRole('button',{name:'跳转',exact:true}).click();
    const image=page.locator('.reader-webtoon img[data-page-index="3"]');
    await expect.poll(()=>image.evaluate((node:HTMLImageElement)=>node.naturalWidth>0)).toBe(true);
    await image.evaluate(node=>{node.setAttribute('data-handover-check','same-node');});
    const viewport=page.locator('.reader-viewport'), before=await viewport.evaluate(node=>node.scrollTop);
    expect(remotePages.size).toBeLessThan(12);
    releaseSource(); await page.waitForTimeout(1200);
    await expect(image).toHaveAttribute('src',/\/bridge\/pages\/3\?/);
    releaseImage();
    await expect(image).toHaveAttribute('src',/\/pages\/3\?lease=/);
    await expect(image).toHaveAttribute('data-handover-check','same-node');
    expect(Math.abs(await viewport.evaluate(node=>node.scrollTop)-before)).toBeLessThan(2);
    expect(sessions).toBe(1);
    await page.evaluate(()=>{window.location.hash='library';});
    await expect(page.locator('.reader-shell')).toHaveCount(0);
    await expect.poll(async()=>(await (await request.get(`/api/works/${workId}/reader-state`)).json()).page_index).toBe(3);
    await expect.poll(async()=>(await (await request.get('/api/library/cache')).json()).active_count).toBe(0);
  } finally {
    releaseSource();releaseImage();
    for(const lease of leases) await request.delete(`/api/works/${workId}/reading-source/${lease}`).catch(() => undefined);
  }
});
