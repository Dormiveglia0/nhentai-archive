import { CSSProperties, forwardRef, type Ref, useEffect, useRef, useState } from "react";
import { RotateCw } from "lucide-react";
import "./ReaderPanels.css";

type ReaderImageProps = {
  src: string; alt: string; className?: string; style?: CSSProperties;
  width?: number; height?: number; loading?: "lazy" | "eager";
  pageIndex?: number; retryToken: number; onRetry: () => void;
};

export const ReaderImage = forwardRef<HTMLElement, ReaderImageProps>(function ReaderImage(
  { src, alt, className, style, width, height, loading, pageIndex, retryToken, onRetry }, ref
) {
  const [displayedSrc, setDisplayedSrc] = useState(src);
  const [attempt, setAttempt] = useState(0);
  const [errored, setErrored] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const imageNode = useRef<HTMLImageElement | null>(null);
  const lastRetryToken = useRef(retryToken);
  useEffect(() => {
    if (src === displayedSrc) return;
    if (!src && displayedSrc && imageNode.current?.naturalWidth) return;
    // Keep a decoded identical remote page until its local replacement is ready.
    if (src && imageNode.current?.complete && imageNode.current.naturalWidth && !errored) {
      let alive = true;
      const next = new Image();
      next.onload = () => { void next.decode().catch(() => undefined).then(() => { if (alive) { setDisplayedSrc(src); setErrored(false); } }); };
      next.onerror = () => { /* Preserve the verified page; bulk retry also retries this handover. */ };
      next.src = src;
      return () => { alive = false; next.onload = null; next.onerror = null; next.src = ""; };
    }
    setDisplayedSrc(src); setErrored(false);
  }, [src, displayedSrc, errored, retryToken]);
  useEffect(() => {
    if (lastRetryToken.current === retryToken) return;
    lastRetryToken.current = retryToken;
    if (!errored) return;
    setErrored(false); setLoaded(false); setAttempt(value => value + 1);
  }, [errored, retryToken]);

  const reserved = width && height ? { aspectRatio: `${width} / ${height}`, ...style } : style;
  if (errored || !displayedSrc) return <div ref={ref as Ref<HTMLDivElement>} className={`${errored ? "reader-img-error" : "reader-image-pending"} ${className || ""}`} style={reserved} data-page-index={pageIndex}>
    <span>{errored ? "图片加载失败" : "正在读取页面…"}</span>
    {errored ? <button type="button" onClick={event => { event.stopPropagation(); onRetry(); }}><RotateCw size={15} />重试全部</button> : null}
  </div>;
  return <img key={attempt} ref={node => {
    imageNode.current = node;
    if (typeof ref === "function") ref(node); else if (ref) ref.current = node;
  }} className={`${className || ""}${loaded ? "" : " reader-image-loading"}`} style={reserved} src={displayedSrc} alt={alt} loading={loading} width={width} height={height}
    onLoad={() => setLoaded(true)}
    decoding="async" draggable={false} data-page-index={pageIndex} onError={event => { if (event.currentTarget.getAttribute("src") === displayedSrc) setErrored(true); }} />;
});
