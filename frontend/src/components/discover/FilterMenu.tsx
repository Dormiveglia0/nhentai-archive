import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Option = {
  value: string;
  label: string;
};

type Props = {
  value: string;
  options: Option[];
  disabled?: boolean;
  onChange: (value: string) => void;
};

export function FilterMenu({ value, options, disabled = false, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const current = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return (
    <div ref={ref} className={open ? "filter-menu open" : "filter-menu"}>
      <button type="button" disabled={disabled} onClick={() => setOpen((value) => !value)}>
        <span>{current.label}</span>
        <ChevronDown size={15} />
      </button>
      {open ? (
        <div className="filter-menu-list">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={option.value === value ? "active" : ""}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
