import type { LibraryWork } from "./api";

const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"];

export function parseUtcTimestamp(value?: string | null): Date | null {
  if (!value) return null;
  const normalized = value.replace(" ", "T");
  const date = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(normalized) ? normalized : `${normalized}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const exponent = Math.min(BYTE_UNITS.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** exponent;
  return `${value >= 100 || exponent === 0 ? Math.round(value) : value.toFixed(value >= 10 ? 1 : 2)} ${BYTE_UNITS[exponent]}`;
}

export function formatCompactBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const exponent = Math.min(BYTE_UNITS.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${BYTE_UNITS[exponent]}`;
}

export function workTitle(work: LibraryWork): string {
  if (work.display_title) return work.display_title;
  return work.title_japanese || work.pretty_title || work.title || `Work ${work.id}`;
}

export function workCoverHref(work: Pick<LibraryWork, "id" | "updated_at">, width = 512): string {
  return `/api/works/${work.id}/cover?w=${width}${work.updated_at ? `&v=${encodeURIComponent(work.updated_at)}` : ""}`;
}
