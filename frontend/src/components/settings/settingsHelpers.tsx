import { CheckCircle2, XCircle } from "lucide-react";

export function StatusDot({ ok }: { ok: boolean }) {
  return ok ? <CheckCircle2 className="ok" size={17} /> : <XCircle className="bad" size={17} />;
}

export function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
