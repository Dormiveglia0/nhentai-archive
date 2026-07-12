import { BookOpen } from "lucide-react";
import { AnimatePresence, m } from "motion/react";

import { duration, ease } from "../../../lib/motion";
import type { FolioPageId } from "../config";

export function ModuleBackdrop({ page, reduceMotion }: { page: FolioPageId; reduceMotion: boolean }) {
  return (
    <AnimatePresence initial={false}>
      <m.div
        key={page}
        className={`folio-demo-atmosphere folio-demo-atmosphere-${page}`}
        aria-hidden="true"
        initial={{ opacity: 0, scale: reduceMotion ? 1 : 1.035 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.985 }}
        transition={{ duration: duration.slow, ease: ease.standard }}
      >
        {page === "library" ? <BookOpen strokeWidth={1} /> : page === "discover" ? (
          <div className="folio-demo-radar">
            <i className="folio-demo-radar-grid" />
            <i className="folio-demo-radar-sweep" />
            <span className="folio-demo-radar-hit folio-demo-radar-hit-a"><b /><em><b /><b /></em></span>
            <span className="folio-demo-radar-hit folio-demo-radar-hit-b"><b /><em><b /><b /></em></span>
            <span className="folio-demo-radar-hit folio-demo-radar-hit-c"><b /><em><b /><b /></em></span>
          </div>
        ) : <><i /><i /><i /></>}
      </m.div>
    </AnimatePresence>
  );
}
