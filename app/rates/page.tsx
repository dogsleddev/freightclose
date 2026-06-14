import { PageHeader } from "@/components/ui";
import { RatesPanel } from "@/components/close/RatesPanel";
import { GuideLink } from "@/components/GuideLink";

export const metadata = { title: "Rate Tables — FreightClose" };

export default function RatesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Rate tables"
        lead="The cards the engine prices with — effective-dated. When a carrier reprices, save a new version effective from that month: history keeps its own card (prior closes reconstruct unchanged) and the next close prices on the new one. The calibrated monthly index still rides on top, and printed-vs-calibrated divergence is always flagged."
      />
      <div><GuideLink anchor="step-5" label="Step 5 · Test sensitivity & check rates" /></div>
      <RatesPanel />
    </div>
  );
}
