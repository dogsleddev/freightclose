import { PageHeader } from "@/components/ui";
import { MethodPanel } from "@/components/close/MethodPanel";

export const metadata = { title: "Method & Sensitivity — FreightClose" };

export default function MethodPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Method & sensitivity analysis"
        lead="The full pipeline — parse, calibrate, price, accrue, prove, control — with this run's actual numbers inline. Then a sensitivity lab: drag the assumptions and the same deterministic engine re-runs the entire close in your browser, so you can see what moves the number and what doesn't."
      />
      <MethodPanel />
    </div>
  );
}
