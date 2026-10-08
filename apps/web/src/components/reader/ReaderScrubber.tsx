import type { CSSProperties } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Presence, FadeInOut } from "../../lib/motion";
import "./ReaderToolbar.css";

type Props = {
  visible: boolean; pageIndex: number; pageCount: number;
  onJump: (pageIndex: number) => void; onOpenJump: () => void; onScrubChange: (active: boolean) => void;
};

export function ReaderScrubber({ visible, pageIndex, pageCount, onJump, onOpenJump, onScrubChange }: Props) {
  const fill = pageCount > 1 ? (pageIndex - 1) / (pageCount - 1) * 100 : 0;
  function pin(active: boolean, node: HTMLElement) {
    onScrubChange(active || Boolean(node.querySelector(":focus-visible")));
  }
  return <Presence>{visible && pageCount > 0 ? <FadeInOut y={12} className="reader-chrome reader-scrubber" role="toolbar" aria-label="页码导航"
    onMouseEnter={event => pin(true, event.currentTarget)} onMouseLeave={event => pin(false, event.currentTarget)}
    onFocusCapture={event => pin(true, event.currentTarget)}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onScrubChange(false); }}>
    <div className="reader-scrubber-row">
      <button type="button" onClick={() => onJump(pageIndex - 1)} disabled={pageIndex <= 1} aria-label="上一页"><ChevronLeft size={19} /></button>
      <button className="reader-counter reader-scrubber-counter" type="button" onClick={onOpenJump} aria-label="跳转页码">{pageIndex}<span>/ {pageCount}</span></button>
      <button type="button" onClick={() => onJump(pageIndex + 1)} disabled={pageIndex >= pageCount} aria-label="下一页"><ChevronRight size={19} /></button>
      <input className="reader-scrubber-track" type="range" min={1} max={pageCount} step={1} value={pageIndex}
        style={{ "--reader-progress": `${fill}%` } as CSSProperties}
        aria-label="阅读进度" aria-valuenow={pageIndex} aria-valuetext={`第 ${pageIndex} 页，共 ${pageCount} 页`}
        onChange={event => onJump(Number(event.currentTarget.value))} />
    </div>
  </FadeInOut> : null}</Presence>;
}
