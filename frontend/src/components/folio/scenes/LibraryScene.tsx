export function LibraryScene() {
  return (
    <>
      <g className="folio-scene-library-shelf">
        <path d="M76 177h420M92 185h388" />
        <rect x="110" y="75" width="45" height="102" />
        <rect x="158" y="54" width="55" height="123" />
        <rect x="216" y="87" width="38" height="90" />
        <rect x="258" y="67" width="63" height="110" />
        <rect className="folio-scene-library-destination" x="325" y="98" width="42" height="79" />
      </g>
      <g className="folio-scene-library-spines">
        <path d="M123 91v68M174 72v87M230 104v55M276 86v73M338 114v45" />
      </g>
      <g className="folio-scene-library-file">
        <path d="M397 45h68l24 24v96h-92zM465 45v24h24" />
        <path d="M416 91h52M416 112h52M416 133h35" />
      </g>
    </>
  );
}

