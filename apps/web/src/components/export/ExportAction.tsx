import { Download } from "lucide-react";
import { lazy, Suspense, useState } from "react";

const ExportDialog = lazy(() => import("./ExportDialog").then(module => ({ default: module.ExportDialog })));

export function ExportAction({ workIds, blurCovers, className, label = "导出", disabled = false }: { workIds: number[]; blurCovers?: boolean; className?: string; label?: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className={className} disabled={disabled || !workIds.length} onClick={() => setOpen(true)} aria-label={label === "导出" ? "导出 CBZ" : label}><Download size={16} />{label}</button>
    {open ? <Suspense fallback={<span role="status">正在读取导出选项…</span>}><ExportDialog key={workIds.join(",")} workIds={workIds} blurCovers={blurCovers} onClose={() => setOpen(false)} /></Suspense> : null}
  </>;
}
