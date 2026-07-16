import type { RemoteTag } from "../../lib/api";
import { DiscoverFeed } from "./DiscoverFeed";
import { DiscoverToolbar } from "./DiscoverToolbar";
import { PopularFan } from "./PopularFan";
import { useDiscoverState } from "./useDiscoverState";
import "./DiscoverPage.css";

export function DiscoverPage({ blurCovers, initialTag }: { blurCovers: boolean; initialTag?: RemoteTag }) {
  const discover = useDiscoverState(initialTag);

  return (
    <section className="folio-page-body folio-discover-page">
      <PopularFan
        loading={discover.popularLoading}
        items={discover.popularItems}
        blurCovers={blurCovers}
        collapseSignal={discover.popularCollapseSignal}
        onOpen={discover.openDetail}
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
        onRandom={discover.openRandom}
      />

      <DiscoverFeed
        items={discover.items}
        total={discover.total}
        page={discover.page}
        totalPages={discover.totalPages}
        loading={discover.loading}
        error={discover.error}
        notice={discover.notice}
        blurCovers={blurCovers}
        onOpen={discover.openDetail}
        onImport={discover.enqueueGalleryId}
        onPickTag={discover.pickTag}
        onPage={discover.loadPage}
      />
    </section>
  );
}
