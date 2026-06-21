import { CSSProperties, forwardRef, useState } from "react";
import { RotateCw } from "lucide-react";

type ReaderImageProps = {
  src: string;
  alt: string;
  className?: string;
  style?: CSSProperties;
  loading?: "lazy" | "eager";
  /** 供 webtoon 观察当前页用,渲染为 data-page-index */
  pageIndex?: number;
};

/**
 * 阅读页图片,自带加载失败占位 + 重试。重试通过改变内部 key 强制重挂 <img>
 * 触发同一 src 的重新请求(失败响应不进缓存),避免给远端 URL 追加查询参数。
 * forwardRef 指向 <img>,供 webtoon 的 IntersectionObserver 收集节点。
 */
export const ReaderImage = forwardRef<HTMLImageElement, ReaderImageProps>(function ReaderImage(
  { src, alt, className, style, loading, pageIndex },
  ref
) {
  const [attempt, setAttempt] = useState(0);
  const [errored, setErrored] = useState(false);

  if (errored) {
    return (
      <div className={className ? `reader-img-error ${className}` : "reader-img-error"} style={style} data-page-index={pageIndex}>
        <span>图片加载失败</span>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setErrored(false);
            setAttempt((n) => n + 1);
          }}
        >
          <RotateCw size={15} />
          重试
        </button>
      </div>
    );
  }

  return (
    <img
      key={attempt}
      ref={ref}
      className={className}
      style={style}
      src={src}
      alt={alt}
      loading={loading}
      draggable={false}
      data-page-index={pageIndex}
      onError={() => setErrored(true)}
    />
  );
});
