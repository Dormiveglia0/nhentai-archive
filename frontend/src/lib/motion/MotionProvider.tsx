import { LazyMotion, domAnimation } from "motion/react";
import type { ReactNode } from "react";

/**
 * 包裹应用根,按需同步加载 motion 的 domAnimation 特性包(animations/variants/
 * exit/hover-tap-focus),配合原语层的 `m` 组件而非全量 `motion`,显著减小打包体积。
 * strict 模式禁止误用 `motion.*`(会把全量特性拉回包里)。
 * 注:若后续阶段需要 layout / drag 动画,把 domAnimation 换成 domMax 即可。
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      {children}
    </LazyMotion>
  );
}
