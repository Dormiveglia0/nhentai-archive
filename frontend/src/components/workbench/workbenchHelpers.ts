export { formatBytes } from "../../lib/format";

export function targetLabel(target: Record<string, unknown>): string {
  const galleryId = target.gallery_id;
  if (typeof galleryId === "number" || typeof galleryId === "string") {
    return `Gallery ID ${galleryId}`;
  }
  const workId = target.work_id;
  if (typeof workId === "number" || typeof workId === "string") {
    return `Work ${workId}`;
  }
  return "任务";
}
