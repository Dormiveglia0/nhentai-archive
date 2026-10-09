import { Bell, Mail, Pause, Play, RefreshCw, Trash2, ArrowUpRight } from "lucide-react";
import { useState } from "react";

import { api, type CreatorSubscription } from "../../lib/api";
import { parseUtcTimestamp } from "../../lib/format";
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

export function SubscriptionsPanel({ blurCovers }: { blurCovers: boolean }) {
  const vm = useCreatorSubscriptions(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function mutate(action: () => Promise<unknown>, feedback = "订阅已更新") {
    setBusy(true); setError(""); setMessage("");
    try { await action(); vm.refresh(); setMessage(feedback); }
    catch (exc) { setError(exc instanceof Error ? exc.message : String(exc)); }
    finally { setBusy(false); }
  }

  return <section className="folio-notifications" aria-label="订阅管理">
    <div className="folio-settings-subhead"><h3><Bell size={16} />作者与社团订阅</h3><button className="folio-settings-mini-action" type="button" aria-label="刷新订阅" onClick={() => { vm.refresh(); }}><RefreshCw size={15} /></button></div>
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
        <div className="folio-subscription-preview" aria-label={subscription.name + "的近期作品"}>
          {subscription.recent_galleries?.length ? subscription.recent_galleries.map(gallery => {
            const title = gallery.title_japanese || gallery.pretty_title || gallery.title;
            return <a key={gallery.gallery_id} href={pageHref({ name: "gallery", galleryId: gallery.gallery_id, returnTo: "discover?view=subscriptions" })}>
              <div>{gallery.thumbnail.url ? <AmbientCover src={gallery.thumbnail.url} alt="" privateBlur={blurCovers} loading="lazy" /> : <Bell size={18} />}</div>
              <span><strong title={title}>{title}</strong><small>{gallery.page_count} 页{gallery.imported ? " · 已导入" : ""}</small></span>
            </a>;
          }) : <p className="folio-subscription-preview-empty">{!subscription.baseline_complete ? "正在读取近期作品…" : "暂无近期作品"}</p>}
        </div>
      </article>)}
    </fieldset>}

    <a className="folio-subscription-mail-settings" href="#settings?section=notifications"><Mail size={15} />邮件设置<ArrowUpRight size={14} /></a>
  </section>;
}
