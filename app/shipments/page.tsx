import { PageHeader } from "@/components/ui";
import { ShipmentsTable } from "@/components/ShipmentsTable";
import { GuideLink } from "@/components/GuideLink";

export default function Shipments() {
  return (
    <div>
      <PageHeader
        title="Shipment backup"
        lead="Every shipment that drives the accrual, with the full calc trace (base → fuel → accessorials → min/residential) and every flag. This is the audit trail behind the journal entry."
      />
      <div className="mb-5"><GuideLink anchor="step-2" label="Step 2 · Drill carrier & shipment detail" /></div>
      <ShipmentsTable />
    </div>
  );
}
