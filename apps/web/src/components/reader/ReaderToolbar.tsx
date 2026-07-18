import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Image as ImageIcon,
  Info,
  LoaderCircle,
  Maximize,
  Minus,
  Plus,
  ScrollText,
} from "lucide-react";

import { FadeInOut, Presence } from "../../lib/motion";
import type { Direction, Fit, Mode, ReaderPanel } from "./readerHelpers";
import "./ReaderToolbar.css";

type ReaderToolbarProps = {
  visible: boolean;
  title: string;
  isRemote: boolean;
  pageIndex: number;
  pageCount: number;
  mode: Mode;
  direction: Direction;
  fit: Fit;
  importing: boolean;
  queued: boolean;
  activePanel: ReaderPanel;
  onBack: () => void;
  onFlip: (delta: number) => void;
  onSetMode: (mode: Mode) => void;
  onToggleDirection: () => void;
  onCycleFit: () => void;
  onZoom: (delta: number) => void;
  onToggleFullscreen: () => void;
  onOpenPanel: (panel: ReaderPanel) => void;
  onOpenJump: () => void;
  onImport: () => void;
  onPanelHoverChange: (hovering: boolean) => void;
};

const FIT_LABEL: Record<Fit, string> = { width: "适配宽", height: "适配高", original: "原始" };

export function ReaderToolbar({
  visible,
  title,
  isRemote,
  pageIndex,
  pageCount,
  mode,
  direction,
  fit,
  importing,
  queued,
  activePanel,
  onBack,
  onFlip,
  onSetMode,
  onToggleDirection,
  onCycleFit,
  onZoom,
  onToggleFullscreen,
  onOpenPanel,
  onOpenJump,
  onImport,
  onPanelHoverChange,
}: ReaderToolbarProps) {
  return (
    <Presence>
      {visible ? (
        <FadeInOut
          y={-14}
          className="reader-chrome reader-toolbar"
          role="toolbar"
          aria-label="阅读控制栏"
          onMouseEnter={() => onPanelHoverChange(true)}
          onMouseLeave={() => onPanelHoverChange(false)}
          onFocusCapture={() => onPanelHoverChange(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onPanelHoverChange(false);
          }}
        >
          <div className="reader-toolbar-identity">
            <button className="reader-back-button" type="button" onClick={onBack}>
              <ArrowLeft size={17} />
              <span>{isRemote ? "返回发现" : "返回我的库"}</span>
            </button>
            <span className="reader-title">
              <strong title={title}>{title}</strong>
              <small>{isRemote ? "REMOTE PREVIEW" : "LOCAL ARCHIVE"}</small>
            </span>
          </div>

          <div className="reader-toolbar-controls">
            <div className="reader-control-group" aria-label="翻页控制">
              <button type="button" onClick={() => onFlip(-1)} disabled={pageIndex <= 1} aria-label="上一页"><ChevronLeft size={17} /></button>
              <button className="reader-page-jump" type="button" onClick={onOpenJump} disabled={pageCount <= 0} aria-label="跳转页码">
                <strong>{pageCount ? pageIndex : "—"}</strong><span>/ {pageCount || "—"}</span>
              </button>
              <button type="button" onClick={() => onFlip(1)} disabled={pageIndex >= pageCount || pageCount <= 0} aria-label="下一页"><ChevronRight size={17} /></button>
            </div>

            <div className="reader-control-group" aria-label="阅读方式">
              <button
                type="button"
                className={mode === "webtoon" ? "is-active" : ""}
                aria-pressed={mode === "webtoon"}
                onClick={() => onSetMode(mode === "webtoon" ? "single" : "webtoon")}
                title="切换单页 / 连续滚动"
              >
                <ScrollText size={16} /><span>{mode === "webtoon" ? "连续" : "单页"}</span>
              </button>
              {mode === "single" ? <button type="button" onClick={onToggleDirection} title="切换阅读方向"><span>{direction === "rtl" ? "右 → 左" : "左 → 右"}</span></button> : null}
              <button type="button" onClick={onCycleFit} title="切换适配模式"><span>{FIT_LABEL[fit]}</span></button>
            </div>

            {mode === "single" ? (
              <div className="reader-control-group reader-zoom-group" aria-label="缩放控制">
                <button type="button" onClick={() => onZoom(-1)} aria-label="缩小"><Minus size={16} /></button>
                <button type="button" onClick={() => onZoom(1)} aria-label="放大"><Plus size={16} /></button>
              </div>
            ) : null}

            <div className="reader-control-group" aria-label="辅助控制">
              <button type="button" onClick={onToggleFullscreen} aria-label="全屏"><Maximize size={16} /></button>
              <button type="button" className={activePanel === "thumbnails" ? "is-active" : ""} aria-pressed={activePanel === "thumbnails"} onClick={() => onOpenPanel("thumbnails")} aria-label="页面索引"><ImageIcon size={16} /></button>
              <button type="button" className={activePanel === "info" ? "is-active" : ""} aria-pressed={activePanel === "info"} onClick={() => onOpenPanel("info")} aria-label="作品信息"><Info size={16} /></button>
            </div>

            {isRemote ? (
              <button className="reader-import-button" type="button" onClick={onImport} disabled={importing || queued} aria-busy={importing}>
                {importing ? <LoaderCircle className="reader-loading-icon" size={16} /> : <Download size={16} />}
                <span>{queued ? "已加入" : importing ? "正在加入" : "加入队列"}</span>
              </button>
            ) : null}
          </div>
        </FadeInOut>
      ) : null}
    </Presence>
  );
}
