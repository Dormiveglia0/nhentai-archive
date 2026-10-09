import type { RemoteTag } from "../../lib/api";
import { useEffect, useState } from "react";
import { Bell, Compass, Users } from "lucide-react";
import { SlidingIndicator, transitionTabs } from "../../lib/motion";
import { SubscriptionsPanel } from "../subscriptions/SubscriptionsPanel";
import { balanceGridRows, useGridColumns } from "../../lib/useGridColumns";
import { DiscoverFeed } from "./DiscoverFeed";
import { DiscoverToolbar } from "./DiscoverToolbar";
import { PopularFan } from "./PopularFan";
import { useDiscoverState } from "./useDiscoverState";
import "./DiscoverPage.css";

export function DiscoverPage({ blurCovers, initialTag }: { blurCovers: boolean; initialTag?: RemoteTag }) {
  const readView = (): "works" | "updates" | "subscriptions" => {
    const value = new URLSearchParams(window.location.hash.split("?")[1]).get("view");
    return value === "subscriptions" || value === "updates" ? value : "works";
  };
  const [view, setView] = useState(readView);
  useEffect(() => {
    const change = () => setView(readView());
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  return <section className="folio-page-body folio-discover-page">
    <nav className="folio-discover-tabs" aria-label="发现内容">
      {([{ id: "works", label: "作品", icon: Compass }, { id: "updates", label: "更新", icon: Bell }, { id: "subscriptions", label: "订阅", icon: Users }] as const).map(tab => <button key={tab.id} type="button" aria-current={view === tab.id ? "page" : undefined}
        onClick={() => transitionTabs(["works", "updates", "subscriptions"] as const, view, tab.id, value => {
          setView(value); window.history.replaceState(null, "", value === "works" ? "#discover" : "#discover?view=" + value);
        }, "discover")}>
        {view === tab.id ? <SlidingIndicator className="folio-control-active" layoutId="discover-views" /> : null}<tab.icon size={16} /><span>{tab.label}</span>
      </button>)}
    </nav>
    <div className="folio-discover-stage">{view === "works" ? <DiscoverWorks blurCovers={blurCovers} initialTag={initialTag} /> : <SubscriptionsPanel view={view} blurCovers={blurCovers} />}</div>
  </section>;
}

function DiscoverWorks({ blurCovers, initialTag }: { blurCovers: boolean; initialTag?: RemoteTag }) {
  const [gridRef, gridColumns] = useGridColumns();
  const discover = useDiscoverState(initialTag, gridColumns * 4);
  const gridRows = balanceGridRows(discover.items.length, gridColumns);

  return (
    <div className="folio-discover-works">
      <PopularFan
        loading={discover.popularLoading}
        items={discover.popularItems}
        blurCovers={blurCovers}
        onOpen={discover.openDetail}
        hrefFor={discover.detailHref}
        onImport={discover.enqueueGalleryId}
      />

      <DiscoverToolbar
        query={discover.query}
        language={discover.language}
        kind={discover.kind}
        sort={discover.sort}
        unimportedOnly={discover.unimportedOnly}
        selectedTags={discover.selectedTags}
        onQuery={discover.setQuery}
        onLanguage={discover.setLanguage}
        onKind={discover.setKind}
        onSort={discover.setSort}
        onUnimportedOnly={discover.setUnimportedOnly}
        onTags={discover.setSelectedTags}
        onSubmit={discover.submitToolbar}
        onClearQuery={discover.clearQuery}
        onRandom={discover.openRandom}
      />

      <DiscoverFeed
        gridRef={gridRef}
        gridRows={gridRows}
        items={discover.items}
        total={discover.total}
        page={discover.page}
        totalPages={discover.totalPages}
        loading={discover.loading}
        error={discover.error}
        notice={discover.notice}
        blurCovers={blurCovers}
        onOpen={discover.openDetail}
        hrefFor={discover.detailHref}
        onImport={discover.enqueueGalleryId}
        onPickTag={discover.pickTag}
        onPage={discover.loadPage}
      />
    </div>
  );
}
