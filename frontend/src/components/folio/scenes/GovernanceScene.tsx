export function GovernanceScene() {
  return (
    <>
      <g className="folio-scene-governance-board">
        <g className="folio-scene-governance-card folio-scene-governance-source">
          <rect x="58" y="30" width="192" height="168" rx="5" />
          <circle cx="78" cy="49" r="5" />
          <path d="M78 67h152M78 87h137M78 151h118M78 174h91" />
        </g>
        <g className="folio-scene-governance-card folio-scene-governance-local">
          <rect x="290" y="30" width="192" height="168" rx="5" />
          <circle cx="310" cy="49" r="5" />
          <path d="M310 67h152M310 87h137M310 151h118M310 174h91" />
          <rect className="folio-scene-governance-target" x="310" y="103" width="150" height="32" rx="3" />
        </g>
        <path className="folio-scene-governance-bridge" pathLength="100" d="M256 119h28m-7-7 7 7-7 7" />
      </g>
      <g className="folio-scene-governance-change">
        <rect x="78" y="103" width="150" height="32" rx="3" />
        <circle cx="95" cy="119" r="5" />
        <path d="M108 114h92M108 124h68" />
      </g>
      <g className="folio-scene-governance-stamp">
        <circle cx="454" cy="51" r="18" />
        <path d="m444 51 7 7 14-18" />
      </g>
    </>
  );
}
