import type { MetadataFieldDiff } from "../../lib/api";

export type FieldEdit = {
  value: string;
  source: "manual" | "remote" | "comicinfo" | "current";
};

export function buildInitialEdits(fields: MetadataFieldDiff[]): Record<string, FieldEdit> {
  return Object.fromEntries(
    fields.map((field) => [field.field, { value: field.working_value || "", source: toEditableSource(field.working_source) }])
  );
}

export function toEditableSource(source: string): FieldEdit["source"] {
  return source === "remote" || source === "comicinfo" || source === "current" ? source : "manual";
}

export function sourceLabel(source: string): string {
  if (source === "comicinfo") return "ComicInfo";
  if (source === "remote") return "远端缓存";
  if (source === "json") return "JSON";
  return "未解析";
}

export function splitValues(value?: string | null): string[] {
  if (!value) return [];
  return value
    .split(" / ")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function normalize(value: unknown): string {
  return String(value ?? "").trim();
}
