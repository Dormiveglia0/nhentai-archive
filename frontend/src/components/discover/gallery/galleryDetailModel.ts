import type { GalleryDetail } from "../../../lib/api";

export const TAG_GROUPS: Array<{ key: string; label: string; types: string[] }> = [
  { key: "credit", label: "社团 / 作者", types: ["group", "artist"] },
  { key: "parody", label: "原作", types: ["parody"] },
  { key: "character", label: "角色", types: ["character"] },
  { key: "tag", label: "内容标签", types: ["tag"] },
  { key: "meta", label: "分类 / 语言", types: ["category", "language"] },
];

export const INITIAL_PREVIEW_COUNT = 20;

export type PreviewPageItem = {
  key: string;
  pageIndex: number;
  src: string;
  width?: number;
  height?: number;
  source: "local" | "remote";
};

export function galleryTitle(detail: GalleryDetail): string {
  return detail.title.japanese || detail.title.pretty || detail.title.english || `Gallery ${detail.gallery_id}`;
}

export function formatUploadDate(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "未知";
  const timestamp = typeof value === "number" ? value : Number(value);
  if (Number.isFinite(timestamp) && timestamp > 0) return new Date(timestamp * 1000).toISOString().slice(0, 10);
  return String(value);
}
