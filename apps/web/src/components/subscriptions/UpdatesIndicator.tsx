import { Bell } from "lucide-react";
import { useSubscriptionUpdates } from "./useSubscriptionUpdates";

export function UpdatesIndicator() {
  const { updates, error } = useSubscriptionUpdates();
  const count = updates?.unread_count ?? 0;
  return <a className={"folio-updates-indicator" + (count ? " has-unread" : "")}
    href="#discover?view=updates" aria-label={error ? "作品更新暂时无法读取" : "作品更新，" + count + " 部未读"}
    title={error || "作品更新"}>
    <Bell size={17} /><span>更新</span><b aria-hidden="true">{error ? "!" : !updates ? "…" : count > 99 ? "99+" : count}</b>
  </a>;
}
