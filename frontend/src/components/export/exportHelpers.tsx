import type { ExportPreset } from "../../lib/api";

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
