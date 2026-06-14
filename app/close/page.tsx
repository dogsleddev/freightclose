import { PageHeader } from "@/components/ui";
import { ClosePanel } from "@/components/close/ClosePanel";

export const metadata = { title: "Monthly Close — FreightClose" };

export default function ClosePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Monthly close"
        lead="Run next month right here: upload the month's shipments (and newly arrived invoices, when you have them) and the same deterministic engine prices the accrual in your browser — no server, no database. Each close is saved with its inputs and the rate-card version in force, so any prior month reproduces to the cent."
      />
      <ClosePanel />
    </div>
  );
}
