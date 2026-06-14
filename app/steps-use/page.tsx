import { PageHeader, Card, Badge } from "@/components/ui";
import { WorkflowDiagram, CalcFlowDiagram, ReconDiagram } from "@/components/guide/diagrams";

export const metadata = { title: "User Guide — Freight Close" };

type Step = {
  n: number;
  title: string;
  tab: string;
  cadence: string;
  desc: string;
  look: string[];
  action: string;
};

const STEPS: Step[] = [
  {
    n: 1,
    title: "Review the accrual",
    tab: "Overview",
    cadence: "Month-end close (Day 1)",
    desc: "Start here. The Overview shows the recommended accrual, the ±1σ confidence band, the six-month bias, and whether every control tie-out passes. This is your go/no-go decision point before any drill-down.",
    look: [
      "Total accrual and confidence band are reasonable for the month's volume",
      "Accrual bias is near zero — no systematic over- or under-statement",
      "All tie-outs pass (the header badge is green)",
      "The calibration line reads sensibly (printed card vs the calibrated rate)",
    ],
    action: "If the number and band look reasonable and tie-outs pass, proceed to carrier detail. If a tie-out fails, stop and fix it before continuing.",
  },
  {
    n: 2,
    title: "Drill into carrier & shipment detail",
    tab: "Shipment backup",
    cadence: "Month-end close (Day 1)",
    desc: "Every booked dollar ties to a shipment. Open Shipment backup for the full calc trace of any shipment (base → fuel → accessorials → minimum/residential), filter to flagged rows, or switch to the map for a geographic read.",
    look: [
      "Per-carrier split is sensible (Peak 40 / Heartland 65 / Coastal 55)",
      "A sample shipment's calc trace is correct end-to-end",
      "Flagged shipments are the ones you would expect",
      "Nothing was priced on a silent fallback",
    ],
    action: "Spot-check two or three shipments per carrier. If a trace looks wrong, note the shipment id and check it on Rates or Exceptions.",
  },
  {
    n: 3,
    title: "Review exceptions & controls",
    tab: "Exceptions",
    cadence: "Month-end close (Day 1)",
    desc: "Every fallback and assumption raises a flag — no silent defaults. Review the register, pin a disposition note to each material flag, and confirm the period is “ready to close.”",
    look: [
      "Zero error (blocking) flags",
      "Warnings reviewed and acceptable (dedup, imputed weight, mileage fallback, rate divergence)",
      "Each material flag carries a reviewer note",
      "The banner reads “Ready to close”",
    ],
    action: "Resolve any error flags before sign-off. Annotate the warnings with their disposition so the audit trail is complete.",
  },
  {
    n: 4,
    title: "Validate accuracy",
    tab: "Accuracy",
    cadence: "Monthly review",
    desc: "Two honest views of the engine's own accuracy. Reconstruction proves the pricing mechanics reproduce six months of invoices to the cent (in-sample); the expanding-window back-test is the out-of-sample test, calibrated only from prior months.",
    look: [
      "Reconstruction error ≈ $0 — the mechanics are correct",
      "Out-of-sample MAPE is within your tolerance",
      "Bias is near zero — it matters more than per-month error",
      "The per-carrier breakdown explains the misses",
    ],
    action: "Bias is what compounds in the P&L — if it drifts from zero, investigate. Per-month noise is expected and is carried in the confidence band.",
  },
  {
    n: 5,
    title: "Test sensitivity & check rates",
    tab: "Method & sensitivity · Rates",
    cadence: "When uncertain · quarterly",
    desc: "Drag the assumptions in the sensitivity lab to see what moves the number, and check Rates for printed-card-vs-calibrated divergence and any rate-card change effective this month.",
    look: [
      "What a fuel-surcharge or volume change does to the accrual",
      "Calibrated index vs the printed card (divergence is flagged in both directions)",
      "Whether a carrier repriced — if so, save a new effective-dated card",
      "Worst-case / best-case range for CFO reporting",
    ],
    action: "Document any scenario that produces materially different results. If a carrier renegotiated, save a new rate-card version effective from that month.",
  },
  {
    n: 6,
    title: "Book the journal entry",
    tab: "Journal entries",
    cadence: "Month-end close (Day 1)",
    desc: "The pre-formatted entry is ready to book: DR 6200 Freight Expense by carrier, CR 21500 Accrued Freight Liability. Export the NetSuite-import CSV and keep the shipment backup as support.",
    look: [
      "Debits = credits (the entry balances)",
      "Subledger split by carrier",
      "The entry reverses on receipt of the carrier invoices",
      "The memo states the accrual basis",
    ],
    action: "Export the JE CSV and import it into your ERP. Retain the shipment-level backup as audit support.",
  },
  {
    n: 7,
    title: "Approve & lock the period",
    tab: "Approval",
    cadence: "Month-end close (Day 1)",
    desc: "The controlled close-out: every automated control gate must pass, the approver attests the manual reviews, and on sign-off the period locks and a full archive saves.",
    look: [
      "All control gates green",
      "The three attestations checked and the approver recorded",
      "Archive saved (JE, shipment backup, portable HTML, approval record)",
      "A timestamped entry appears in the approval audit trail",
    ],
    action: "Sign to lock. If you must re-open later it is timestamped and the prior approval stays in the audit log — nothing is lost.",
  },
  {
    n: 8,
    title: "Reconcile when invoices arrive",
    tab: "Closed periods",
    cadence: "15–30 days after month-end",
    desc: "When the carriers' invoices land, Closed periods compares the estimate to actual, scores the variance against materiality bands, and books a balanced true-up journal entry.",
    look: [
      "Variance vs materiality (green ≤5% / amber ≤10% / red >10%)",
      "The true-up JE balances",
      "Actuals reconcile to the invoice register",
      "The variance is fed into next month's calibration",
    ],
    action: "Within ±5%, no action. ±5–10%, document the root cause. Over 10%, investigate and recalibrate — the variance improves next month's estimate either way.",
  },
];

