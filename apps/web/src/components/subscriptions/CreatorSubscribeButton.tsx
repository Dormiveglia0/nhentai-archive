import { Bell, BellPlus, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { api, type CreatorSubscription } from "../../lib/api";
import "./CreatorSubscribeButton.css";

type CreatorTag = { id: number | null; type?: string; display?: string; name?: string };

export function isCreatorTag(tag: CreatorTag): tag is CreatorTag & { id: number; type: "artist" | "group" } {
  return Number.isInteger(tag.id) && Number(tag.id) > 0 && (tag.type === "artist" || tag.type === "group");
}

export function useCreatorSubscriptions(enabled: boolean) {
  const [subscriptions, setSubscriptions] = useState<CreatorSubscription[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [busyTag, setBusyTag] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let timer = 0;
    setLoading(true);
    async function load() {
      if (!alive) return;
      if (!document.hidden) {
        try {
          const payload = await api.creatorSubscriptions();
          if (alive) { setSubscriptions(payload.result); setLoadError(""); }
        } catch (exc) { if (alive) setLoadError(exc instanceof Error ? exc.message : String(exc)); }
        finally { if (alive) setLoading(false); }
      }
      if (alive) timer = window.setTimeout(load, 5000);
    }
    void load();
    return () => { alive = false; window.clearTimeout(timer); };
  }, [enabled, revision]);

  async function toggle(tag: CreatorTag) {
    if (!isCreatorTag(tag) || busyTag) return;
    const existing = subscriptions.find(subscription => subscription.remote_tag_id === tag.id && subscription.tag_type === tag.type);
    setBusyTag(tag.type + ":" + tag.id);
    setError("");
    try {
      if (existing?.enabled) await api.unsubscribeCreator(existing.id);
      else if (existing) await api.updateSubscription(existing.id, { enabled: true });
      else await api.subscribeCreator(tag.id, tag.type);
      setRevision(value => value + 1);
    } catch (exc) { setError(exc instanceof Error ? exc.message : String(exc)); }
    finally { setBusyTag(null); }
  }
  return { subscriptions, loading, busyTag, error: error || loadError, toggle, refresh: () => setRevision(value => value + 1) };
}

export function CreatorSubscribeButton({ tag, vm }: { tag: CreatorTag; vm: ReturnType<typeof useCreatorSubscriptions> }) {
  if (!isCreatorTag(tag)) return null;
  const subscribed = vm.subscriptions.some(subscription => subscription.remote_tag_id === tag.id && subscription.tag_type === tag.type && subscription.enabled);
  const busy = vm.busyTag === tag.type + ":" + tag.id;
  const label = (subscribed ? "取消订阅" : "订阅") + (tag.type === "artist" ? "作者 " : "社团 ") + (tag.display || tag.name || "");
  const Icon = busy ? LoaderCircle : subscribed ? Bell : BellPlus;
  return <button className="creator-subscribe" type="button" aria-label={label} title={label} aria-pressed={subscribed}
    disabled={vm.loading || vm.busyTag !== null} onClick={() => void vm.toggle(tag)}>
    <Icon size={15} className={busy ? "spin" : undefined} />
  </button>;
}
