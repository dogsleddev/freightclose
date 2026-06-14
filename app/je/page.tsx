import { PageHeader } from "@/components/ui";
import { JePanel } from "@/components/close/JePanel";

export const metadata = { title: "Journal Entries — FreightClose" };

export default function JePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Journal entries"
        lead="The booked accrued-freight-liability entry for the current period, with the prior period alongside and the month-over-month move. One clean entry per close: Dr Freight Expense by carrier / Cr Accrued Freight Liability, NetSuite-importable."
      />
      <JePanel />
    </div>
  );
}
