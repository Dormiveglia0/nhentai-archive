import { useEffect, useRef, useState } from "react";

import { Presence, FadeInOut } from "../../lib/motion";

type ReaderJumpDialogProps = {
  open: boolean;
  pageCount: number;
  onJump: (pageIndex: number) => void;
  onClose: () => void;
};

/** 沉浸式居中跳页输入层。回车跳转、Esc 取消;输入框聚焦时全局快捷键被忽略(INPUT 守卫)。 */
export function ReaderJumpDialog({ open, pageCount, onJump, onClose }: ReaderJumpDialogProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setValue("");
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  const submit = () => {
    const next = Number(value);
    if (Number.isFinite(next) && next >= 1 && pageCount > 0) {
      onJump(Math.min(Math.round(next), pageCount));
    }
    onClose();
  };

  return (
    <Presence>
      {open ? (
        <FadeInOut className="reader-jump-backdrop" onClick={onClose}>
          <div className="reader-jump" onClick={(event) => event.stopPropagation()}>
            <p>跳转到哪一页？</p>
            <input
              ref={inputRef}
              type="number"
              min={1}
              max={pageCount}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submit();
                else if (event.key === "Escape") onClose();
              }}
            />
            <small>/ {pageCount} 页 · 回车跳转 · Esc 取消</small>
          </div>
        </FadeInOut>
      ) : null}
    </Presence>
  );
}
