import { Check, LockKeyhole, Settings, SlidersHorizontal } from "lucide-react";

export function SettingsScene() {
  return (
    <>
      <g className="folio-scene-settings-console">
        <rect x="66" y="35" width="408" height="160" rx="4" />
        <path d="M66 72h408M202 72v123M338 72v123M88 174h364" />
        <circle cx="84" cy="54" r="4" />
        <circle cx="98" cy="54" r="4" />
        <rect className="folio-scene-settings-cursor" x="76" y="82" width="116" height="78" rx="2" />
      </g>
      <g className="folio-scene-settings-cell folio-scene-settings-cell-a">
        <SlidersHorizontal x={107} y={93} width={54} height={54} strokeWidth={1.15} />
      </g>
      <g className="folio-scene-settings-cell folio-scene-settings-cell-b">
        <Settings x={243} y={93} width={54} height={54} strokeWidth={1.15} />
      </g>
      <g className="folio-scene-settings-cell folio-scene-settings-cell-c">
        <LockKeyhole x={379} y={93} width={54} height={54} strokeWidth={1.15} />
      </g>
      <g className="folio-scene-settings-status">
        <path className="folio-scene-settings-status-track" d="M134 174h272" />
        <path className="folio-scene-settings-status-value" pathLength="100" d="M134 174h272" />
        <circle cx="134" cy="174" r="4" />
        <Check x={424} y={163} width={22} height={22} strokeWidth={1.35} />
      </g>
    </>
  );
}
