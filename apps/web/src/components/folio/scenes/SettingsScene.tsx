export function SettingsScene() {
  return (
    <g className="folio-scene-settings-panel">
      <rect x="68" y="32" width="408" height="166" rx="8" />
      <path className="folio-scene-settings-fine" d="M240 50v130M86 174h136M262 174h106" />
      <g className="folio-scene-settings-dial">
        <circle cx="154" cy="108" r="51" />
        <path className="folio-scene-settings-fine" d="M114 148l-6 6M98 108h-8M114 68l-6-6M154 52v-8M194 68l6-6M210 108h8M194 148l6 6" />
        <circle className="folio-scene-settings-dial-face" cx="154" cy="108" r="36" />
        <g className="folio-scene-settings-needle">
          <path d="M154 80v12" />
          <circle cx="154" cy="69" r="2" />
        </g>
        <circle className="folio-scene-settings-hub" cx="154" cy="108" r="5" />
      </g>
      <g className="folio-scene-settings-slider folio-scene-settings-slider-a">
        <path d="M274 67h170" />
        <path className="folio-scene-settings-fine" d="M274 62v10M316 64v6M359 62v10M401 64v6M444 62v10" />
        <g className="folio-scene-settings-thumb"><rect x="308" y="57" width="16" height="20" rx="4" /><path d="M316 63v8" /></g>
      </g>
      <g className="folio-scene-settings-slider folio-scene-settings-slider-b">
        <path d="M274 105h170" />
        <path className="folio-scene-settings-fine" d="M274 100v10M316 102v6M359 100v10M401 102v6M444 100v10" />
        <g className="folio-scene-settings-thumb"><rect x="393" y="95" width="16" height="20" rx="4" /><path d="M401 101v8" /></g>
      </g>
      <g className="folio-scene-settings-slider folio-scene-settings-slider-c">
        <path d="M274 143h170" />
        <path className="folio-scene-settings-fine" d="M274 138v10M316 140v6M359 138v10M401 140v6M444 138v10" />
        <g className="folio-scene-settings-thumb"><rect x="351" y="133" width="16" height="20" rx="4" /><path d="M359 139v8" /></g>
      </g>
      <g className="folio-scene-settings-switch">
        <rect x="400" y="165" width="44" height="18" rx="9" />
        <circle cx="410" cy="174" r="5" />
      </g>
    </g>
  );
}
