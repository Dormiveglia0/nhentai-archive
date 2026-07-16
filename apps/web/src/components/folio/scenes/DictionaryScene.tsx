export function DictionaryScene() {
  return (
    <>
      <g className="folio-scene-dictionary-book">
        <path d="M82 64c67-23 127-12 180 31v106c-53-43-113-54-180-31Z" />
        <path d="M262 95c53-43 113-54 180-31v106c-67-23-127-12-180 31Z" />
        <path d="M262 95v106" />
      </g>
      <g className="folio-scene-dictionary-slots">
        <rect x="111" y="107" width="113" height="12" rx="6" />
        <rect x="111" y="136" width="82" height="12" rx="6" />
        <rect x="300" y="107" width="113" height="12" rx="6" />
        <rect x="300" y="136" width="82" height="12" rx="6" />
      </g>
      <g className="folio-scene-dictionary-token folio-scene-dictionary-token-a">
        <rect x="72" y="25" width="72" height="38" rx="19" />
        <text x="108" y="50" textAnchor="middle">Aa</text>
      </g>
      <g className="folio-scene-dictionary-token folio-scene-dictionary-token-b">
        <rect x="226" y="18" width="72" height="38" rx="19" />
        <text x="262" y="43" textAnchor="middle">↔</text>
      </g>
      <g className="folio-scene-dictionary-token folio-scene-dictionary-token-c">
        <rect x="380" y="25" width="72" height="38" rx="19" />
        <text x="416" y="50" textAnchor="middle">译</text>
      </g>
      <g className="folio-scene-dictionary-bookmark">
        <path d="M278 86v54l-16-10-16 10V86" />
      </g>
    </>
  );
}
