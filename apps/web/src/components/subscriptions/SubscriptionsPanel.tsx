import { Bell, Check, ChevronLeft, ChevronRight, Mail, Pause, Play, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { api, type CreatorSubscription } from "../../lib/api";
import { parseUtcTimestamp } from "../../lib/format";
import { SlidingIndicator } from "../../lib/motion";
import { pageHref, tagSearchHref } from "../../lib/navigation";
import { AmbientCover } from "../folio/ui/AmbientCover";
import { FolioSelect } from "../folio/ui/FolioPrimitives";
import { useCreatorSubscriptions } from "../subscriptions/CreatorSubscribeButton";
import "../settings/NotificationSection.css";

const INTERVALS = [{ value: "86400", label: "每1天" }, { value: "259200", label: "每3天" }, { value: "604800", label: "每7天" }];

function subscriptionStatus(subscription: CreatorSubscription) {
  if (!subscription.enabled) return "已暂停";
  if (subscription.status === "error") return "检查失败";
  if (!subscription.baseline_complete) return (subscription.status === "checking" ? "正在初始化" : "等待初始化") + " · 已读取" + (subscription.seen_count ?? 0) + "部";
  if (subscription.status === "checking") return "正在检查";
  if (subscription.status === "queued") return "等待检查";
  return subscription.last_checked_at ? "上次检查 " + (parseUtcTimestamp(subscription.last_checked_at)?.toLocaleString() ?? "—") : "等待检查";
}

export function SubscriptionsPanel({ blurCovers, view }: { blurCovers: boolean; view: "updates" | "subscriptions" }) {
  const vm = useCreatorSubscriptions(view === "subscriptions");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [updates, setUpdates] = useState<Awaited<ReturnType<typeof api.subscriptionUpdates>> | null>(null);
  const [updatesError, setUpdatesError] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [updatesLoading, setUpdatesLoading] = useState(true);

  useEffect(() => {
    if (view !== "updates") return;
    let alive = true;
    let timer = 0;
    setUpdatesLoading(true);
    async function load() {
      if (!alive) return;
      if (!document.hidden && !document.querySelector<HTMLElement>(".app-route-archive")?.inert) {
        try {
          const result = await api.subscriptionUpdates(page, unreadOnly);
          if (alive) {
            const lastPage = Math.max(1, Math.ceil(result.total / result.per_page));
            if (page > lastPage) { setPage(lastPage); return; }
            setUpdates(result); setUpdatesError("");
          }
        } catch (exc) { if (alive) setUpdatesError(exc instanceof Error ? exc.message : String(exc)); }
        finally { if (alive) setUpdatesLoading(false); }
      }
      if (alive) timer = window.setTimeout(load, 5000);
    }
    void load();
    return () => { alive = false; window.clearTimeout(timer); };
  }, [page, unreadOnly, revision, view]);

  async function mutate(action: () => Promise<unknown>, feedback = "订阅已更新") {
    setBusy(true); setError(""); setMessage("");
    try { await action(); vm.refresh(); setRevision(value => value + 1); setMessage(feedback); }
    catch (exc) { setError(exc instanceof Error ? exc.message : String(exc)); }
    finally { setBusy(false); }
  }

  async function read(id?: number) {
    try { await api.readSubscriptionUpdates(id); setRevision(value => value + 1); vm.refresh(); }
    catch (exc) { setUpdatesError(exc instanceof Error ? exc.message : String(exc)); }
  }

  return <section className="folio-notifications" aria-label={view === "subscriptions" ? "订阅管理" : "作品更新"}>
    {view === "subscriptions" ? <>
    <div className="folio-settings-subhead"><h3><Bell size={16} />作者与社团订阅</h3><button className="folio-settings-mini-action" type="button" aria-label="刷新订阅" onClick={() => { vm.refresh(); setRevision(value => value + 1); }}><RefreshCw size={15} /></button></div>
    {error || vm.error ? <p className="folio-media-error" role="alert">{error || vm.error}</p> : null}
    {message ? <p className="folio-media-feedback" role="status">{message}</p> : null}
    {!vm.subscriptions.length ? <p className="folio-media-hint">{vm.loading ? "正在读取订阅…" : "尚未订阅。从作品的作者或社团标签旁开启订阅。"}</p> : <fieldset className="folio-subscriptions-list" disabled={busy || vm.loading}>
      {vm.subscriptions.map(subscription => <article key={subscription.id}>
        <div className="folio-subscription-main">
          <a href={tagSearchHref({ id: subscription.remote_tag_id, type: subscription.tag_type, name: subscription.name, slug: subscription.slug })} title={subscription.name}><span>{subscription.tag_type === "artist" ? "作者" : "社团"}</span><strong>{subscription.name}</strong></a>
          <p>{subscriptionStatus(subscription)}</p>
          {subscription.last_error ? <p className="folio-media-error">{subscription.last_error}</p> : null}
        </div>
        <FolioSelect label="检查间隔" value={String(subscription.interval_seconds)} options={INTERVALS}
          onChange={value => void mutate(() => api.updateSubscription(subscription.id, { interval_seconds: Number(value) }))} />
        <div className="folio-media-actions">
          <button className="folio-settings-mini-action" type="button" disabled={!subscription.enabled || subscription.status === "checking" || subscription.status === "queued"} onClick={() => void mutate(() => api.checkSubscription(subscription.id))}><RefreshCw size={14} />检查</button>
          <button className="folio-settings-mini-action" type="button" aria-label={(subscription.enabled ? "暂停订阅 " : "启用订阅 ") + subscription.name} onClick={() => void mutate(() => api.updateSubscription(subscription.id, { enabled: !subscription.enabled }))}>{subscription.enabled ? <Pause size={14} /> : <Play size={14} />}</button>
          <button className="folio-settings-mini-action" type="button" aria-label={"邮件通知 " + subscription.name} aria-pressed={subscription.email_enabled} onClick={() => void mutate(() => api.updateSubscription(subscription.id, { email_enabled: !subscription.email_enabled }))}><Mail size={14} /></button>
          <button className="folio-settings-mini-action is-danger" type="button" aria-label={"取消订阅 " + subscription.name} onClick={() => void mutate(() => api.unsubscribeCreator(subscription.id))}><Trash2 size={14} /></button>
        </div>
      </article>)}
    </fieldset>}

    </> : <>
    <div className="folio-settings-subhead"><h3>作品更新{updates?.unread_count ? " · " + updates.unread_count + " 未读" : ""}</h3><button className="folio-settings-mini-action" type="button" disabled={!updates?.unread_count} onClick={() => void read()}><Check size={14} />全部已读</button></div>
    <div className="folio-subscription-filters">
      {[{ value: false, label: "全部" }, { value: true, label: "未读" }].map(filter => <button key={filter.label} type="button" aria-pressed={unreadOnly === filter.value} className={unreadOnly === filter.value ? "is-active" : ""} onClick={() => { setUnreadOnly(filter.value); setPage(1); }}>
        {unreadOnly === filter.value ? <SlidingIndicator className="folio-control-active" layoutId="subscription-updates-filter" /> : null}<span>{filter.label}</span>
      </button>)}
    </div>
    {updatesError ? <p className="folio-media-error" role="alert">{updatesError}</p> : null}
    <div className="folio-subscription-updates" aria-busy={updatesLoading}>
      {updates?.result.map(update => {
        const gallery = update.gallery;
        const title = gallery.title_japanese || gallery.pretty_title || gallery.title;
        return <article className={update.read_at ? "is-read" : ""} key={update.id}>
          <a className="folio-subscription-update-link" href={pageHref({ name: "gallery", galleryId: update.gallery_id, returnTo: "discover?view=updates" })} onClick={() => void read(update.id)} onAuxClick={event => { if (event.button === 1) void read(update.id); }}>
            <div className="folio-subscription-update-cover">{gallery.thumbnail.url ? <AmbientCover className="folio-subscription-thumb is-fill-portrait" src={gallery.thumbnail.url} alt="" privateBlur={blurCovers} loading="lazy" /> : <Bell size={18} />}</div>
            <div><strong title={title}>{title}</strong><span>{update.tag_type === "artist" ? "作者 " : "社团 "}{update.name} · {gallery.page_count} 页</span></div>
            {!update.read_at ? <i aria-label="未读" /> : null}
          </a>
          <div className="folio-subscription-update-actions">
            {gallery.work_id ? <a href={pageHref({ name: "reader", workId: gallery.work_id })}>阅读</a> : <button type="button" disabled={busy} onClick={() => void mutate(() => api.importGallery(update.gallery_id), "导入已加入队列")}>导入</button>}
            {!update.read_at ? <button type="button" onClick={() => void read(update.id)}>标记已读</button> : null}
          </div>
        </article>;
      })}
      {!updatesLoading && !updates?.result.length ? <p className="folio-media-hint">{unreadOnly ? "没有未读更新" : "暂无作品更新"}</p> : null}
    </div>
    {updates && updates.total > updates.per_page ? <div className="folio-media-pager">
      <button type="button" aria-label="上一页更新" disabled={updatesLoading || page <= 1} onClick={() => setPage(value => value - 1)}><ChevronLeft size={17} /></button><span>{page} / {Math.ceil(updates.total / updates.per_page)}</span>
      <button type="button" aria-label="下一页更新" disabled={updatesLoading || page * updates.per_page >= updates.total} onClick={() => setPage(value => value + 1)}><ChevronRight size={17} /></button>
    </div> : null}
    </>}
    <a className="folio-subscription-mail-settings" href="#settings?section=notifications"><Mail size={15} />邮件设置</a>
  </section>;
}
