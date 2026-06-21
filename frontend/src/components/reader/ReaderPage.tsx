import { useCallback, useEffect, useState } from "react";

import { navigate } from "../../lib/navigation";
import {
  arrowDelta,
  clamp,
  Fit,
  Mode,
  ReaderPanel,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEP,
} from "./readerHelpers";
import { ReaderInfoPanel } from "./ReaderInfoPanel";
import { ReaderToolbar } from "./ReaderToolbar";
import { ReaderViewport } from "./ReaderViewport";
import { ThumbnailPanel } from "./ThumbnailPanel";
import { ReaderSource, useReaderData } from "./useReaderData";
import { useReaderChrome } from "./useReaderChrome";
import { useReaderPrefs } from "./useReaderPrefs";

type Props = {
  source: ReaderSource;
  privacyMode: boolean;
};

const FIT_ORDER: Fit[] = ["height", "width", "original"];

export function ReaderPage({ source, privacyMode }: Props) {
  const data = useReaderData(source);
  const { prefs, setMode, setDirection, setFit } = useReaderPrefs();
  const { visible: chromeVisible, setPinned, reveal } = useReaderChrome();

  const [zoom, setZoom] = useState(1);
  const [masked, setMasked] = useState(false);
  const [activePanel, setActivePanel] = useState<ReaderPanel>("none");

  // 切换作品时重置缩放/面板/遮罩
  useEffect(() => {
    setZoom(1);
    setActivePanel("none");
    setMasked(false);
  }, [data.sourceKey]);

  // 面板开启时钉住 chrome
  useEffect(() => {
    setPinned(activePanel !== "none");
  }, [activePanel, setPinned]);

  // 标题
  useEffect(() => {
    document.title = privacyMode ? "NH Archive" : data.title;
    return () => {
      document.title = "NH Archive";
    };
  }, [privacyMode, data.title]);

  const flip = useCallback((delta: number) => data.setPage(data.pageIndex + delta), [data.setPage, data.pageIndex]);
  const jump = useCallback((pageIndex: number) => data.setPage(pageIndex), [data.setPage]);
  const zoomBy = useCallback(
    (steps: number) => setZoom((z) => clamp(Number((z + steps * ZOOM_STEP).toFixed(2)), ZOOM_MIN, ZOOM_MAX)),
    []
  );
  const cycleFit = useCallback(() => {
    const idx = FIT_ORDER.indexOf(prefs.fit);
    setFit(FIT_ORDER[(idx + 1) % FIT_ORDER.length]);
  }, [prefs.fit, setFit]);
  const toggleDirection = useCallback(
    () => setDirection(prefs.direction === "rtl" ? "ltr" : "rtl"),
    [prefs.direction, setDirection]
  );
  const setModeAndReset = useCallback(
    (mode: Mode) => {
      if (mode === "webtoon") setZoom(1);
      setMode(mode);
    },
    [setMode]
  );
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  }, []);
  const openPanel = useCallback((panel: ReaderPanel) => {
    setActivePanel((current) => (current === panel ? "none" : panel));
  }, []);
  const toggleChrome = useCallback(() => {
    if (chromeVisible) setPinned(false);
    else reveal();
  }, [chromeVisible, setPinned, reveal]);

  // 键盘
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const key = event.key;
      const delta = arrowDelta(key, prefs.direction);
      if (prefs.mode === "single" && delta !== 0) {
        flip(delta);
        return;
      }
      if (key === " ") {
        event.preventDefault();
        flip(event.shiftKey ? -1 : 1);
      } else if (key === "f") {
        toggleFullscreen();
      } else if (key === "h") {
        setMasked((v) => !v);
      } else if (key === "t") {
        openPanel("thumbnails");
      } else if (key === "i") {
        openPanel("info");
      } else if (key === "+" || key === "=") {
        zoomBy(1);
      } else if (key === "-") {
        zoomBy(-1);
      } else if (key === "0") {
        setZoom(1);
      } else if (key === "Escape") {
        if (activePanel !== "none") setActivePanel("none");
        else if (document.fullscreenElement) void document.exitFullscreen();
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [activePanel, flip, openPanel, prefs.direction, prefs.mode, toggleFullscreen, zoomBy]);

  if (data.error) {
    return (
      <section className="reader-shell">
        <div className="notice error">{data.error}</div>
      </section>
    );
  }

  return (
    <section className="reader-shell">
      <ReaderViewport
        pages={data.pages}
        pageIndex={data.pageIndex}
        mode={prefs.mode}
        direction={prefs.direction}
        fit={prefs.fit}
        zoom={zoom}
        masked={masked}
        isRemote={data.isRemote}
        onFlip={flip}
        onJump={jump}
        onToggleChrome={toggleChrome}
      />

      {data.notice ? <div className="notice slim reader-notice">{data.notice}</div> : null}

      <ReaderToolbar
        visible={chromeVisible}
        title={data.title}
        isRemote={data.isRemote}
        pageIndex={data.pageIndex}
        pageCount={data.pageCount}
        progressPercent={data.progressPercent}
        mode={prefs.mode}
        direction={prefs.direction}
        fit={prefs.fit}
        masked={masked}
        activePanel={activePanel}
        onBack={() => navigate({ name: data.isRemote ? "discover" : "library" })}
        onFlip={flip}
        onSetMode={setModeAndReset}
        onToggleDirection={toggleDirection}
        onCycleFit={cycleFit}
        onZoom={zoomBy}
        onToggleMask={() => setMasked((v) => !v)}
        onToggleFullscreen={toggleFullscreen}
        onOpenPanel={openPanel}
        onImport={data.importRemote}
        onPanelHoverChange={setPinned}
      />

      <ThumbnailPanel
        open={activePanel === "thumbnails"}
        pages={data.pages}
        pageIndex={data.pageIndex}
        onJump={jump}
        onClose={() => setActivePanel("none")}
        onHoverChange={setPinned}
      />

      <ReaderInfoPanel
        open={activePanel === "info"}
        title={data.title}
        coverSrc={data.coverSrc}
        tags={data.tags}
        progressPercent={data.progressPercent}
        isRemote={data.isRemote}
        workId={data.work?.id ?? null}
        mode={prefs.mode}
        direction={prefs.direction}
        fit={prefs.fit}
        onSetMode={setModeAndReset}
        onToggleDirection={toggleDirection}
        onCycleFit={cycleFit}
        onMarkCompleted={data.markCompleted}
        onImport={data.importRemote}
        onClose={() => setActivePanel("none")}
        onHoverChange={setPinned}
      />
    </section>
  );
}
