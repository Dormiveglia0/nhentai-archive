import { m, AnimatePresence, type HTMLMotionProps, type Variants } from "motion/react";
import { forwardRef, type PropsWithChildren, type ReactNode } from "react";
import { duration, ease, stagger } from "./tokens";
import { usePrefersReducedMotion } from "./useReducedMotion";

type DivMotionProps = PropsWithChildren<{ className?: string; delay?: number }>;
type FadeInProps = Omit<HTMLMotionProps<"div">, "animate" | "initial" | "transition"> & {
  delay?: number;
  x?: number;
  y?: number;
};
type StaggerProps = Omit<HTMLMotionProps<"div">, "animate" | "initial" | "variants">;

/** 进场淡入,可选位移。reduced-motion 下退化为纯淡入。 */
export function FadeIn({
  children,
  className,
  delay = 0,
  x = 0,
  y = 0,
  ...rest
}: FadeInProps) {
  const reduce = usePrefersReducedMotion();
  return (
    <m.div
      className={className}
      initial={{ opacity: 0, x: reduce ? 0 : x, y: reduce ? 0 : y }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: duration.base, ease: ease.standard, delay }}
      {...rest}
    >
      {children}
    </m.div>
  );
}

type FadeInOutProps = Omit<
  HTMLMotionProps<"div">,
  "initial" | "animate" | "exit" | "transition"
> & { x?: number; y?: number; delay?: number };

/**
 * 进出场淡入淡出(可选位移)。必须作为 <Presence> 的直接子节点并带 key,
 * 才能在卸载时播放退场。透传其余 div 属性(onMouseDown / role / aria 等),
 * 适用于弹窗 backdrop 与卡片。reduced-motion 下退化为纯淡入淡出。
 */
export function FadeInOut({
  children,
  className,
  x = 0,
  y = 0,
  delay = 0,
  ...rest
}: FadeInOutProps) {
  const reduce = usePrefersReducedMotion();
  const offset = { x: reduce ? 0 : x, y: reduce ? 0 : y };
  return (
    <m.div
      className={className}
      initial={{ opacity: 0, ...offset }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, ...offset }}
      transition={{ duration: duration.base, ease: ease.standard, delay }}
      {...rest}
    >
      {children}
    </m.div>
  );
}

const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: stagger.base } },
};

/** 列表/网格容器,子项用 <StaggerItem> 逐项进场。 */
export const Stagger = forwardRef<HTMLDivElement, StaggerProps>(function Stagger({ children, className, ...rest }, ref) {
  return (
    <m.div
      ref={ref}
      {...rest}
      className={className}
      variants={staggerParent}
      initial="hidden"
      animate="show"
    >
      {children}
    </m.div>
  );
});

/** Stagger 的子项。 */
export function StaggerItem({ children, className }: DivMotionProps) {
  const reduce = usePrefersReducedMotion();
  const item: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : 12 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: duration.base, ease: ease.standard },
    },
  };
  return (
    <m.div className={className} variants={item}>
      {children}
    </m.div>
  );
}

/** 滚动进入视口时揭示。 */
export function Reveal({
  children,
  className,
  y = 16,
}: DivMotionProps & { y?: number }) {
  const reduce = usePrefersReducedMotion();
  return (
    <m.div
      className={className}
      initial={{ opacity: 0, y: reduce ? 0 : y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={{ duration: duration.base, ease: ease.standard }}
    >
      {children}
    </m.div>
  );
}

/** 路由/弹窗进出场。包装 AnimatePresence。 */
export function Presence({ children }: { children: ReactNode }) {
  return <AnimatePresence mode="wait">{children}</AnimatePresence>;
}
