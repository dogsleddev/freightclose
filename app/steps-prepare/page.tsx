import { PageHeader, Card, Badge } from "@/components/ui";
import { FlowDiagram } from "@/components/FlowDiagram";
import { STEPS_PREPARE } from "@/app/lib/flow";

export const metadata = { title: "Steps to Prepare Month — Freight Close" };

const LEGEND: { label: string; cls: string }[] = [
  { label: "input", cls: "bg-sky-100 text-sky-800 ring-sky-200" },
  { label: "process", cls: "bg-slate-100 text-slate-700 ring-slate-200" },
  { label: "control", cls: "bg-slate-100 text-slate-700 ring-slate-200" },
  { label: "decision", cls: "bg-amber-100 text-amber-800 ring-amber-200" },
  { label: "output", cls: "bg-emerald-100 text-emerald-800 ring-emerald-200" },
];

export default function StepsPreparePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Steps to prepare a month"
        lead="The operator's month-end runbook: how to close a period from raw inputs to a locked, archived accrual — including the tie-out control gate (fix and re-run until everything ties) and the next-month true-up once invoices arrive. Run it yourself on the Monthly Close tab."
      />
      <Card
        title="Month-end close workflow"
        subtitle="Controls are first-class: the close cannot be approved until every tie-out passes."
        right={
          <div className="flex flex-wrap gap-1.5">
            {LEGEND.map((l) => (
              <Badge key={l.label} className={l.cls}>
                {l.label}
              </Badge>
            ))}
          </div>
        }
      >
        <FlowDiagram model={STEPS_PREPARE} title="Month-end close workflow" />
      </Card>
      <Card title="Runbook">
        <ol className="space-y-2.5 text-sm">
          {STEPS_PREPARE.nodes
            .filter((n) => /^\d/.test(n.label))
            .map((n) => (
              <li key={n.id} className="flex gap-3">
                <span className="font-semibold text-slate-900">{n.label}</span>
                {n.detail && <span className="text-slate-600">— {n.detail}</span>}
              </li>
            ))}
        </ol>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          The <b>Tie-outs pass?</b> gate is the control loop: if the journal entry doesn&apos;t balance, the carrier
          sums don&apos;t tie, or the reconstruction drifts, the close routes back to <b>Fix &amp; re-run</b> before any
          sign-off is possible.
        </p>
      </Card>
    </div>
  );
}
