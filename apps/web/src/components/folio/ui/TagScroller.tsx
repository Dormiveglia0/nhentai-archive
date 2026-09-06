import { useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent } from "react";

import type { RemoteTag } from "../../../lib/api";
import { tagSearchHref } from "../../../lib/navigation";

type Props = {
  tags: RemoteTag[];
  onPickTag?: (tag: RemoteTag) => void;
  displayTag?: (tag: RemoteTag) => string;
  hrefForTag?: (tag: RemoteTag) => string;
  className: string;
  emptyLabel?: string;
};

export function TagScroller({ tags, onPickTag, displayTag = defaultDisplayTag, hrefForTag = tagSearchHref, className, emptyLabel = "标签未缓存" }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const startX = useRef(0);
  const startScroll = useRef(0);
  const dragged = useRef(false);
  const pointerId = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!ref.current || !event.isPrimary || event.button !== 0) return;
    dragged.current = false;
    if (event.pointerType !== "mouse" || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    pointerId.current = event.pointerId;
    startX.current = event.clientX;
    startScroll.current = ref.current.scrollLeft;
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!ref.current || pointerId.current !== event.pointerId) return;
    const delta = event.clientX - startX.current;
    if (Math.abs(delta) > 4 && !dragged.current) {
      dragged.current = true;
      setIsDragging(true);
      ref.current.setPointerCapture(event.pointerId);
    }
    if (!dragged.current) return;
    ref.current.scrollLeft = startScroll.current - delta;
  }

  function stopDrag(event: PointerEvent<HTMLDivElement>) {
    if (pointerId.current !== event.pointerId) return;
    if (ref.current && pointerId.current === event.pointerId && ref.current.hasPointerCapture(event.pointerId)) {
      ref.current.releasePointerCapture(event.pointerId);
    }
    pointerId.current = null;
    setIsDragging(false);
  }

  function pick(event: ReactMouseEvent, tag: RemoteTag) {
    event.stopPropagation();
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (dragged.current && event.detail !== 0) {
      event.preventDefault();
      return;
    }
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
      onPointerLeave={stopDrag}
      onLostPointerCapture={stopDrag}
      onClick={(event) => event.stopPropagation()}
      aria-label="作品标签"
    >
      {tags.length === 0 ? (
        <span>{emptyLabel}</span>
      ) : (
        tags.map((tag) => (
          <a key={tag.id} data-tag-type={tag.type || "tag"} href={hrefForTag(tag)} draggable={false} onDragStart={(event) => event.preventDefault()} onClick={(event) => pick(event, tag)} onAuxClick={(event) => event.stopPropagation()}>
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
