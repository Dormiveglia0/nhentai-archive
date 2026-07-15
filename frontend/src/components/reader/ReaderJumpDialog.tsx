import { ArrowRight, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";

import { FadeInOut, Presence } from "../../lib/motion";
import { trapDialogFocus } from "./readerDialogFocus";
import "./ReaderPanels.css";

type ReaderJumpDialogProps = {
  open: boolean;
  pageCount: number;
  onJump: (pageIndex: number) => void;
  onClose: () => void;
};

export function ReaderJumpDialog({ open, pageCount, onJump, onClose }: ReaderJumpDialogProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    setValue("");
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      previous?.focus();
    };
  }, [open]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const next = Number(value);
    if (Number.isInteger(next) && next >= 1 && pageCount > 0) onJump(Math.min(next, pageCount));
    onClose();
  }

  return (
    <Presence>
      {open ? (
        <FadeInOut className="reader-jump-backdrop" onClick={onClose}>
          <form className="reader-jump" role="dialog" aria-modal="true" aria-labelledby="reader-jump-title" onSubmit={submit} onClick={(event) => event.stopPropagation()} onKeyDown={trapDialogFocus}>
            <header><span><small>QUICK NAVIGATION</small><strong id="reader-jump-title">跳转页面</strong></span><button type="button" onClick={onClose} aria-label="关闭跳页"><X size={17} /></button></header>
            <label>
              <span>目标页码</span>
              <div><input ref={inputRef} autoFocus type="text" inputMode="numeric" value={value} onChange={(event) => setValue(event.target.value.replace(/\D/g, ""))} aria-describedby="reader-jump-help" /><small>/ {pageCount}</small></div>
            </label>
            <p id="reader-jump-help">输入 1 至 {pageCount} 的页码，也可按 Esc 取消。</p>
            <button className="reader-jump-submit" type="submit" disabled={!value}><span>前往该页</span><ArrowRight size={16} /></button>
          </form>
        </FadeInOut>
      ) : null}
    </Presence>
  );
}
