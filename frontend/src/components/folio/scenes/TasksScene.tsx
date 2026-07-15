import { ArrowRight } from "lucide-react";

export function TasksScene() {
  return (
    <>
      <g className="folio-scene-task-columns">
        <rect x="51" y="28" width="136" height="174" rx="5" />
        <rect className="folio-scene-task-column-running" x="202" y="28" width="136" height="174" rx="5" />
        <rect x="353" y="28" width="136" height="174" rx="5" />
        <circle cx="70" cy="49" r="5" />
        <circle cx="221" cy="49" r="5" />
        <circle cx="372" cy="49" r="5" />
      </g>
      <g className="folio-scene-task-card folio-scene-task-card-main">
        <rect x="68" y="78" width="102" height="61" rx="4" />
        <circle cx="86" cy="98" r="6" />
        <path d="M101 94h49M80 120h70" />
        <path className="folio-scene-task-progress" pathLength="100" d="M80 127h70" />
      </g>
      <g className="folio-scene-task-card folio-scene-task-card-waiting">
        <rect x="68" y="151" width="102" height="35" rx="4" />
        <circle cx="85" cy="168" r="5" />
        <path d="M98 168h52" />
      </g>
      <g className="folio-scene-task-transfer">
        <ArrowRight x={177} y={99} width={24} height={24} strokeWidth={1.2} />
        <ArrowRight x={328} y={99} width={24} height={24} strokeWidth={1.2} />
      </g>
      <g className="folio-scene-task-running-progress">
        <path d="M222 168h96" />
        <path className="folio-scene-task-running-value" pathLength="100" d="M222 168h96" />
      </g>
      <g className="folio-scene-task-complete">
        <circle cx="421" cy="109" r="25" />
        <path d="m408 109 9 9 18-23" />
      </g>
    </>
  );
}