const TABS: { tab: string; purpose: string; when: string }[] = [
  { tab: "Overview", purpose: "Executive accrual summary + go/no-go", when: "Every month-end" },
  { tab: "Run a close", purpose: "Load a sample or upload, price, save, reproduce", when: "Each month / to try it" },
  { tab: "Exceptions", purpose: "Flags, dispositions, ready-to-close control", when: "Every month-end" },
  { tab: "Journal entries", purpose: "The booked entry + NetSuite export", when: "Booking" },
  { tab: "Approval", purpose: "Sign-off, lock, archive, audit trail", when: "Close-out" },
  { tab: "Shipment backup", purpose: "Per-shipment calc trace (+ map)", when: "Audit / spot-check" },
  { tab: "Rates", purpose: "Effective-dated cards + calibration divergence", when: "When rates change" },
  { tab: "Accuracy", purpose: "Reconstruction + out-of-sample back-test", when: "Monthly / accuracy review" },
  { tab: "Closed periods", purpose: "Estimate vs actual + true-up", when: "When invoices arrive" },
  { tab: "May scenario", purpose: "Adaptability — the fuel-spike what-if", when: "Demonstration" },
  { tab: "vs. Denise", purpose: "Honest head-to-head vs the prior manual estimate", when: "Benchmarking" },
  { tab: "Method & sensitivity", purpose: "Pipeline + what-if lab + methodology", when: "Understanding / audit" },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "Is the model more accurate than Denise's manual estimate?",
    a: "Honestly, not on headline error. A trailing-3-month average (Denise) runs ≈8.3% out-of-sample MAPE versus the engine's ≈15.0%, because it smooths month-to-month rate noise a per-shipment engine can't foresee. The engine wins where a trailing average can't: every dollar ties to a shipment (auditable), it adapts to rate changes and new carriers, it carries controls, it's repeatable, and it is near-unbiased (−0.2% vs Denise's chronic −3.2%). The full head-to-head is on the vs. Denise tab.",
  },
  {
    q: "What if a carrier rate is wrong?",
    a: "Go to Rates, edit the card, and save a new version effective from the month it changed. History keeps its old card (prior closes reconstruct unchanged) and the next close prices on the new one. Printed-card-vs-calibrated divergence is always flagged, never silent.",
  },
  {
    q: "When are invoices uploaded, and how are they used?",
    a: "On the Run a close tab (the optional invoices slot). Invoices do two jobs: they extend the calibration window (the engine recalibrates and the window rolls forward) and they become the “actual invoiced” that the estimate is trued-up against on Closed periods.",
  },
  {
    q: "How do I prepare for an audit?",
    a: "Three places: Method & sensitivity (formulas, data sources, assumptions, limitations), Accuracy (reconstruction + back-test), and Approval (the locked archive — JE, shipment backup, portable HTML, approval record, and the timestamped audit trail). Every figure derives only from the bundled data and config.",
  },
];

