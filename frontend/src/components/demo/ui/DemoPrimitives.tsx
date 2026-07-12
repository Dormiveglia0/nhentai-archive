import { ArrowRight, Check, ChevronDown, Search, Settings } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useId, useRef, useState } from "react";

import { duration, ease } from "../../../lib/motion";

export function PanelHeading({ title, description }: { title: string; description: string }) {
  return (
    <header className="folio-demo-panel-heading">
      <h2>{title}</h2>
      <p>{description}</p>
    </header>
  );
}

export function EmptyCanvas({
  icon: Icon,
  title,
  copy,
  action,
  onAction,
}: {
  icon: typeof Settings;
  title: string;
  copy: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="folio-demo-empty">
      <div className="folio-demo-empty-mark"><Icon size={23} /></div>
      <strong>{title}</strong>
      <p>{copy}</p>
      {action && onAction ? <button type="button" onClick={onAction}>{action}<ArrowRight size={14} /></button> : null}
    </div>
  );
}

export function SearchField({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="folio-demo-search-field">
      <Search size={16} />
      <input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      <i />
    </label>
  );
}

export function DemoField({
  label,
  value,
  onChange,
  placeholder,
  readOnly,
  wide,
  type = "text",
}: {
  label: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  wide?: boolean;
  type?: "text" | "number";
}) {
  return (
    <label className={"folio-demo-field" + (wide ? " folio-demo-field-wide" : "")}>
      <span>{label}</span>
      <input
        type={type}
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        placeholder={placeholder}
        readOnly={readOnly}
      />
      <i />
    </label>
  );
}

export function DemoSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value) ?? options[0];

  function move(step: number) {
    const currentIndex = Math.max(0, options.findIndex((option) => option.value === value));
    const nextIndex = (currentIndex + step + options.length) % options.length;
    onChange(options[nextIndex].value);
    setOpen(true);
  }

  return (
    <div
      className={"folio-demo-select" + (open ? " is-open" : "")}
      ref={rootRef}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        setOpen(false);
        rootRef.current?.querySelector<HTMLButtonElement>(":scope > button")?.focus();
      }}
      onBlur={() => window.requestAnimationFrame(() => {
        if (!rootRef.current?.contains(document.activeElement)) setOpen(false);
      })}
    >
      <span>{label}</span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            move(1);
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            move(-1);
          }
          if (event.key === "Escape") setOpen(false);
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <m.strong
            key={selected.value}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: duration.fast, ease: ease.standard }}
          >
            {selected.label}
          </m.strong>
        </AnimatePresence>
        <ChevronDown size={15} />
      </button>
      <AnimatePresence>
        {open ? (
          <m.div
            className="folio-demo-select-menu"
            id={listId}
            role="listbox"
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: duration.fast, ease: ease.standard }}
          >
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                className={option.value === value ? "is-selected" : ""}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span>{option.label}</span>
                <AnimatePresence>
                  {option.value === value ? (
                    <m.span initial={{ opacity: 0, scale: 0.4, rotate: -30 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} exit={{ opacity: 0, scale: 0.4 }}>
                      <Check size={14} />
                    </m.span>
                  ) : null}
                </AnimatePresence>
              </button>
            ))}
          </m.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function ToggleRow({
  label,
  copy,
  checked,
  onChange,
}: {
  label: string;
  copy: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className={"folio-demo-toggle-row" + (checked ? " is-active" : "")}>
      <span><strong>{label}</strong><small>{copy}</small></span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <i aria-hidden="true"><span /></i>
    </label>
  );
}

