// 效果来源:magicui "Number Ticker"(https://magicui.design/docs/components/number-ticker)
// 思路并参考 react-bits "Count Up"。已按 effects/README.md 改造:丢弃原模板布局/配色,
// 仅保留「真实数值用弹簧从 0 计数到目标值」的动效;计数始终收敛到传入的真实值,
// 不伪造任何数字。reduced-motion 下直接显示真实值,不做动画。
import { useEffect, useRef } from "react";
import { useInView, useMotionValue, useSpring } from "motion/react";

import { usePrefersReducedMotion } from "../../lib/motion";

type Props = {
  value: number;
  /** 可选格式化(默认按千分位整数)。计数中途也会经此格式化。 */
  format?: (n: number) => string;
};

export function NumberTicker({ value, format }: Props) {
  const reduce = usePrefersReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const formatRef = useRef(format);
  formatRef.current = format;

  const render = (n: number): string =>
    formatRef.current ? formatRef.current(n) : Math.round(n).toLocaleString("zh-CN");

  const motionValue = useMotionValue(reduce ? value : 0);
  const spring = useSpring(motionValue, { damping: 30, stiffness: 140 });
  const inView = useInView(ref, { once: true });

  // 进入视口后把目标设为真实值;reduced-motion 直接写真实值。
  useEffect(() => {
    if (reduce) {
      if (ref.current) ref.current.textContent = render(value);
      return;
    }
    if (inView) motionValue.set(value);
    // render 依赖 formatRef(可变引用),无需进依赖表
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, value, reduce, motionValue]);

  // 弹簧每帧把当前值格式化写进 DOM(避免每帧 React 重渲染)。
  useEffect(() => {
    if (reduce) return;
    const unsubscribe = spring.on("change", (latest) => {
      if (ref.current) ref.current.textContent = render(latest);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spring, reduce]);

  return (
    <span ref={ref} className="fx-scope">
      {render(reduce ? value : 0)}
    </span>
  );
}
