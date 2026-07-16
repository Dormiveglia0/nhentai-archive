// 效果来源:magicui "Shine Border"(https://magicui.design/docs/components/shine-border)。
// 已按 effects/README.md 改造:仅保留高光描边效果,配色改用现有 --accent token,
// 去除原模板的卡片布局/文案,reduced-motion 下退化为静态描边。
import type { ReactNode } from "react";
import { useId } from "react";
import { usePrefersReducedMotion } from "../../lib/motion";

export function ShineBorder({ children }: { children: ReactNode }) {
  const reduce = usePrefersReducedMotion();
  const id = useId().replace(/:/g, "");
  return (
    <div className="fx-scope" style={{ position: "relative", borderRadius: 14 }}>
      <style>{`
        @property --shine-angle-${id} { syntax: "<angle>"; initial-value: 0deg; inherits: false; }
        @keyframes shine-${id} { to { --shine-angle-${id}: 360deg; } }
        .shine-${id} {
          position: absolute; inset: 0; border-radius: inherit; padding: 1px; pointer-events: none;
          background: conic-gradient(from var(--shine-angle-${id}),
            transparent 0deg, var(--accent) 60deg, transparent 120deg, transparent 360deg);
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor; mask-composite: exclude;
          ${reduce ? "" : `animation: shine-${id} 4s linear infinite;`}
        }
      `}</style>
      <span className={`shine-${id}`} aria-hidden />
      <div
        style={{
          position: "relative",
          borderRadius: "inherit",
          background: "var(--surface-solid)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
