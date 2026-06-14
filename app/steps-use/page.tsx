import { PageHeader, Card } from "@/components/ui";
import { FlowDiagram } from "@/components/FlowDiagram";
import { STEPS_USE } from "@/app/lib/flow";

export const metadata = { title: "Steps to Use — Freight Close" };

export default function StepsUsePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Steps to use"
        lead="A guided tour of Freight Close — how to go from raw shipment data to a signed, locked month-end accrual, and where every dollar can be traced. The head-to-head vs the prior manual estimate lives on the Denise Comparison tab; the math behind it is on How It Works."
      />
      <Card title="The tour" subtitle="Follow the flow, or jump to any tab from the top navigation.">
        <FlowDiagram model={STEPS_USE} title="Steps to use Freight Close" />
      </Card>
      <Card title="Step by step">
        <ol className="space-y-2.5 text-sm">
          {STEPS_USE.nodes.map((n) => (
            <li key={n.id} className="flex gap-3">
              <span className="font-semibold text-slate-900">{n.label}</span>
              {n.detail && <span className="text-slate-600">— {n.detail}</span>}
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
