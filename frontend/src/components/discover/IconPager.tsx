import { ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

type Props = {
  className?: string;
  page: number;
  totalPages: number;
  loading: boolean;
  onPage: (page: number) => void;
};

export function IconPager({ className = "icon-pager", page, totalPages, loading, onPage }: Props) {
  const [draft, setDraft] = useState(String(page));

  useEffect(() => {
    setDraft(String(page));
  }, [page]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = Number(draft);
    if (!Number.isInteger(value)) return;
    onPage(Math.min(Math.max(value, 1), totalPages));
  }

  if (totalPages <= 1) return null;

  return (
    <form className={className} onSubmit={submit}>
      <button type="button" onClick={() => onPage(1)} disabled={loading || page <= 1} aria-label="第一页">
        <ChevronsLeft size={17} />
      </button>
      <button type="button" onClick={() => onPage(page - 1)} disabled={loading || page <= 1} aria-label="上一页">
        <ChevronLeft size={17} />
      </button>
      <input
        value={draft}
        inputMode="numeric"
        onChange={(event) => setDraft(event.target.value.replace(/[^\d]/g, ""))}
        aria-label="跳转页码"
      />
      <span>/ {totalPages}</span>
      <button type="button" onClick={() => onPage(page + 1)} disabled={loading || page >= totalPages} aria-label="下一页">
        <ChevronRight size={17} />
      </button>
      <button type="button" onClick={() => onPage(totalPages)} disabled={loading || page >= totalPages} aria-label="最后一页">
        <ChevronsRight size={17} />
      </button>
    </form>
  );
}
