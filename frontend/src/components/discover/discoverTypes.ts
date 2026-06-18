import { GallerySummary, RemoteTag } from "../../lib/api";

export type DiscoverViewMode = "grid" | "list";
export type DiscoverSurface = "feed" | "upload" | "scan";

export type TagFilter = RemoteTag & {
  display?: string;
};

export type DiscoverPagePayload = {
  result: GallerySummary[];
  total: number;
  num_pages: number;
  per_page: number;
  reason?: string;
  query?: string;
  source?: string;
};
