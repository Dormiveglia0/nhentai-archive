import { motion, AnimatePresence, type Variants } from "motion/react";
import type { PropsWithChildren, ReactNode } from "react";
import { duration, ease, stagger } from "./tokens";
import { usePrefersReducedMotion } from "./useReducedMotion";

type DivMotionProps = PropsWithChildren<{ className?: string; delay?: number }>;

/** 进场淡入,可选位移。reduced-motion 下退化为纯淡入。 */
export function FadeIn({
  children,
  className,
  delay = 0,
  x = 0,
  y = 0,
}: DivMotionProps & { x?: number; y?: number }) {
  const reduce = usePrefersReducedMotion();
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, x: reduce ? 0 : x, y: reduce ? 0 : y }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: duration.base, ease: ease.standard, delay }}
    >
      {children}
    </motion.div>
  );
}

const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: stagger.base } },
};

/** 列表/网格容器,子项用 <StaggerItem> 逐项进场。 */
export function Stagger({ children, className }: DivMotionProps) {
  return (
    <motion.div
      className={className}
      variants={staggerParent}
      initial="hidden"
      animate="show"
    >
      {children}
    </motion.div>
  );
}

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
    <motion.div className={className} variants={item}>
      {children}
    </motion.div>
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
    <motion.div
      className={className}
      initial={{ opacity: 0, y: reduce ? 0 : y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={{ duration: duration.base, ease: ease.standard }}
    >
      {children}
    </motion.div>
  );
}

/** 路由/弹窗进出场。包装 AnimatePresence。 */
export function Presence({ children }: { children: ReactNode }) {
  return <AnimatePresence mode="wait">{children}</AnimatePresence>;
}
