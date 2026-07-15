import { useRef, useState, type PointerEvent } from "react";

import type { LibraryWork } from "../../../lib/api";
import { workTitle } from "../../../lib/format";
import { Stagger, StaggerItem } from "../../../lib/motion";
import { navigate } from "../../../lib/navigation";

type Props = {
  title: string;
  works: LibraryWork[];
  blurCovers: boolean;
};

export function ContinueReadingRow({ title, works, blurCovers }: Props) {
  const drag = useRef({ pointerId: -1, startX: 0, scrollLeft: 0, moved: false });
  const [dragging, setDragging] = useState(false);

  if (!works.length) return null;

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || event.currentTarget.scrollWidth <= event.currentTarget.clientWidth) return;
    drag.current = { pointerId: event.pointerId, startX: event.clientX, scrollLeft: event.currentTarget.scrollLeft, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    if (drag.current.pointerId !== event.pointerId) return;
    const delta = event.clientX - drag.current.startX;
    if (Math.abs(delta) > 4) drag.current.moved = true;
    event.currentTarget.scrollLeft = drag.current.scrollLeft - delta;
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
        <span>{works.length}</span>
      </div>
      <Stagger
        className={dragging ? "folio-shelf-track is-dragging" : "folio-shelf-track"}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        onClickCapture={(event) => {
          if (!drag.current.moved) return;
          event.preventDefault();
          event.stopPropagation();
          drag.current.moved = false;
        }}
      >
        {works.map((work) => (
          <StaggerItem key={work.id} className="folio-shelf-cell">
            <button
              type="button"
              className="folio-shelf-item"
              onClick={() => navigate({ name: "reader", workId: work.id })}
            >
              <div className="folio-shelf-cover">
                {work.cover_path ? (
                  <img className={blurCovers ? "folio-media-blurred" : ""} src={`/api/works/${work.id}/cover`} alt="" loading="lazy" draggable={false} />
                ) : (
                  <span className="folio-cover-fallback">NO COVER</span>
                )}
                {(work.progress_percent ?? 0) > 0 ? (
                  <span className="folio-shelf-progress" style={{ width: `${work.progress_percent ?? 0}%` }} />
                ) : null}
              </div>
              <strong title={workTitle(work)}>{workTitle(work)}</strong>
              <small>{work.completed ? "已读" : `${work.progress_percent ?? 0}%`}</small>
            </button>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}
