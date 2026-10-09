import { mkdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const root = process.env.E2E_METADATA_ROOT ?? "";
const galleryId = Number(process.env.E2E_METADATA_GALLERY_ID);
const workId = Number(process.env.E2E_METADATA_WORK_ID);
const fixturePath = process.env.E2E_SMTP_FIXTURE ?? "";
const artifacts = process.env.E2E_SUBSCRIPTIONS_ARTIFACT_DIR;
test.skip(!(root === "/tmp/nh-reader-media-update-20261009/owned" || root.startsWith("/tmp/nh-media-update-20261009/metadata-browser-owned-")) || !galleryId || !workId ||
  !(fixturePath.startsWith("/tmp/nh-reader-media-update-20261009/smtp-owned-loopback/") || fixturePath.startsWith("/tmp/nh-media-update-20261009/smtp-owned-loopback/")), "Requires the owned actual archive and loopback SMTP receiver");

async function received(root: string): Promise<{ security: string; message_id: string; recipients: string[] }[]> {
  try { return (await readFile(join(root, "received.jsonl"), "utf8")).trim().split("\n").filter(Boolean).map(line => JSON.parse(line)); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
}

test("实际 SMTP 明文、STARTTLS、SSL 发送与密码隐藏", async ({ page, request }) => {
  test.setTimeout(60_000);
  const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
  const initial = await (await request.get("/api/settings/smtp")).json();
  expect(initial.password_configured).toBe(false);
  expect(initial.enabled).toBe(false);
  const { password_configured: _configured, last_test: _test, ...restore } = initial;
  const before = (await received(fixture.root)).length;
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    await page.goto("/#settings?section=notifications");
    const smtp = page.getByRole("region", { name: "邮件通知", exact: true });
    for (const security of ["none", "starttls", "ssl"] as const) {
      if (security === "none") {
        await smtp.locator(".folio-toggle-row").filter({ hasText: "开启邮件通知" }).click();
        await smtp.getByLabel("SMTP服务器", { exact: true }).fill("127.0.0.1");
        await smtp.getByLabel("发件邮箱", { exact: true }).fill("archive@localhost.test");
        await smtp.getByLabel("收件邮箱", { exact: true }).fill("verify@localhost.test");
        await smtp.getByLabel("SMTP密码", { exact: true }).fill("owned-qa-password");
        await smtp.getByLabel("网站地址（可选，用于邮件内链接）", { exact: true }).fill("http://127.0.0.1:8004");
      }
      await smtp.getByRole("button", { name: /^连接方式：/ }).click();
      await smtp.getByRole("group", { name: "连接方式选项" }).getByRole("button", { name: { none: "不加密", starttls: "STARTTLS", ssl: "SSL / TLS" }[security], exact: true }).click();
      await smtp.getByLabel("端口", { exact: true }).fill(String(fixture.ports[security]));
      await expect(smtp.getByRole("button", { name: "发送测试邮件", exact: true })).toBeDisabled();
      const saved = page.waitForResponse(response => response.url().endsWith("/api/settings/smtp") && response.request().method() === "PATCH");
      await smtp.getByRole("button", { name: "保存邮件设置", exact: true }).click();
      const config = await (await saved).json();
      expect(config).toMatchObject({ enabled: true, security, password_configured: true });
      expect(config.password).toBeUndefined();
      expect(JSON.stringify(config)).not.toContain("owned-qa-password");
      await expect(smtp.getByLabel("SMTP密码", { exact: true })).toHaveValue("");
      const tested = page.waitForResponse(response => response.url().endsWith("/api/settings/smtp/test"));
      await smtp.getByRole("button", { name: "发送测试邮件", exact: true }).click();
      expect(await (await tested).json()).toMatchObject({ ok: true });
      await expect(smtp.getByRole("status")).toContainText("已发送");
      expect((await received(fixture.root)).at(-1)).toMatchObject({ security, recipients: ["verify@localhost.test"] });
    }
    expect((await received(fixture.root)).length).toBe(before + 3);
    expect(await smtp.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    if (artifacts) { await mkdir(artifacts, { recursive: true }); await smtp.screenshot({ path: join(artifacts, "smtp-1440.png") }); }
    expect(errors).toEqual([]);
  } finally {
    expect((await request.patch("/api/settings/smtp", { data: { ...restore, clear_password: true } })).ok()).toBe(true);
  }
});

for (const width of [1440, 390]) {
  test(width + "px 实际作者/社团订阅、检查、更新、邮件与阅读入口", async ({ page, request, context }) => {
    test.setTimeout(150_000);
    const libraries = await (await request.get("/api/library/directories")).json();
    expect(libraries.result.some((library: { root_path: string }) => library.root_path === join(root, "media"))).toBe(true);
    const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
    const initial = await (await request.get("/api/settings/smtp")).json();
    expect(initial.enabled).toBe(false);
    expect(initial.password_configured).toBe(false);
    const { password_configured: _configured, last_test: _test, ...restore } = initial;
    const gallery = await (await request.get("/api/discover/galleries/" + galleryId)).json();
    const type = width === 1440 ? "artist" : "group";
    const tag = gallery.tags.filter((tag: { type: string }) => tag.type === type)
      .sort((a: { count: number }, b: { count: number }) => a.count - b.count)[0];
    expect(tag?.id).toBeGreaterThan(0);
    expect(tag.count).toBeLessThanOrEqual(100);
    const display = tag.display || tag.name;
    const creator = (type === "artist" ? "作者 " : "社团 ") + display;
    const initialSubs = await (await request.get("/api/subscriptions")).json();
    expect(initialSubs.result.some((subscription: { remote_tag_id: number }) => subscription.remote_tag_id === tag.id)).toBe(false);
    const clean = spawnSync("/opt/nhentai/.venv/bin/python", ["-c", "import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); c.execute('PRAGMA foreign_keys=ON'); c.execute('DELETE FROM creator_subscriptions WHERE remote_tag_id=? AND tag_type=? AND removed_at IS NOT NULL', (int(sys.argv[2]),sys.argv[3])); c.commit(); c.close()", join(root, "data", "archive.db"), String(tag.id), type], { encoding: "utf8" });
    expect(clean.status, clean.stderr).toBe(0);
    let subscriptionId: number | undefined;
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    try {
      expect((await request.patch("/api/settings/smtp", { data: { enabled: true, host: "127.0.0.1", port: fixture.ports.none,
        security: "none", sender: "archive@localhost.test", recipient: "verify@localhost.test", site_url: "http://127.0.0.1:8004" } })).ok()).toBe(true);
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await page.goto("/#gallery/" + galleryId);
      const tags = page.locator(".folio-gallery-tags");
      await expect(tags.getByRole("heading", { name: "作者", exact: true })).toBeVisible();
      await expect(tags.getByRole("heading", { name: "社团", exact: true })).toBeVisible();
      const created = page.waitForResponse(response => response.url().endsWith("/api/subscriptions") && response.request().method() === "POST");
      await tags.getByRole("button", { name: "订阅" + creator, exact: true }).click();
      const subscription = await (await created).json();
      expect(subscription).toMatchObject({ remote_tag_id: tag.id, tag_type: type, email_enabled: true });
      subscriptionId = subscription.id;
      await expect(tags.getByRole("button", { name: "取消订阅" + creator, exact: true })).toHaveAttribute("aria-pressed", "true");
      await expect.poll(async () => (await (await request.get("/api/subscriptions")).json()).result.find((item: { id: number }) => item.id === subscriptionId)?.baseline_complete,
        { timeout: 20_000 }).toBe(true);
      expect((await (await request.get("/api/subscriptions/updates")).json()).result.filter((item: { subscription_id: number }) => item.subscription_id === subscriptionId)).toHaveLength(0);
      await page.goto("/#discover?view=subscriptions");
      const section = page.getByRole("region", { name: "订阅管理", exact: true });
      const row = section.locator(".folio-subscriptions-list article").filter({ has: page.getByRole("link", { name: creator, exact: true }) });
      await expect(row).toContainText("上次检查");
      await row.getByRole("button", { name: "暂停订阅 " + tag.name, exact: true }).click();
      await expect(row).toContainText("已暂停");
      await row.getByRole("button", { name: "启用订阅 " + tag.name, exact: true }).click();
      await expect(row).toContainText("上次检查", { timeout: 12_000 });
      await row.getByRole("button", { name: /^检查间隔：/ }).click();
      await row.getByRole("group", { name: "检查间隔选项" }).getByRole("button", { name: "每3天", exact: true }).click();
      await expect(row.getByRole("button", { name: /^检查间隔：/ })).toContainText("每3天");
      const feed = await (await request.get("/api/discover/tagged?tag_id=" + tag.id + "&per_page=100&sort=date")).json();
      const newest = feed.result[0].gallery_id;
      expect(newest).toBeGreaterThan(0);
      // Replay the immediately older baseline using actual upstream IDs in this owned database.
      const baseline = spawnSync("/opt/nhentai/.venv/bin/python", ["-c", "import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); c.execute('BEGIN IMMEDIATE'); r=c.execute('DELETE FROM subscription_seen WHERE subscription_id=? AND gallery_id=?', (int(sys.argv[2]),int(sys.argv[3]))); assert r.rowcount==1; c.execute('UPDATE creator_subscriptions SET revision=revision+1 WHERE id=?', (int(sys.argv[2]),)); c.commit(); c.close()", join(root, "data", "archive.db"), String(subscriptionId), String(newest)], { encoding: "utf8" });
      expect(baseline.status, baseline.stderr).toBe(0);
      await row.getByRole("button", { name: "检查", exact: true }).click();
      await expect.poll(async () => (await (await request.get("/api/subscriptions/updates")).json()).result.filter((item: { subscription_id: number; gallery_id: number }) => item.subscription_id === subscriptionId && item.gallery_id === newest).length,
        { timeout: 20_000 }).toBe(1);
      await expect.poll(async () => (await (await request.get("/api/settings/smtp/outbox")).json()).result.find((mail: { subscription_id: number }) => mail.subscription_id === subscriptionId)?.status,
        { timeout: 20_000 }).toBe("sent");
      await page.goto("/#discover?view=updates");
      const updates = page.getByRole("region", { name: "作品更新", exact: true });
      await expect(updates.locator('.folio-subscription-update-link[href^="#gallery/' + newest + '"]')).toContainText(feed.result[0].title_japanese || feed.result[0].pretty_title || feed.result[0].title, { timeout: 12_000 });
      expect(await updates.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      expect(await updates.locator(".folio-subscription-filters button").first().evaluate(element => getComputedStyle(element).borderRadius)).toBe("0px");
      if (artifacts) { await mkdir(artifacts, { recursive: true }); await updates.screenshot({ path: join(artifacts, "subscriptions-" + width + ".png") }); }
      const updatedLink = updates.locator('.folio-subscription-update-link[href^="#gallery/' + newest + '"]');
      const opened = context.waitForEvent("page");
      await updatedLink.click({ modifiers: ["Control"] });
      const otherPage = await opened;
      await expect(otherPage).toHaveURL(new RegExp("#gallery/" + newest));
      await otherPage.close();
      await expect.poll(async () => (await (await request.get("/api/subscriptions/updates")).json()).result.find((item: { subscription_id: number }) => item.subscription_id === subscriptionId)?.read_at).toBeTruthy();
      await page.goto("/#library");
      await page.locator('.folio-library-card-title[href="#reader/' + workId + '"]').click();
      const dialog = page.locator(".folio-work-dialog");
      await expect(dialog.getByRole("button", { name: "取消订阅" + creator, exact: true })).toBeVisible();
      await dialog.locator("a.is-primary").click();
      await expect(page.locator(".reader-counter")).toContainText("/");
      await page.getByRole("button", { name: "作品信息", exact: true }).click();
      await expect(page.locator(".reader-info-panel").getByRole("button", { name: "取消订阅" + creator, exact: true })).toBeVisible();
      await page.goto("/#discover?view=subscriptions");
      await section.locator(".folio-subscriptions-list").getByRole("button", { name: "取消订阅 " + tag.name, exact: true }).click();
      await expect(row).toHaveCount(0);
      expect(errors).toEqual([]);
    } finally {
      if (subscriptionId) await request.delete("/api/subscriptions/" + subscriptionId);
      expect((await request.patch("/api/settings/smtp", { data: { ...restore, clear_password: true } })).ok()).toBe(true);
    }
  });
}
