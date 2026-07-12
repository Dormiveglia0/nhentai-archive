export function ExportScene() {
  return (
    <>
      <path className="folio-scene-export-rail" d="M54 199h432" />
      <g className="folio-scene-export-file folio-scene-export-file-a">
        <path d="M62 62h86l24 24v104H62Z" />
        <path d="M148 62v24h24M82 104h68M82 128h52M82 152h61" />
      </g>
      <g className="folio-scene-export-file folio-scene-export-file-b">
        <path d="M91 48h86l24 24v104H91Z" />
        <path d="M177 48v24h24M111 90h68M111 114h52M111 138h61" />
      </g>
      <g className="folio-scene-export-file folio-scene-export-file-c">
        <path d="M120 34h86l24 24v104H120Z" />
        <path d="M206 34v24h24M140 76h68M140 100h52M140 124h61" />
      </g>
      <g className="folio-scene-export-archive">
        <path className="folio-scene-export-cover" d="M324 34h112l30 30v132H324Z" />
        <path d="M436 34v30h30M350 52v126" />
        <path className="folio-scene-export-zip" pathLength="100" d="M350 58v118" />
        <rect x="376" y="134" width="62" height="30" rx="3" />
        <path d="M390 146h34M390 154h24" />
      </g>
      <g className="folio-scene-export-slider">
        <rect x="344" y="53" width="12" height="16" rx="2" />
        <path d="m347 61 3 3 4-6" />
      </g>
      <g className="folio-scene-export-seal">
        <circle cx="438" cy="179" r="15" />
        <path d="m430 179 6 6 12-16" />
      </g>
    </>
  );
}