const LEGEND = [
  { c: "#21436b", t: "Review & validate (steps 1–5)" },
  { c: "#15803d", t: "Book & lock (steps 6–7)" },
  { c: "#c4622d", t: "Reconcile later (step 8)" },
];

function StepCard({ s }: { s: Step }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex gap-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-semibold text-parchment">
          {s.n}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-serif text-lg font-semibold text-slate-900">{s.title}</h3>
            <Badge className="bg-slate-100 text-slate-700 ring-slate-200">{s.tab}</Badge>
          </div>
          <div className="mt-0.5 text-xs text-slate-500">◷ {s.cadence}</div>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.desc}</p>

          <div className="mt-3">
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">What to look for</div>
            <ul className="space-y-1 text-sm text-slate-700">
              {s.look.map((x, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-0.5 font-semibold text-emerald-600">✓</span>
                  <span>{x}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <span className="font-semibold">Action — </span>
            {s.action}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UserGuidePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="User guide"
        lead="The complete month-end freight-accrual workflow — from reviewing the estimate to booking the journal entry and reconciling when invoices arrive. Follow the eight steps in order for your first month, then use the diagrams as a quick reference. The math is on Method & sensitivity; the head-to-head vs the prior manual estimate is on vs. Denise."
      />

      <Card title="Complete workflow — overview" subtitle="Eight steps. Steps 1–7 happen at month-end close; step 8 happens when invoices arrive (typically 15–30 days later).">
        <div className="mb-3 flex flex-wrap gap-4 text-xs text-slate-600">
          {LEGEND.map((l) => (
            <span key={l.t} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: l.c }} />
              {l.t}
            </span>
          ))}
        </div>
        <WorkflowDiagram />
      </Card>

      <div>
        <h2 className="mb-3 font-serif text-xl font-semibold text-slate-900">Step-by-step instructions</h2>
        <div className="space-y-4">
          {STEPS.map((s) => (
            <StepCard key={s.n} s={s} />
          ))}
        </div>
      </div>

      <Card title="How the accrual is calculated — visual flow" subtitle="How the April manifest flows through the engine to the booked number. Each carrier is priced from its calibrated rates against the actual shipments, then summed net of the credit reserve. Live figures from this run.">
        <CalcFlowDiagram />
      </Card>

      <Card title="Reconciliation — when invoices arrive" subtitle="After the accrual is booked and locked, this is the loop once the carriers' invoices land. The materiality traffic-light decides whether action is needed; the variance always feeds next month's calibration.">
        <ReconDiagram />
      </Card>

      <Card title="Quick reference — what each tab is for" subtitle="Where to go for what.">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4 font-medium">Tab</th>
                <th className="py-2 pr-4 font-medium">Purpose</th>
                <th className="py-2 pr-4 font-medium">When to use</th>
              </tr>
            </thead>
            <tbody>
              {TABS.map((t) => (
                <tr key={t.tab} className="border-b border-slate-100">
                  <td className="py-2 pr-4 font-medium text-slate-800">{t.tab}</td>
                  <td className="py-2 pr-4 text-slate-600">{t.purpose}</td>
                  <td className="py-2 pr-4 text-slate-500">{t.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Frequently asked questions">
        <div className="space-y-4">
          {FAQ.map((f) => (
            <div key={f.q}>
              <div className="font-medium text-slate-900">{f.q}</div>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{f.a}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
