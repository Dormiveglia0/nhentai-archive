import type { ExportPreset, ExportQueueItem } from "../../lib/api";

export type ExportItemStatus = "ready" | "warning" | "blocked";

export function itemStatus(item: ExportQueueItem): ExportItemStatus {
  if (item.blockers.length > 0) return "blocked";
  if (item.warnings.length > 0) return "warning";
  return "ready";
}

export const STATUS_LABEL: Record<ExportItemStatus, string> = {
  ready: "就绪",
  warning: "⚠ 警告",
  blocked: "阻塞",
};

export function compactPath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length <= 2) return path;
  return `.../${parts.slice(-2).join("/")}`;
}

export function presetSummaryLines(preset: ExportPreset | null): { name: string; rule: string } {
  return {
    name: preset?.name ?? "-",
    rule: preset?.comicinfo_rule ?? "-",
  };
}

export function Cover({
  workId,
  coverPath,
  blurCovers,
}: {
  workId: number;
  coverPath?: string | null;
  blurCovers: boolean;
}) {
  return (
    <span className="export-cover">
      {coverPath ? (
        <img className={blurCovers ? "blurred" : ""} src={`/api/works/${workId}/cover`} alt="" />
      ) : (
        <em>NO COVER</em>
      )}
    </span>
  );
}
