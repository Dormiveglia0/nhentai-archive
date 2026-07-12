export function WorkbenchScene() {
  return (
    <>
      <g className="folio-scene-hub-orbits">
        <ellipse cx="360" cy="116" rx="136" ry="78" />
        <ellipse cx="360" cy="116" rx="136" ry="78" transform="rotate(54 360 116)" />
      </g>
      <g className="folio-scene-hub-links">
        <path d="M360 116 229 62M360 116l115-55M360 116 224 178M360 116l123 64" />
      </g>
      <g className="folio-scene-hub-panels">
        <g><rect x="181" y="34" width="96" height="56" rx="3" /><circle cx="197" cy="50" r="4" /><path d="M209 49h49M197 68h61" /></g>
        <g><rect x="432" y="33" width="86" height="56" rx="3" /><circle cx="448" cy="49" r="4" /><path d="M460 48h40M448 68h52" /></g>
        <g><rect x="172" y="151" width="104" height="56" rx="3" /><circle cx="188" cy="167" r="4" /><path d="M200 166h57M188 186h69" /></g>
        <g><rect x="440" y="152" width="86" height="56" rx="3" /><circle cx="456" cy="168" r="4" /><path d="M468 167h40M456 187h52" /></g>
      </g>
      <g className="folio-scene-hub-core">
        <rect x="314" y="70" width="92" height="92" rx="4" />
        <rect x="329" y="85" width="62" height="62" rx="2" />
        <circle cx="360" cy="116" r="16" />
        <path d="M346 116h28M360 102v28" />
        <path className="folio-scene-hub-core-scan" d="M326 93h68" />
      </g>
      <g className="folio-scene-hub-nodes">
        <circle cx="294" cy="89" r="5" />
        <circle cx="418" cy="88" r="5" />
        <circle cx="291" cy="148" r="5" />
        <circle cx="420" cy="149" r="5" />
      </g>
      <g className="folio-scene-hub-pulse">
        <circle cx="360" cy="116" r="50" />
        <circle cx="360" cy="116" r="50" />
      </g>
    </>
  );
}

