import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import type { LibraryWork } from "../../../lib/api";
import { workTitle } from "../../../lib/format";
import { EncounterPreview } from "./EncounterPreview";
import { EchoPreview } from "./EchoPreview";
import { ImprintPreview } from "./ImprintPreview";
import "./HomeConcepts.css";

export function HomeConcepts({ kind, blurCovers }: { kind: string; blurCovers: boolean }) {
  const [hidden, setHidden] = useState(blurCovers);
  useEffect(() => setHidden(blurCovers), [blurCovers]);
  return <section className={`home-concept is-${kind}`} aria-label={kind === "encounter" ? "方案 1" : kind === "echo" ? "方案 2" : "方案 3"}>
    {kind !== "imprint" ? <button className="concept-privacy" type="button" aria-label={hidden ? "显示封面" : "隐藏封面"} onClick={() => setHidden(value => !value)}>{hidden ? <Eye size={17} /> : <EyeOff size={17} />}</button> : null}
    {kind === "encounter" ? <EncounterPreview hidden={hidden} /> : kind === "echo" ? <EchoPreview hidden={hidden} /> : <ImprintPreview />}
  </section>;
}
export function ConceptCover({ work, hidden }: { work: LibraryWork; hidden: boolean }) {
  const [failed, setFailed] = useState(false);
  return <div className={`concept-cover${hidden ? " is-private" : ""}`}>
    {failed ? <span>封面加载失败</span> : <img src={`/api/works/${work.id}/cover?w=512`} alt={workTitle(work)} decoding="async" draggable={false} onError={() => setFailed(true)} />}
  </div>;
}
