export function FilesScene() {
  return (
    <>
      <g className="folio-scene-files-source-stack">
        <rect x="44" y="69" width="102" height="126" rx="3" />
        <rect x="54" y="59" width="102" height="126" rx="3" />
      </g>
      <g className="folio-scene-files-scanner">
        <rect x="214" y="35" width="120" height="160" rx="5" />
        <circle cx="234" cy="55" r="5" />
        <path d="M249 55h62" />
      </g>
      <g className="folio-scene-files-folder-back">
        <path d="M365 99h47l17 19h71v76H365Z" />
      </g>
      <g className="folio-scene-files-document">
        <rect x="58" y="55" width="102" height="126" rx="3" />
        <path d="M78 86h62M78 111h62M78 136h43" />
        <g className="folio-scene-files-document-status">
          <circle cx="139" cy="76" r="13" />
          <path d="m132 76 5 5 10-13" />
        </g>
      </g>
      <rect className="folio-scene-files-scan-beam" x="227" y="72" width="94" height="5" rx="2" />
      <path className="folio-scene-files-folder-front" d="M365 126h135v68H365Z" />
    </>
  );
}

