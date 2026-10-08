import { ArrowLeft, BookOpen, Download, Image as ImageIcon, Info, LoaderCircle, Maximize, Minus, Plus, ScrollText, SlidersHorizontal } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { FadeInOut, Presence, SlidingIndicator } from "../../lib/motion";
import type { Direction, Fit, Mode, ReaderPanel } from "./readerHelpers";
import "./ReaderToolbar.css";

type Props = {
  visible: boolean; title: string; isRemote: boolean; mode: Mode; direction: Direction; fit: Fit; zoom: number;
  importing: boolean; queued: boolean; activePanel: ReaderPanel;
  onBack: () => void; onSetMode: (mode: Mode) => void; onToggleDirection: () => void; onCycleFit: () => void;
  onZoom: (delta: number) => void; onResetZoom: () => void; onToggleFullscreen: () => void;
  onOpenPanel: (panel: ReaderPanel) => void; onImport: () => void; onPanelHoverChange: (active: boolean) => void;
};
const FIT_LABEL: Record<Fit, string> = { width: "适配宽度", height: "适配高度", original: "原始尺寸" };

export function ReaderToolbar(props: Props) {
  const optionsId = useId();
  const optionsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = optionsRef.current;
    if (!node) return;
    const toggle = () => props.onPanelHoverChange(node.matches(":popover-open") || Boolean(node.closest(".reader-toolbar")?.querySelector(":focus-visible")));
    node.addEventListener("toggle", toggle);
    return () => node.removeEventListener("toggle", toggle);
  }, [props.visible, props.onPanelHoverChange]);
  function pin(active: boolean, node: HTMLElement) {
    props.onPanelHoverChange(active || Boolean(node.querySelector(":focus-visible, :popover-open")));
  }
  return <Presence>{props.visible ? <FadeInOut y={-12} className="reader-chrome reader-toolbar" role="toolbar" aria-label="阅读控制栏"
    onMouseEnter={event => pin(true, event.currentTarget)} onMouseLeave={event => pin(false, event.currentTarget)}
    onFocusCapture={event => pin(true, event.currentTarget)}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) props.onPanelHoverChange(Boolean(event.currentTarget.querySelector(":popover-open"))); }}>
    <div className="reader-toolbar-identity">
      <button className="reader-back-button" type="button" onClick={props.onBack} aria-label={props.isRemote ? "返回发现" : "返回我的库"}><ArrowLeft size={20} /><span>返回</span></button>
      <span className="reader-title"><strong title={props.title}>{props.title}</strong></span>
    </div>
    <div className="reader-toolbar-controls">
      <div className="reader-control-group" aria-label="辅助控制">
        <button type="button" onClick={props.onToggleFullscreen} aria-label="全屏" title="全屏"><Maximize size={18} /></button>
        <button type="button" className={props.activePanel === "thumbnails" ? "is-active" : ""} aria-pressed={props.activePanel === "thumbnails"} onClick={() => props.onOpenPanel("thumbnails")} aria-label="页面索引" title="页面索引"><ImageIcon size={18} /></button>
        <button type="button" className={props.activePanel === "info" ? "is-active" : ""} aria-pressed={props.activePanel === "info"} onClick={() => props.onOpenPanel("info")} aria-label="作品信息" title="作品信息"><Info size={18} /></button>
        <button type="button" {...{ popovertarget: optionsId }} aria-label="阅读设置" title="阅读设置"><SlidersHorizontal size={18} /></button>
      </div>
      {props.isRemote ? <button className="reader-import-button" type="button" onClick={props.onImport} disabled={props.importing || props.queued} aria-label={props.queued ? "已加入队列" : "加入队列"} aria-busy={props.importing}>
        {props.importing ? <LoaderCircle className="reader-loading-icon" size={17} /> : <Download size={17} />}<span>{props.queued ? "已加入" : props.importing ? "正在加入" : "加入队列"}</span>
      </button> : null}
    </div>
    <div ref={optionsRef} id={optionsId} {...{ popover: "auto" }} className="reader-display-options">
      <h2>阅读设置</h2>
      <div className="reader-option-row"><span>阅读模式</span><div className="reader-mode-choice" role="group" aria-label="阅读模式">
        <button className="folio-slide-choice" type="button" aria-pressed={props.mode === "single"} onClick={() => props.onSetMode("single")}>{props.mode === "single" ? <SlidingIndicator layoutId="reader-mode-choice" /> : null}<BookOpen size={16} />单页</button>
        <button className="folio-slide-choice" type="button" aria-pressed={props.mode === "webtoon"} onClick={() => props.onSetMode("webtoon")}>{props.mode === "webtoon" ? <SlidingIndicator layoutId="reader-mode-choice" /> : null}<ScrollText size={16} />连续</button>
      </div></div>
      <div className="reader-option-row"><span>页面适配</span><button type="button" onClick={props.onCycleFit}>{FIT_LABEL[props.fit]}</button></div>
      {props.mode === "single" ? <>
        <div className="reader-option-row"><span>阅读方向</span><button type="button" onClick={props.onToggleDirection}>{props.direction === "rtl" ? "从右到左" : "从左到右"}</button></div>
        <div className="reader-option-row"><span>缩放</span><div className="reader-zoom-group">
          <button type="button" onClick={() => props.onZoom(-1)} aria-label="缩小"><Minus size={16} /></button>
          <button type="button" onClick={props.onResetZoom} aria-label="重置缩放">{Math.round(props.zoom * 100)}%</button>
          <button type="button" onClick={() => props.onZoom(1)} aria-label="放大"><Plus size={16} /></button>
        </div></div>
      </> : null}
    </div>
  </FadeInOut> : null}</Presence>;
}
