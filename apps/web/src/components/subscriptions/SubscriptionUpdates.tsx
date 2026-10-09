import { Bell, Check, ChevronLeft, ChevronRight, RefreshCw, ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { SlidingIndicator } from "../../lib/motion";
import { pageHref } from "../../lib/navigation";
import { AmbientCover } from "../folio/ui/AmbientCover";
import { useSubscriptionUpdates } from "./useSubscriptionUpdates";
import "../settings/NotificationSection.css";

export function SubscriptionUpdates({ blurCovers }: { blurCovers: boolean }) {
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { updates, loading, error, refresh } = useSubscriptionUpdates(page, unreadOnly);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (updates && page > Math.max(1, Math.ceil(updates.total / updates.per_page))) setPage(Math.max(1, Math.ceil(updates.total / updates.per_page)));
  }, [updates, page]);
  async function read(id?: number) {
    setActionError("");
    try { await api.readSubscriptionUpdates(id); }
    catch (reason) { setActionError(reason instanceof Error ? reason.message : String(reason)); }
  }
  return <section className="folio-notifications" aria-label="作品更新">
    <header className="folio-settings-subhead"><h3>作品更新{updates?.unread_count ? <span className="folio-unread-count">{updates.unread_count}</span> : null}</h3>
      <button className="folio-settings-mini-action" type="button" disabled={!updates?.unread_count} onClick={() => void read()}><Check size={14} />全部已读</button>
    </header>
    <div className="folio-subscription-filters">
      {[{ value: false, label: "全部" }, { value: true, label: "未读" }].map(filter => <button key={filter.label} type="button" aria-pressed={unreadOnly === filter.value} className={unreadOnly === filter.value ? "is-active" : ""} onClick={() => { setUnreadOnly(filter.value); setPage(1); }}>
        {unreadOnly === filter.value ? <SlidingIndicator className="folio-control-active" layoutId="subscription-updates-filter" /> : null}<span>{filter.label}</span>
      </button>)}
    </div>
    {notice ? <p className="folio-media-feedback" role="status">{notice}<a href="#tasks">查看队列</a></p> : null}
    {error || actionError ? <p className="folio-media-error" role="alert">{error || actionError}<button className="folio-settings-mini-action" type="button" aria-label="重试读取更新" onClick={refresh}><RefreshCw size={15} /></button></p> : null}
    <div className="folio-subscription-updates" aria-busy={loading}>
      {updates?.result.map(update => {
        const gallery = update.gallery, title = gallery.title_japanese || gallery.pretty_title || gallery.title;
        return <article className={update.read_at ? "is-read" : ""} key={update.id}>
          <a className="folio-subscription-update-link" href={pageHref({ name: "gallery", galleryId: update.gallery_id, returnTo: "discover?view=updates" })}
            onClick={() => void read(update.id)} onAuxClick={event => { if (event.button === 1) void read(update.id); }}>
            <div className="folio-subscription-update-cover">{gallery.thumbnail.url ? <AmbientCover className="folio-subscription-thumb is-fill-portrait" src={gallery.thumbnail.url} alt="" privateBlur={blurCovers} loading="lazy" /> : <Bell size={18} />}</div>
            <div><strong title={title}>{title}</strong><span>{update.name} · {gallery.page_count} 页</span></div>
            {!update.read_at ? <i aria-label="未读" /> : null}
          </a>
          <div className="folio-subscription-update-actions">
            {gallery.work_id ? <a href={pageHref({ name: "reader", workId: gallery.work_id })}>阅读</a> : <button type="button" disabled={busy} onClick={async () => {
              setBusy(true); setActionError(""); setNotice("");
              try { await api.importGallery(update.gallery_id); setNotice("导入已加入队列"); refresh(); }
              catch (reason) { setActionError(reason instanceof Error ? reason.message : String(reason)); }
              finally { setBusy(false); }
            }}>导入</button>}
            {!update.read_at ? <button type="button" onClick={() => void read(update.id)}>标记已读</button> : null}
          </div>
        </article>;
      })}
      {!updates && loading ? <div className="folio-updates-loading" role="status">正在读取更新…<i /><i /></div> : !updates?.result.length && !error ? <div className="folio-updates-empty"><Bell size={22} strokeWidth={1.25} /><p>{unreadOnly ? "没有未读更新" : "暂无作品更新"}</p><a href="#discover?view=subscriptions">管理订阅<ArrowUpRight size={15} /></a></div> : null}
    </div>
    {updates && updates.total > updates.per_page ? <div className="folio-media-pager">
      <button type="button" aria-label="上一页更新" disabled={loading || page <= 1} onClick={() => setPage(value => value - 1)}><ChevronLeft size={17} /></button><span>{page} / {Math.ceil(updates.total / updates.per_page)}</span>
      <button type="button" aria-label="下一页更新" disabled={loading || page * updates.per_page >= updates.total} onClick={() => setPage(value => value + 1)}><ChevronRight size={17} /></button>
    </div> : null}
  </section>;
}
