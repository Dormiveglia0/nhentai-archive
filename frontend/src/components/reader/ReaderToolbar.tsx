import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  EyeOff,
  Image as ImageIcon,
  Info,
  Maximize,
  Minus,
  Plus,
  ScrollText,
} from "lucide-react";

import { Presence, FadeInOut } from "../../lib/motion";
import { Direction, Fit, Mode, ReaderPanel } from "./readerHelpers";

type ReaderToolbarProps = {
  visible: boolean;
  title: string;
  isRemote: boolean;
  pageIndex: number;
  pageCount: number;
  mode: Mode;
  direction: Direction;
  fit: Fit;
  masked: boolean;
  activePanel: ReaderPanel;
  onBack: () => void;
  onFlip: (delta: number) => void;
  onSetMode: (mode: Mode) => void;
  onToggleDirection: () => void;
  onCycleFit: () => void;
  onZoom: (delta: number) => void;
  onToggleMask: () => void;
  onToggleFullscreen: () => void;
  onOpenPanel: (panel: ReaderPanel) => void;
  onImport: () => void;
  onPanelHoverChange: (hovering: boolean) => void;
};

const FIT_LABEL: Record<Fit, string> = { width: "适配宽", height: "适配高", original: "原始" };

export function ReaderToolbar(props: ReaderToolbarProps) {
  const {
    visible,
    title,
    isRemote,
    pageIndex,
    pageCount,
    mode,
    direction,
    fit,
    masked,
    activePanel,
    onBack,
    onFlip,
    onSetMode,
    onToggleDirection,
    onCycleFit,
    onZoom,
    onToggleMask,
    onToggleFullscreen,
    onOpenPanel,
    onImport,
    onPanelHoverChange,
  } = props;

  return (
    <Presence>
      {visible ? (
        <FadeInOut
          y={-12}
          className="reader-chrome reader-toolbar"
          onMouseEnter={() => onPanelHoverChange(true)}
          onMouseLeave={() => onPanelHoverChange(false)}
        >
          <button type="button" className="back-button" onClick={onBack}>
            <ArrowLeft size={17} />
            {isRemote ? "返回发现" : "返回库"}
          </button>

          <span className="reader-title" title={title}>
            {title}
          </span>

          <button type="button" onClick={() => onFlip(-1)} disabled={pageIndex <= 1} aria-label="上一页">
            <ChevronLeft size={17} />
          </button>
          <button type="button" onClick={() => onFlip(1)} disabled={pageIndex >= pageCount} aria-label="下一页">
            <ChevronRight size={17} />
          </button>

          <button
            type="button"
            className={mode === "webtoon" ? "active" : ""}
            onClick={() => onSetMode(mode === "webtoon" ? "single" : "webtoon")}
            aria-label="滚动阅读"
          >
            <ScrollText size={17} />
            滚动阅读
          </button>

          <button type="button" onClick={onToggleDirection} aria-label="阅读方向">
            {direction === "rtl" ? "右→左" : "左→右"}
          </button>

          <button type="button" onClick={onCycleFit} aria-label="适配模式">
            {FIT_LABEL[fit]}
          </button>

          {mode === "single" ? (
            <>
              <button type="button" onClick={() => onZoom(-1)} aria-label="缩小">
                <Minus size={17} />
              </button>
              <button type="button" onClick={() => onZoom(1)} aria-label="放大">
                <Plus size={17} />
              </button>
            </>
          ) : null}

          <button type="button" className={masked ? "active" : ""} onClick={onToggleMask} aria-label="隐私遮罩">
            <EyeOff size={17} />
          </button>
          <button type="button" onClick={onToggleFullscreen} aria-label="全屏">
            <Maximize size={17} />
          </button>
          <button
            type="button"
            className={activePanel === "thumbnails" ? "active" : ""}
            onClick={() => onOpenPanel("thumbnails")}
            aria-label="缩略图"
          >
            <ImageIcon size={17} />
          </button>
          <button
            type="button"
            className={activePanel === "info" ? "active" : ""}
            onClick={() => onOpenPanel("info")}
            aria-label="信息"
          >
            <Info size={17} />
          </button>

          {isRemote ? (
            <button type="button" className="primary-action" onClick={onImport}>
              <Download size={17} />
              加入队列
            </button>
          ) : null}
        </FadeInOut>
      ) : null}
    </Presence>
  );
}
