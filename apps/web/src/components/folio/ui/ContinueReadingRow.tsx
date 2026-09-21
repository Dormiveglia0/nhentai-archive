import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent } from "react";

import type { LibraryTag, LibraryWork } from "../../../lib/api";
import { workTitle } from "../../../lib/format";
import { Stagger, StaggerItem, usePrefersReducedMotion } from "../../../lib/motion";
import { libraryTagHref, pageHref } from "../../../lib/navigation";
import { AmbientCover } from "./AmbientCover";

type Props = {
  title: string;
  works: LibraryWork[];
  blurCovers: boolean;
  onPickTag: (tag: LibraryTag) => void;
};

export function ContinueReadingRow({ title, works, blurCovers, onPickTag }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef({ pointerId: -1, startX: 0, scrollLeft: 0, moved: false });
  const [activeIndex, setActiveIndex] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [edges, setEdges] = useState({ previous: false, next: false });
  const reduceMotion = usePrefersReducedMotion();

  function updateEdges() {
    const node = track.current;
    if (!node) return;
    const cells = Array.from(node.children) as HTMLElement[];
    const first = cells.findIndex((cell) => cell.offsetLeft - node.offsetLeft >= node.scrollLeft - cell.clientWidth / 2);
    setActiveIndex(Math.max(0, first));
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
  const active = works[Math.min(activeIndex, works.length - 1)];
  const tags = (active.tags ?? []).filter((tag) => tag.type === "tag");

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
      <div className="folio-shelf-composition">
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
        {works.map((work, index) => (
          <StaggerItem key={work.id} className={`folio-shelf-cell${active.id === work.id ? " is-current" : ""}`}>
            <a
              href={pageHref({ name: "reader", workId: work.id })}
              className="folio-shelf-item"
              draggable={false}
              aria-label={`${title}：${workTitle(work)}`}
              onFocus={() => setActiveIndex(index)}
            >
              <div className="folio-shelf-cover">
                {work.cover_path ? (
                  <AmbientCover className="is-fill-portrait" src={`/api/works/${work.id}/cover?w=512`} alt="" privateBlur={blurCovers} loading="lazy" draggable={false} />
                ) : (
                  <span className="folio-cover-fallback">NO COVER</span>
                )}
                {(work.progress_percent ?? 0) > 0 ? (
                  <span className="folio-shelf-progress" style={{ width: `${work.progress_percent ?? 0}%` }} />
                ) : null}
              </div>
              <strong title={workTitle(work)}>{workTitle(work)}</strong>
              <small>{work.completed ? "已读完" : (work.progress_percent ?? 0) > 0 ? `已读 ${work.progress_percent}%` : "未读"}</small>
            </a>
          </StaggerItem>
        ))}
      </Stagger>
      <aside className="folio-shelf-context" aria-label="当前作品标签">
        <div className="folio-shelf-context-index"><span>{String(Math.min(activeIndex + 1, works.length)).padStart(2, "0")}</span><span>/ {String(works.length).padStart(2, "0")}</span></div>
        <div className="folio-shelf-context-tags" key={active.id}>
          {tags.length ? tags.map((tag) => <a key={tag.id} href={libraryTagHref(tag)} onClick={(event) => { if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); onPickTag(tag); }}>{tag.display}</a>) : <span className="folio-shelf-no-tags">暂无标签</span>}
        </div>
        <a className="folio-shelf-context-title" href={pageHref({ name: "reader", workId: active.id })}>{workTitle(active)}</a>
        <div className="folio-shelf-context-progress"><span>{active.completed ? "已读完" : `已读 ${active.progress_percent ?? 0}%`}</span><span>{active.page_count} 页</span><progress max={100} value={active.progress_percent ?? 0} /></div>
      </aside>
      </div>
    </section>
  );
}
