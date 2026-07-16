export function DiscoverScene() {
  return (
    <>
      <g className="folio-scene-discover-records">
        <g><rect x="230" y="34" width="252" height="42" rx="3" /><circle cx="249" cy="55" r="5" /><path d="M265 50h92M265 61h157" /></g>
        <g><rect x="230" y="94" width="252" height="42" rx="3" /><circle cx="249" cy="115" r="5" /><path d="M265 110h126M265 121h174" /></g>
        <g><rect x="230" y="154" width="252" height="42" rx="3" /><circle cx="249" cy="175" r="5" /><path d="M265 170h106M265 181h146" /></g>
      </g>
      <g className="folio-scene-search-lens">
        <circle cx="305" cy="110" r="66" />
        <path d="m354 159 72 58" />
        <g className="folio-scene-search-match">
          <rect x="270" y="87" width="70" height="46" rx="3" />
          <circle cx="284" cy="101" r="4" />
          <path d="M296 99h31M281 117h46" />
        </g>
        <path className="folio-scene-search-scan" d="M250 91h110" />
      </g>
    </>
  );
}
