import { PageHeader } from "@/components/ui";
import { ClosePanel } from "@/components/close/ClosePanel";
import { GuideLink } from "@/components/GuideLink";

export const metadata = { title: "Run a Close — FreightClose" };

export default function ClosePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Run a close"
        lead="One front door for the close: load a bundled sample period to see it priced instantly, or upload the month's shipments (and newly arrived invoices, when you have them). The same deterministic engine prices the accrual in your browser — no server, no database. Each close you run is saved with its inputs and the rate-card version in force, so any prior month reproduces to the cent."
      />
      <div><GuideLink anchor="setup" label="Setting up a new period" /></div>
      <ClosePanel />
    </div>
  );
}
