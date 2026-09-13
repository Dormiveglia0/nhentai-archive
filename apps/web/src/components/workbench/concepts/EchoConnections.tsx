import { m } from "motion/react";
import { type RefObject, useLayoutEffect, useState } from "react";

type Branch = { key: string; d: string; work?: number; primary?: boolean };

export function EchoConnections({ stage, revision, active, reduced }: {
  stage: RefObject<HTMLDivElement>; revision: string; active?: number; reduced: boolean;
}) {
  const [paths, setPaths] = useState<Branch[]>([]);
  useLayoutEffect(() => {
    const node = stage.current;
    if (!node) return;
    let frame = 0;
    const measure = () => {
      const bounds = node.getBoundingClientRect();
      const anchors = [...node.querySelectorAll<HTMLElement>('[data-echo-anchor]')];
      const point = (el: HTMLElement) => {
        const rect = el.getBoundingClientRect();
        return { x: rect.left + rect.width / 2 - bounds.left, y: rect.top + rect.height / 2 - bounds.top };
      };
      const root = anchors.find(el => el.dataset.echoAnchor === 'root');
      if (!root || !bounds.width) return;
      const center = point(root), next: Branch[] = [];
      const origin = node.querySelector('.echo-center')!.getBoundingClientRect();
      const inlet = { x: origin.left - bounds.left - 18, y: center.y };
      const outlet = { x: origin.right - bounds.left + 18, y: center.y };
      const historyEdge = Math.min(inlet.x - 30, Math.max(0, ...anchors.filter(el => el.dataset.echoAnchor?.startsWith('past:')).map(el => point(el).x)) + 24);
      const curve = (a: { x: number; y: number }, b: { x: number; y: number }) => {
        const bend = Math.max(35, Math.abs(b.x - a.x) * .55);
        return `M${a.x} ${a.y}C${a.x + bend} ${a.y} ${b.x - bend} ${b.y} ${b.x} ${b.y}`;
      };
      for (const anchor of anchors) {
        const key = anchor.dataset.echoAnchor!;
        if (key === 'root') continue;
        if (key.startsWith('past:')) {
          const a = point(anchor);
          next.push({ key, d: `M${a.x} ${a.y}H${historyEdge}C${historyEdge + 25} ${a.y} ${inlet.x - 25} ${inlet.y} ${inlet.x} ${inlet.y}S${center.x - 40} ${center.y} ${center.x} ${center.y}`, work: Number(anchor.dataset.work) });
        }
        if (key.startsWith('group:')) next.push({ key, d: `M${center.x} ${center.y}C${center.x + 40} ${center.y} ${outlet.x - 20} ${outlet.y} ${outlet.x} ${outlet.y}${curve(outlet, point(anchor)).replace(/^M[^C]+/, "")}`, primary: true });
        if (key.startsWith('work:')) {
          const group = anchors.find(el => el.dataset.echoAnchor === `group:${anchor.dataset.group}`);
          if (group) next.push({ key, d: curve(point(group), point(anchor)), work: Number(anchor.dataset.work) });
        }
      }
      setPaths(next);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(schedule);
    observer.observe(node);
    node.querySelectorAll<HTMLElement>('[data-echo-anchor], .echo-center, .echo-branch').forEach(el => observer.observe(el));
    schedule();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [stage, revision]);
  return <svg className="echo-lines" aria-hidden="true">
    {paths.map(path => <m.path key={path.key} data-echo-path={path.key} className={`${path.primary ? 'is-primary' : ''}${path.work === active ? ' is-active' : ''}`} initial={reduced ? false : { opacity: 0, pathLength: 0 }} animate={{ d: path.d, opacity: 1, pathLength: 1 }} transition={{ duration: reduced ? 0 : .6 }} />)}
    {paths.filter(path => path.primary).map(path => <path key={`flow-${path.key}`} className="echo-flow" d={path.d} />)}
  </svg>;
}
