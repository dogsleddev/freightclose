import { PageHeader } from "@/components/ui";
import { ShipmentMap } from "@/components/ShipmentMap";

export const metadata = { title: "Shipment Map — FreightClose" };

export default function MapPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Shipment map"
        lead="Where this period's freight actually ships — the accrual plotted by destination, sized by dollars and colored by carrier, radiating from the Denver hub. A geographic read on the same shipment-level detail behind the journal entry."
      />
      <ShipmentMap />
    </div>
  );
}
