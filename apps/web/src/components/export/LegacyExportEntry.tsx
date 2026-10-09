import { useEffect } from "react";
import { LibraryPage } from "../library/LibraryPage";
import { ExportDialog } from "./ExportDialog";

/** Existing work export bookmarks open the same contextual dialog. */
export function LegacyExportEntry({ initialWorkId, blurCovers }: { initialWorkId?: number; blurCovers: boolean }) {
  useEffect(() => { if (!initialWorkId) window.location.hash = "library"; }, [initialWorkId]);
  return <><LibraryPage blurCovers={blurCovers} />{initialWorkId ? <ExportDialog workIds={[initialWorkId]} blurCovers={blurCovers} onClose={() => { window.location.hash = "library"; }} /> : null}</>;
}
