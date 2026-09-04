import { useCallback, useEffect, useRef, useState, type CSSProperties, type RefCallback } from "react";

export function useGridColumns(): [RefCallback<HTMLDivElement>, number] {
  const observer = useRef<ResizeObserver | null>(null);
  const [columns, setColumns] = useState(0);

  const ref = useCallback<RefCallback<HTMLDivElement>>((node) => {
    observer.current?.disconnect();
    if (!node) return;

    const measure = () => {
      const style = getComputedStyle(node);
      const tracks = style.gridTemplateColumns.trim();
      const explicitColumns = Number.parseInt(style.columnCount, 10);
      const columnWidth = Number.parseFloat(style.columnWidth);
      const columnGap = Number.parseFloat(style.columnGap) || 0;
      const next = tracks && tracks !== "none"
        ? tracks.split(/\s+/).length
        : Number.isFinite(explicitColumns)
          ? explicitColumns
          : Number.isFinite(columnWidth)
            ? Math.max(1, Math.floor((node.clientWidth + columnGap) / (columnWidth + columnGap)))
            : 1;
      setColumns((current) => current === next ? current : next);
    };
    measure();
    observer.current = new ResizeObserver(measure);
    observer.current.observe(node);
  }, []);

  useEffect(() => () => observer.current?.disconnect(), []);
  return [ref, columns];
}

export function completeGridRows(minimumItems: number, columns: number) {
  return columns > 0 ? Math.ceil(minimumItems / columns) * columns : 0;
}

type BalancedGridStyle = CSSProperties & {
  "--folio-grid-tracks": number;
  "--folio-grid-span": number;
  "--folio-grid-tail-span": number;
};

export function balanceGridRows(itemCount: number, maxColumns: number) {
  const count = Math.max(0, Math.trunc(itemCount));
  const columns = Math.max(1, Math.trunc(maxColumns));
  if (!count) return {
    style: { "--folio-grid-tracks": columns, "--folio-grid-span": 1, "--folio-grid-tail-span": 1 } as BalancedGridStyle,
    tailStart: 0,
  };

  const rows = Math.ceil(count / columns);
  const narrowRow = Math.floor(count / rows);
  const wideRow = Math.ceil(count / rows);
  const wideRows = count - narrowRow * rows;
  const tracks = narrowRow === wideRow ? wideRow : narrowRow * wideRow;

  return {
    style: {
      "--folio-grid-tracks": tracks,
      "--folio-grid-span": tracks / wideRow,
      "--folio-grid-tail-span": tracks / narrowRow,
    } as BalancedGridStyle,
    tailStart: wideRows ? wideRows * wideRow : count,
  };
}
