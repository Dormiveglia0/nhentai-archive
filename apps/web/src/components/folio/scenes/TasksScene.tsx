export function TasksScene() {
  return (
    <>
      <g className="folio-scene-queue-stack">
        <path d="M62 65h66v92H62zM70 57h66v92M78 49h66v92M396 73h66v92h-66zM404 65h66v92M412 57h66v92" />
        <path className="folio-scene-queue-route" d="M150 112h62M328 112h62" />
      </g>
      <circle className="folio-scene-queue-track" cx="270" cy="112" r="61" />
      <g className="folio-scene-queue-rotor"><path d="M270 51a61 61 0 0 1 61 61M270 173a61 61 0 0 1-61-61" /></g>
      <g className="folio-scene-queue-document">
        <path d="M70 76h40l12 12v60H70ZM110 76v12h12" />
        <path d="M81 103h30M81 114h30" />
        <path className="folio-scene-queue-progress" d="M81 134h30" pathLength="100" />
      </g>
      <g className="folio-scene-queue-done"><circle cx="429" cy="112" r="20" /><path d="m418 112 8 8 15-18" /></g>
    </>
  );
}
