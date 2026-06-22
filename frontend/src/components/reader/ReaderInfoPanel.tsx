import { Download, Star, X } from "lucide-react";

import { Presence, FadeInOut } from "../../lib/motion";
import { navigate } from "../../lib/navigation";
import { Direction, Fit, Mode } from "./readerHelpers";

type ReaderInfoPanelProps = {
  open: boolean;
  title: string;
  coverSrc: string | null;
  tags: { id: number; type: string; display: string }[];
  progressPercent: number;
  isRemote: boolean;
  workId: number | null;
  mode: Mode;
  direction: Direction;
  fit: Fit;
  onSetMode: (mode: Mode) => void;
  onToggleDirection: () => void;
  onCycleFit: () => void;
  onMarkCompleted: () => void;
  onImport: () => void;
  onClose: () => void;
  onHoverChange: (hovering: boolean) => void;
};

const FIT_LABEL = { width: "适配宽度", height: "适配高度", original: "原始尺寸" } as const;

export function ReaderInfoPanel(props: ReaderInfoPanelProps) {
  const {
    open,
    title,
    coverSrc,
    tags,
    progressPercent,
    isRemote,
    workId,
    mode,
    direction,
    fit,
    onSetMode,
    onToggleDirection,
    onCycleFit,
    onMarkCompleted,
    onImport,
    onClose,
    onHoverChange,
  } = props;

  return (
    <Presence>
      {open ? (
        <FadeInOut
          x={16}
          className="reader-chrome reader-panel reader-info-panel"
          onMouseEnter={() => onHoverChange(true)}
          onMouseLeave={() => onHoverChange(false)}
        >
          <header className="reader-panel-head">
            <strong>作品信息</strong>
            <button type="button" onClick={onClose} aria-label="关闭">
              <X size={16} />
            </button>
          </header>

          <div className="reader-info-meta">
            {coverSrc ? <img src={coverSrc} alt="" draggable={false} /> : null}
            <h2>{title}</h2>
            <p>当前进度 {progressPercent}%</p>
            {isRemote ? <small>远端只读预览，不保存阅读进度</small> : null}
            {tags.length > 0 ? (
              <ul className="reader-info-tags">
                {tags.map((tag) => (
                  <li key={tag.id} data-type={tag.type}>
                    {tag.display}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="reader-info-actions">
            {!isRemote ? (
              <button type="button" onClick={onMarkCompleted}>
                <Star size={16} />
                标记已读
              </button>
            ) : (
              <button type="button" onClick={onImport}>
                <Download size={16} />
                加入导入队列
              </button>
            )}
            {!isRemote && workId != null ? (
              <button type="button" onClick={() => navigate({ name: "governance", workId })}>
                进入治理
              </button>
            ) : null}
          </div>

          <div className="reader-info-settings">
            <h3>阅读设置</h3>
            <div className="reader-setting-row">
              <span>模式</span>
              <div className="reader-segmented">
                <button type="button" className={mode === "single" ? "active" : ""} onClick={() => onSetMode("single")}>
                  单页
                </button>
                <button type="button" className={mode === "webtoon" ? "active" : ""} onClick={() => onSetMode("webtoon")}>
                  连续滚动
                </button>
              </div>
            </div>
            <div className="reader-setting-row">
              <span>方向</span>
              <button type="button" onClick={onToggleDirection}>
                {direction === "rtl" ? "右 → 左" : "左 → 右"}
              </button>
            </div>
            <div className="reader-setting-row">
              <span>适配</span>
              <button type="button" onClick={onCycleFit}>
                {FIT_LABEL[fit]}
              </button>
            </div>
          </div>
        </FadeInOut>
      ) : null}
    </Presence>
  );
}
