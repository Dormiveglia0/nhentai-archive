export type Mode = "single" | "webtoon";
export type Direction = "ltr" | "rtl";
export type Fit = "width" | "height" | "original";
export type ReaderPanel = "none" | "thumbnails" | "info";

export type ReaderPageItem = {
  key: string;
  pageIndex: number;
  src: string;
};

export type ReaderPrefs = {
  mode: Mode;
  direction: Direction;
  fit: Fit;
};

export const DEFAULT_PREFS: ReaderPrefs = { mode: "single", direction: "rtl", fit: "height" };
export const PREFS_KEY = "nh.reader.prefs";
export const CHROME_IDLE_MS = 2500;
export const PERSIST_DEBOUNCE_MS = 600;
export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 4;
export const ZOOM_STEP = 0.25;

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

export function parsePrefs(raw: string | null): ReaderPrefs {
  if (!raw) return DEFAULT_PREFS;
  try {
    const parsed = JSON.parse(raw) as Partial<ReaderPrefs>;
    return {
      mode: parsed.mode === "webtoon" ? "webtoon" : "single",
      direction: parsed.direction === "ltr" ? "ltr" : "rtl",
      fit:
        parsed.fit === "width" || parsed.fit === "original" || parsed.fit === "height"
          ? parsed.fit
          : DEFAULT_PREFS.fit,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function serializePrefs(prefs: ReaderPrefs): string {
  return JSON.stringify(prefs);
}

/** 水平方向键 → 翻页增量（+1 下一页 / -1 上一页 / 0 非翻页键）。rtl 下左键为下一页。 */
export function arrowDelta(key: string, direction: Direction): number {
  if (key === "ArrowLeft") return direction === "rtl" ? 1 : -1;
  if (key === "ArrowRight") return direction === "rtl" ? -1 : 1;
  return 0;
}

/** 点击区 → 翻页增量。rtl 下左侧点击区为下一页。 */
export function clickZoneDelta(zone: "left" | "right", direction: Direction): number {
  if (zone === "left") return direction === "rtl" ? 1 : -1;
  return direction === "rtl" ? -1 : 1;
}
