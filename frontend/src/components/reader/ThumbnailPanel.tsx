import { X } from "lucide-react";

import { Presence, FadeInOut } from "../../lib/motion";
import { ReaderPageItem } from "./readerHelpers";

type ThumbnailPanelProps = {
  open: boolean;
  pages: ReaderPageItem[];
  pageIndex: number;
  onJump: (pageIndex: number) => void;
  onClose: () => void;
  onHoverChange: (hovering: boolean) => void;
};

export function ThumbnailPanel({ open, pages, pageIndex, onJump, onClose, onHoverChange }: ThumbnailPanelProps) {
  return (
    <Presence>
      {open ? (
        <FadeInOut
          x={16}
          className="reader-chrome reader-panel reader-thumbs"
          onMouseEnter={() => onHoverChange(true)}
          onMouseLeave={() => onHoverChange(false)}
        >
          <header className="reader-panel-head">
            <strong>缩略图</strong>
            <button type="button" onClick={onClose} aria-label="关闭">
              <X size={16} />
            </button>
          </header>
          <div className="reader-thumbs-grid">
            {pages.map((page) => (
              <button
                key={page.key}
                type="button"
                className={page.pageIndex === pageIndex ? "active" : ""}
                onClick={() => onJump(page.pageIndex)}
              >
                <img src={page.src} alt={`第 ${page.pageIndex} 页`} loading="lazy" draggable={false} />
                <span>{page.pageIndex}</span>
              </button>
            ))}
          </div>
        </FadeInOut>
      ) : null}
    </Presence>
  );
}
