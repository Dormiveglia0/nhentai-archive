import { CheckCircle2, XCircle } from "lucide-react";

export function StatusDot({ ok }: { ok: boolean }) {
  return ok ? <CheckCircle2 className="ok" size={17} aria-label="正常" /> : <XCircle className="bad" size={17} aria-label="需处理" />;
}
