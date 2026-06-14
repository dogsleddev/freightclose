import { PageHeader, Card } from "@/components/ui";
import { MethodPanel } from "@/components/close/MethodPanel";
import { CalcFlowDiagram } from "@/components/guide/diagrams";
import { GuideLink } from "@/components/GuideLink";

export const metadata = { title: "Method & Sensitivity — FreightClose" };

export default function MethodPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Method & sensitivity analysis"
        lead="The full pipeline — parse, calibrate, price, accrue, prove, control — with this run's actual numbers inline. Then a sensitivity lab: drag the assumptions and the same deterministic engine re-runs the entire close in your browser, so you can see what moves the number and what doesn't."
      />
      <div>
        <GuideLink anchor="step-5" label="Step 5 · Test sensitivity & check rates" />
      </div>

      <Card
        title="How the accrual is calculated — visual flow"
        subtitle="How the April manifest flows through the engine to the booked number: each carrier is priced from its calibrated rates against the actual shipments, then summed net of the credit reserve. Live figures from this run."
      >
        <CalcFlowDiagram />
      </Card>

      <MethodPanel />
    </div>
  );
}
