import { AlertTriangle, ArrowLeft, RotateCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { goBack } from "../../lib/navigation";
import {
  arrowDelta,
  clamp,
  type Fit,
  type Mode,
  type ReaderPanel,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEP,
} from "./readerHelpers";
import { ReaderInfoPanel } from "./ReaderInfoPanel";
import { ReaderJumpDialog } from "./ReaderJumpDialog";
import { ReaderScrubber } from "./ReaderScrubber";
import { ReaderToolbar } from "./ReaderToolbar";
import { ReaderViewport } from "./ReaderViewport";
import { ThumbnailOverlay } from "./ThumbnailOverlay";
import { useReaderChrome } from "./useReaderChrome";
import { type ReaderSource, useReaderData } from "./useReaderData";
import { useReaderPrefs } from "./useReaderPrefs";
import "./ReaderPage.css";

type Props = {
  source: ReaderSource;
};

const FIT_ORDER: Fit[] = ["height", "width", "original"];

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest("a, input, textarea, select, button, [role='slider'], [contenteditable='true']"));
}

export function ReaderPage({ source }: Props) {
  const data = useReaderData(source);
  const { prefs, setMode, setDirection, setFit } = useReaderPrefs();
  const { visible: chromeVisible, setPinned, reveal, hide } = useReaderChrome();
  const [zoom, setZoom] = useState(1);
  const [activePanel, setActivePanel] = useState<ReaderPanel>("none");
  const [jumpOpen, setJumpOpen] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);

  useEffect(() => {
    setZoom(1);
    setActivePanel("none");
    setJumpOpen(false);
    setUiError(null);
  }, [data.sourceKey]);

  useEffect(() => {
    setPinned(activePanel !== "none" || jumpOpen);
  }, [activePanel, jumpOpen, setPinned]);

  useEffect(() => {
    document.title = data.title;
    return () => { document.title = "NH Archive"; };
  }, [data.title]);

  useEffect(() => {
    if (!uiError) return;
    const timer = window.setTimeout(() => setUiError(null), 5600);
    return () => window.clearTimeout(timer);
  }, [uiError]);

  const flip = useCallback((delta: number) => data.setPage(data.pageIndex + delta), [data.pageIndex, data.setPage]);
  const jump = useCallback((pageIndex: number) => data.setPage(pageIndex), [data.setPage]);
  const zoomBy = useCallback((steps: number) => {
    setZoom((value) => clamp(Number((value + steps * ZOOM_STEP).toFixed(2)), ZOOM_MIN, ZOOM_MAX));
  }, []);
  const cycleFit = useCallback(() => {
    const index = FIT_ORDER.indexOf(prefs.fit);
    setFit(FIT_ORDER[(index + 1) % FIT_ORDER.length]);
  }, [prefs.fit, setFit]);
  const toggleDirection = useCallback(() => {
    setDirection(prefs.direction === "rtl" ? "ltr" : "rtl");
  }, [prefs.direction, setDirection]);
  const setModeAndReset = useCallback((mode: Mode) => {
    if (mode === "webtoon") setZoom(1);
    setMode(mode);
  }, [setMode]);
  const toggleFullscreen = useCallback(async () => {
    setUiError(null);
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch (reason) {
      setUiError(reason instanceof Error ? reason.message : "浏览器拒绝进入全屏。");
    }
  }, []);
  const openPanel = useCallback((panel: ReaderPanel) => {
    setActivePanel((current) => current === panel ? "none" : panel);
  }, []);
  const setInteractionPinned = useCallback((active: boolean) => {
    setPinned(active || activePanel !== "none" || jumpOpen);
  }, [activePanel, jumpOpen, setPinned]);
  const toggleChrome = useCallback(() => {
    if (activePanel !== "none" || jumpOpen) return;
    if (chromeVisible) hide();
    else reveal();
  }, [activePanel, chromeVisible, hide, jumpOpen, reveal]);

  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (jumpOpen) setJumpOpen(false);
        else if (activePanel !== "none") setActivePanel("none");
        else if (document.fullscreenElement) void document.exitFullscreen();
        return;
      }
      if (isInteractiveTarget(event.target)) return;

      const key = event.key;
      const delta = arrowDelta(key, prefs.direction);
      if (prefs.mode === "single" && delta !== 0) {
        event.preventDefault();
        flip(delta);
      } else if (key === " ") {
        event.preventDefault();
        flip(event.shiftKey ? -1 : 1);
      } else if (key.toLowerCase() === "f") {
        event.preventDefault();
        void toggleFullscreen();
      } else if (key.toLowerCase() === "t") {
        event.preventDefault();
        openPanel("thumbnails");
      } else if (key.toLowerCase() === "i") {
        event.preventDefault();
        openPanel("info");
      } else if (key === "+" || key === "=") {
        zoomBy(1);
      } else if (key === "-") {
        zoomBy(-1);
      } else if (key === "0") {
        setZoom(1);
      } else if (key.toLowerCase() === "g" && data.pageCount > 0) {
        event.preventDefault();
        setJumpOpen(true);
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [activePanel, data.pageCount, flip, jumpOpen, openPanel, prefs.direction, prefs.mode, toggleFullscreen, zoomBy]);

  if (data.error) {
    return (
      <section className="reader-shell reader-error-shell">
        <div className="reader-error-card" role="alert">
          <AlertTriangle size={25} />
          <span><strong>无法打开阅读器</strong><p>{data.error}</p></span>
          <div>
            <button type="button" onClick={goBack}><ArrowLeft size={15} />返回</button>
            <button type="button" onClick={data.reload}><RotateCw size={15} />重新读取</button>
          </div>
        </div>
      </section>
    );
  }

  const feedbackError = data.actionError || uiError;

  return (
    <section className={`reader-shell reader-source-${data.isRemote ? "remote" : "local"}`}>
      <div className="reader-atmosphere" aria-hidden="true"><i /><i /><i /></div>
      <ReaderViewport
        pages={data.pages}
        pageIndex={data.pageIndex}
        mode={prefs.mode}
        direction={prefs.direction}
        fit={prefs.fit}
        zoom={zoom}
        isRemote={data.isRemote}
        loading={data.loading}
        onFlip={flip}
        onJump={jump}
        onToggleChrome={toggleChrome}
      />

      {feedbackError ? <div className="reader-feedback is-error" role="alert"><AlertTriangle size={15} /><span>{feedbackError}</span></div> : null}
      {!feedbackError && data.notice ? <div className="reader-feedback is-success" role="status"><span>{data.notice}</span></div> : null}

      <ReaderToolbar
        visible={chromeVisible}
        title={data.title}
        isRemote={data.isRemote}
        pageIndex={data.pageIndex}
        pageCount={data.pageCount}
        mode={prefs.mode}
        direction={prefs.direction}
        fit={prefs.fit}
        importing={data.importing}
        queued={data.queued}
        activePanel={activePanel}
        onBack={goBack}
        onFlip={flip}
        onSetMode={setModeAndReset}
        onToggleDirection={toggleDirection}
        onCycleFit={cycleFit}
        onZoom={zoomBy}
        onToggleFullscreen={() => void toggleFullscreen()}
        onOpenPanel={openPanel}
        onOpenJump={() => setJumpOpen(true)}
        onImport={() => void data.importRemote()}
        onPanelHoverChange={setInteractionPinned}
      />

      <ReaderScrubber
        visible={chromeVisible}
        pageIndex={data.pageIndex}
        pageCount={data.pageCount}
        onJump={jump}
        onScrubChange={setInteractionPinned}
      />

      <ThumbnailOverlay
        open={activePanel === "thumbnails"}
        pages={data.pages}
        pageIndex={data.pageIndex}
        onJump={jump}
        onClose={() => setActivePanel("none")}
      />

      <ReaderInfoPanel
        open={activePanel === "info"}
        title={data.title}
        coverSrc={data.coverSrc}
        tags={data.tags}
        progressPercent={data.progressPercent}
        isRemote={data.isRemote}
        importing={data.importing}
        queued={data.queued}
        completed={data.completed}
        workId={data.work?.id ?? null}
        galleryId={data.isRemote ? data.gallery?.gallery_id ?? null : data.work?.remote_gallery_id ?? null}
        returnTo={source.kind === "local" ? `reader/${source.workId}` : `reader/remote/${source.galleryId}`}
        onMarkCompleted={data.markCompleted}
        onImport={() => void data.importRemote()}
        onClose={() => setActivePanel("none")}
        onHoverChange={setInteractionPinned}
      />

      <ReaderJumpDialog
        open={jumpOpen}
        pageCount={data.pageCount}
        onJump={jump}
        onClose={() => setJumpOpen(false)}
      />
    </section>
  );
}
