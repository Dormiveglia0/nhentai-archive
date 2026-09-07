import type { FolioPageId } from "../../folio/config";
import { HomeHero } from "../../folio/ui/HomeHero";

export function WorkbenchDemo({ onNavigate }: { onNavigate: (page: FolioPageId) => void }) {
  return <div className="folio-page-body"><HomeHero onNavigate={onNavigate} /></div>;
}
