import type { ImgHTMLAttributes } from "react";

import "./AmbientCover.css";

type Props = {
  src: string;
  alt: string;
  privateBlur?: boolean;
  className?: string;
  loading?: ImgHTMLAttributes<HTMLImageElement>["loading"];
  draggable?: boolean;
  onError?: ImgHTMLAttributes<HTMLImageElement>["onError"];
};

export function AmbientCover({
  src,
  alt,
  privateBlur = false,
  className = "",
  loading,
  draggable,
  onError,
}: Props) {
  const classes = ["folio-ambient-cover", privateBlur ? "is-private" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes}>
      <img
        className="folio-ambient-cover-backdrop"
        src={src}
        alt=""
        aria-hidden="true"
        loading={loading}
        decoding="async"
        draggable={false}
      />
      <img
        className="folio-ambient-cover-artwork"
        src={src}
        alt={alt}
        loading={loading}
        decoding="async"
        draggable={draggable}
        onLoad={({ currentTarget: image }) => {
          image.dataset.orientation = image.naturalWidth > image.naturalHeight ? "landscape" : "portrait";
        }}
        onError={onError}
      />
    </span>
  );
}
