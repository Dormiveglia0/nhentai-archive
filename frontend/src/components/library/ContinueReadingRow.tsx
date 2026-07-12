import { LibraryWork } from "../../lib/api";
import { Stagger, StaggerItem } from "../../lib/motion";
import { navigate } from "../../lib/navigation";
import { workTitle } from "./libraryHelpers";

type Props = {
  title: string;
  works: LibraryWork[];
  blurCovers: boolean;
};

export function ContinueReadingRow({ title, works, blurCovers }: Props) {
  if (!works.length) return null;

  return (
    <section className="folio-shelf">
      <div className="folio-shelf-head">
        <h2>{title}</h2>
        <span>{works.length}</span>
      </div>
      <Stagger className="folio-shelf-track">
        {works.map((work) => (
          <StaggerItem key={work.id} className="folio-shelf-cell">
            <button
              type="button"
              className="folio-shelf-item"
              onClick={() => navigate({ name: "reader", workId: work.id })}
            >
              <div className="folio-shelf-cover">
                {work.cover_path ? (
                  <img className={blurCovers ? "blurred" : ""} src={`/api/works/${work.id}/cover`} alt="" loading="lazy" />
                ) : (
                  <span className="cover-fallback">NO COVER</span>
                )}
                {(work.progress_percent ?? 0) > 0 ? (
                  <span className="folio-shelf-progress" style={{ width: `${work.progress_percent}%` }} />
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
