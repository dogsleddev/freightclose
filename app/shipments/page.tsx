import { PageHeader } from "@/components/ui";
import { ShipmentsTable } from "@/components/ShipmentsTable";

export default function Shipments() {
  return (
    <div>
      <PageHeader
        title="Shipment backup"
        lead="Every shipment that drives the accrual, with the full calc trace (base → fuel → accessorials → min/residential) and every flag. This is the audit trail behind the journal entry."
      />
      <ShipmentsTable />
    </div>
  );
}
