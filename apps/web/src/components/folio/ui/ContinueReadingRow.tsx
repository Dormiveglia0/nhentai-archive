import { ArrowUpRight, BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent } from "react";

import type { LibraryWork } from "../../../lib/api";
import { workTitle } from "../../../lib/format";
import { Stagger, StaggerItem, usePrefersReducedMotion } from "../../../lib/motion";
import { pageHref } from "../../../lib/navigation";
import { AmbientCover } from "./AmbientCover";

type Props = {
  title: string;
  works: LibraryWork[];
  blurCovers: boolean;
};

export function ContinueReadingRow({ title, works, blurCovers }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef({ pointerId: -1, startX: 0, scrollLeft: 0, moved: false });
  const [dragging, setDragging] = useState(false);
  const [edges, setEdges] = useState({ previous: false, next: false });
  const reduceMotion = usePrefersReducedMotion();

  function updateEdges() {
    const node = track.current;
    if (!node) return;
    const previous = node.scrollLeft > 1;
    const next = node.scrollLeft + node.clientWidth < node.scrollWidth - 1;
    setEdges((current) => current.previous === previous && current.next === next ? current : { previous, next });
  }

  useEffect(() => {
    if (!track.current) return;
    const observer = new ResizeObserver(updateEdges);
    observer.observe(track.current);
    updateEdges();
    return () => observer.disconnect();
  }, [works.length]);

  if (!works.length) return null;

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    drag.current.moved = false;
    if (event.pointerType !== "mouse" || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey
      || event.currentTarget.scrollWidth <= event.currentTarget.clientWidth) return;
    drag.current = { pointerId: event.pointerId, startX: event.clientX, scrollLeft: event.currentTarget.scrollLeft, moved: false };
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    if (drag.current.pointerId !== event.pointerId) return;
    const delta = event.clientX - drag.current.startX;
    // Capture only a real drag: capturing on pointerdown retargets link clicks to the track.
    if (Math.abs(delta) > 6 && !drag.current.moved) {
      drag.current.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    }
    if (!drag.current.moved) return;
    event.currentTarget.scrollLeft = drag.current.scrollLeft - delta;
  }

  function scroll(direction: number) {
    const node = track.current;
    node?.scrollBy({ left: direction * node.clientWidth * 0.8, behavior: reduceMotion ? "instant" : "smooth" });
  }

  function stopDrag(event: PointerEvent<HTMLDivElement>) {
    if (drag.current.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    drag.current.pointerId = -1;
    setDragging(false);
  }

  return (
    <section className="folio-shelf">
      <div className="folio-shelf-head">
        <h2>{title}</h2>
        <span>{works.length} 部</span>
        {edges.previous || edges.next ? (
          <div className="folio-shelf-controls">
            <button type="button" aria-label={`${title}：向前浏览`} disabled={!edges.previous} onClick={() => scroll(-1)}><ChevronLeft size={17} /></button>
            <button type="button" aria-label={`${title}：向后浏览`} disabled={!edges.next} onClick={() => scroll(1)}><ChevronRight size={17} /></button>
          </div>
        ) : null}
      </div>
      <Stagger
        ref={track}
        className={dragging ? "folio-shelf-track is-dragging" : "folio-shelf-track"}
        onScroll={updateEdges}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        onPointerLeave={stopDrag}
        onLostPointerCapture={stopDrag}
        onClickCapture={(event) => {
          if (!drag.current.moved || event.detail === 0 || event.button !== 0
            || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          event.stopPropagation();
          drag.current.moved = false;
        }}
      >
        {works.map((work) => (
          <StaggerItem key={work.id} className="folio-shelf-cell">
            <a
              href={pageHref({ name: "reader", workId: work.id })}
              className="folio-shelf-item"
              draggable={false}
            >
              <div className="folio-shelf-cover">
                {work.cover_path ? (
                  <AmbientCover src={`/api/works/${work.id}/cover`} alt="" privateBlur={blurCovers} loading="lazy" draggable={false} />
                ) : (
                  <span className="folio-cover-fallback">NO COVER</span>
                )}
                <span className="folio-shelf-open" aria-hidden="true"><BookOpen size={18} /><span>打开阅读</span></span>
                {(work.progress_percent ?? 0) > 0 ? (
                  <span className="folio-shelf-progress" style={{ width: `${work.progress_percent ?? 0}%` }} />
                ) : null}
              </div>
              <strong title={workTitle(work)}>{workTitle(work)}</strong>
              <small><span>{work.completed ? "已读完 · 再读一次" : (work.progress_percent ?? 0) > 0 ? `已读 ${work.progress_percent}%` : "开始阅读"}</span><ArrowUpRight size={14} aria-hidden="true" /></small>
            </a>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}
