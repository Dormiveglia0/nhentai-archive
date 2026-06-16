import { PointerEvent, useRef, useState } from "react";

import { RemoteTag } from "../../lib/api";

type Props = {
  tags: RemoteTag[];
  onPickTag?: (tag: RemoteTag) => void;
  displayTag?: (tag: RemoteTag) => string;
};

export function TagScroller({ tags, onPickTag, displayTag = defaultDisplayTag }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const startX = useRef(0);
  const startScroll = useRef(0);
  const dragged = useRef(false);
  const pointerId = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!ref.current) return;
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

  function pick(tag: RemoteTag) {
    if (dragged.current) return;
    onPickTag?.(tag);
  }

  return (
    <div
      ref={ref}
      className={isDragging ? "tag-scroll dragging" : "tag-scroll"}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
      aria-label="远端标签"
    >
      {tags.length === 0 ? (
        <span>标签未缓存</span>
      ) : (
        tags.slice(0, 22).map((tag) => (
          <button key={tag.id} type="button" onClick={() => pick(tag)}>
            {displayTag(tag)}
          </button>
        ))
      )}
    </div>
  );
}

export function defaultDisplayTag(tag: RemoteTag) {
  return tag.display || tag.name || tag.slug || String(tag.id);
}
