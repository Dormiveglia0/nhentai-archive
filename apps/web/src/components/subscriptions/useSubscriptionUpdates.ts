import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";

export function useSubscriptionUpdates(page = 1, unreadOnly = false) {
  const [updates, setUpdates] = useState<Awaited<ReturnType<typeof api.subscriptionUpdates>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    let alive = true, timer = 0;
    setLoading(true);
    async function load() {
      if (!alive) return;
      if (!document.hidden && !document.querySelector<HTMLElement>(".app-route-archive")?.inert) {
        try {
          const result = await api.subscriptionUpdates(page, unreadOnly);
          if (alive) { setUpdates(result); setError(""); }
        } catch (reason) { if (alive) setError(reason instanceof Error ? reason.message : String(reason)); }
        finally { if (alive) setLoading(false); }
      }
      if (alive) timer = window.setTimeout(load, 5000);
    }
    const visible = () => { if (!document.hidden) refresh(); };
    window.addEventListener("nh-subscriptions-changed", refresh);
    document.addEventListener("visibilitychange", visible);
    void load();
    return () => {
      alive = false; window.clearTimeout(timer);
      window.removeEventListener("nh-subscriptions-changed", refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [page, unreadOnly, revision, refresh]);
  return { updates, loading, error, refresh };
}
