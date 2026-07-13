import { useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent } from "react";

import type { RemoteTag } from "../../lib/api";
import { tagSearchHref } from "../../lib/navigation";

type Props = {
  tags: RemoteTag[];
  onPickTag?: (tag: RemoteTag) => void;
  displayTag?: (tag: RemoteTag) => string;
  className: string;
};

export function TagScroller({ tags, onPickTag, displayTag = defaultDisplayTag, className }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const startX = useRef(0);
  const startScroll = useRef(0);
  const dragged = useRef(false);
  const pointerId = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!ref.current || event.button !== 0) return;
    pointerId.current = event.pointerId;
    startX.current = event.clientX;
    startScroll.current = ref.current.scrollLeft;
    dragged.current = false;
    setIsDragging(true);
    ref.current.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!ref.current || pointerId.current !== event.pointerId) return;
    const delta = event.clientX - startX.current;
    if (Math.abs(delta) > 4) dragged.current = true;
    ref.current.scrollLeft = startScroll.current - delta;
  }

  function stopDrag(event: PointerEvent<HTMLDivElement>) {
    if (ref.current && pointerId.current === event.pointerId) {
      ref.current.releasePointerCapture(event.pointerId);
    }
    pointerId.current = null;
    setIsDragging(false);
  }

  function pick(event: ReactMouseEvent, tag: RemoteTag) {
    // Tags live inside a clickable card body; never let a tag click bubble up to open the work.
    event.stopPropagation();
    if (dragged.current) {
      event.preventDefault();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (!onPickTag) return;
    event.preventDefault();
    onPickTag(tag);
  }

  return (
    <div
      ref={ref}
      className={isDragging ? `${className} dragging is-dragging` : className}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
      onClick={(event) => event.stopPropagation()}
      aria-label="远端标签"
    >
      {tags.length === 0 ? (
        <span>标签未缓存</span>
      ) : (
        tags.slice(0, 22).map((tag) => (
          <a key={tag.id} href={tagSearchHref(tag)} onClick={(event) => pick(event, tag)} onAuxClick={(event) => event.stopPropagation()}>
            {displayTag(tag)}
          </a>
        ))
      )}
    </div>
  );
}

export function defaultDisplayTag(tag: RemoteTag) {
  return tag.display || tag.name || tag.slug || String(tag.id);
}
