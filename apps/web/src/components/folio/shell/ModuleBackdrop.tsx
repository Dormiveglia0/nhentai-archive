import { m } from "motion/react";
import type { FolioPageId } from "../config";

const LINES: Record<FolioPageId, string> = {
  workbench: "M24 18V104H100M36 18V92H112M48 18V80H124",
  library: "M20 24V104H44V24ZM56 12V104H80V12ZM92 32V104H116V32Z",
  discover: "M68 12L124 68L68 124L12 68ZM68 32V104M32 68H104",
  governance: "M28 12H90L112 34V120H28ZM90 12V34H112M42 56H94M42 72H80M42 88H94",
  dictionary: "M12 24H54L68 36L82 24H124V108H82L68 120L54 108H12ZM68 36V120",
  tasks: "M12 28H44V60H12ZM92 76H124V108H92ZM44 44H108V76M64 96H92",
  export: "M28 12H92V80H28ZM16 92H104V120H16ZM60 48V104M48 92L60 104L72 92",
  files: "M12 40V24H54L68 40H124V116H12ZM28 40V12H108V40",
  settings: "M16 28H120M16 68H120M16 108H120M40 16V40M96 56V80M60 96V120",
};

export function ModuleBackdrop({ page, reduceMotion }: { page: FolioPageId; reduceMotion: boolean }) {
  return <div className="folio-atmosphere" aria-hidden="true"><svg key={page} viewBox="0 0 136 136" fill="none">
    <path className="folio-backdrop-guides" d="M1 20V1H20M116 1H135V20M135 116V135H116M20 135H1V116" />
    <m.path className="folio-backdrop-line" d={LINES[page]} pathLength="1" initial={reduceMotion ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: .7, ease: [.22, 1, .36, 1] }} />
    <path className="folio-backdrop-accent" d="M4 68H18M68 4V18" />
  </svg></div>;
}
