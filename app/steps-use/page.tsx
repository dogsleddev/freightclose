import Link from "next/link";
import { PageHeader, Card, Badge } from "@/components/ui";
import { WorkflowDiagram } from "@/components/guide/diagrams";

export const metadata = { title: "User Guide — Freight Close" };

type Step = {
  n: number;
  id: string;
  title: string;
  tab: string;
  href: string;
  cadence: string;
  short: string;
  desc: string;
  look: string[];
  action: string;
};

const STEPS: Step[] = [
  {
    n: 1, id: "step-1", title: "Review the accrual", tab: "Overview", href: "/", cadence: "Month-end close (Day 1)",
    short: "Go/no-go: total, confidence band, bias, tie-outs",
    desc: "Start here. The Overview shows the recommended accrual, the ±1σ confidence band, the six-month bias, and whether every control tie-out passes. This is your go/no-go decision point before any drill-down.",
    look: [
      "Total accrual and confidence band are reasonable for the month's volume",
      "Accrual bias is near zero — no systematic over- or under-statement",
      "All tie-outs pass (the header badge is green)",
      "The calibration line reads sensibly (printed card vs the calibrated rate)",
    ],
    action: "If the number and band look reasonable and tie-outs pass, proceed. If a tie-out fails, stop and fix it before continuing.",
  },
  {
    n: 2, id: "step-2", title: "Drill into carrier & shipment detail", tab: "Shipment backup", href: "/shipments", cadence: "Month-end close (Day 1)",
    short: "Every dollar ties to a shipment — full calc trace",
    desc: "Every booked dollar ties to a shipment. Open Shipment backup for the full calc trace of any shipment (base → fuel → accessorials → minimum/residential), filter to flagged rows, or switch to the map for a geographic read.",
    look: [
      "Per-carrier split is sensible (Peak 40 / Heartland 65 / Coastal 55)",
      "A sample shipment's calc trace is correct end-to-end",
      "Flagged shipments are the ones you would expect",
      "Nothing was priced on a silent fallback",
    ],
    action: "Spot-check two or three shipments per carrier. If a trace looks wrong, note the shipment id and check Rates or Exceptions.",
  },
  {
    n: 3, id: "step-3", title: "Review exceptions & controls", tab: "Exceptions", href: "/exceptions", cadence: "Month-end close (Day 1)",
    short: "Review & annotate every flag; ready-to-close gate",
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
    n: 4, id: "step-4", title: "Validate accuracy", tab: "Accuracy", href: "/backtest", cadence: "Monthly review",
    short: "Reconstruction + out-of-sample back-test",
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
    n: 5, id: "step-5", title: "Test sensitivity & check rates", tab: "Method & sensitivity · Rates", href: "/method", cadence: "When uncertain · quarterly",
    short: "What moves the number; printed vs calibrated rates",
    desc: "Drag the assumptions in the sensitivity lab to see what moves the number (and see how the accrual is calculated, end to end). Check Rates for printed-card-vs-calibrated divergence and any rate-card change effective this month.",
    look: [
      "What a fuel-surcharge or volume change does to the accrual",
      "Calibrated index vs the printed card (divergence is flagged in both directions)",
      "Whether a carrier repriced — if so, save a new effective-dated card",
      "Worst-case / best-case range for CFO reporting",
    ],
    action: "Document any scenario that produces materially different results. If a carrier renegotiated, save a new rate-card version effective from that month.",
  },
  {
    n: 6, id: "step-6", title: "Book the journal entry", tab: "Journal entries", href: "/je", cadence: "Month-end close (Day 1)",
    short: "DR 6200 / CR 21500 — export NetSuite CSV",
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
    n: 7, id: "step-7", title: "Approve & lock the period", tab: "Approval", href: "/approval", cadence: "Month-end close (Day 1)",
    short: "Control gates + attestation → lock + archive",
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
    n: 8, id: "step-8", title: "Reconcile when invoices arrive", tab: "Closed periods", href: "/closed", cadence: "15–30 days after month-end",
    short: "Estimate vs actual + true-up when invoices arrive",
    desc: "When the carriers' invoices land, Closed periods compares the estimate to actual, scores the variance against materiality bands, and books a balanced true-up journal entry (see the reconciliation flow there).",
    look: [
      "Variance vs materiality (green ≤5% / amber ≤10% / red >10%)",
      "The true-up JE balances",
      "Actuals reconcile to the invoice register",
      "The variance is fed into next month's calibration",
    ],
    action: "Within ±5%, no action. ±5–10%, document the root cause. Over 10%, investigate and recalibrate — the variance improves next month's estimate either way.",
  },
];

const TABS: { tab: string; href: string; purpose: string; when: string }[] = [
  { tab: "Overview", href: "/", purpose: "Executive accrual summary + go/no-go", when: "Every month-end" },
  { tab: "Run a close", href: "/close", purpose: "Load a sample or upload, price, save, reproduce", when: "Each month / to try it" },
  { tab: "Exceptions", href: "/exceptions", purpose: "Flags, dispositions, ready-to-close control", when: "Every month-end" },
  { tab: "Journal entries", href: "/je", purpose: "The booked entry + NetSuite export", when: "Booking" },
  { tab: "Approval", href: "/approval", purpose: "Sign-off, lock, archive, audit trail", when: "Close-out" },
  { tab: "Shipment backup", href: "/shipments", purpose: "Per-shipment calc trace (+ map)", when: "Audit / spot-check" },
  { tab: "Rates", href: "/rates", purpose: "Effective-dated cards + calibration divergence", when: "When rates change" },
  { tab: "Accuracy", href: "/backtest", purpose: "Reconstruction + out-of-sample back-test", when: "Monthly / accuracy review" },
  { tab: "Closed periods", href: "/closed", purpose: "Estimate vs actual + true-up + reconciliation flow", when: "When invoices arrive" },
  { tab: "May scenario", href: "/may", purpose: "Adaptability — the fuel-spike what-if", when: "Demonstration" },
  { tab: "vs. Denise", href: "/denise", purpose: "Honest head-to-head vs the prior manual estimate", when: "Benchmarking" },
  { tab: "Method & sensitivity", href: "/method", purpose: "Calculation flow + what-if lab + methodology", when: "Understanding / audit" },
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
    a: "Three places: Method & sensitivity (calculation flow, formulas, data sources, assumptions, limitations), Accuracy (reconstruction + back-test), and Approval (the locked archive — JE, shipment backup, portable HTML, approval record, and the timestamped audit trail). Every figure derives only from the bundled data and config.",
  },
];

const LEGEND = [
  { c: "#21436b", t: "Review & validate (steps 1–5)" },
  { c: "#15803d", t: "Book & lock (steps 6–7)" },
  { c: "#c4622d", t: "Reconcile later (step 8)" },
];

// open the targeted <details> (and scroll to it) on deep-link / hash change
const OPEN_HASH = `(function(){function o(){var h=location.hash.slice(1);if(!h)return;var el=document.getElementById(h);if(!el)return;if(el.tagName==='DETAILS')el.open=true;el.scrollIntoView();}window.addEventListener('hashchange',o);setTimeout(o,60);})();`;

function StepAccordion({ s }: { s: Step }) {
  return (
    <details id={s.id} className="group scroll-mt-20 rounded-xl border border-slate-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-semibold text-parchment">
          {s.n}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-900">{s.title}</span>
            <Badge className="bg-slate-100 text-slate-600 ring-slate-200">{s.tab}</Badge>
          </span>
          <span className="mt-0.5 block text-xs text-slate-500">◷ {s.cadence} · {s.short}</span>
        </span>
        <svg viewBox="0 0 16 16" width="14" height="14" className="shrink-0 text-slate-400 transition group-open:rotate-90" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 4l4 4-4 4" />
        </svg>
      </summary>
      <div className="border-t border-slate-100 px-4 py-3 sm:pl-[3.75rem]">
        <p className="text-sm leading-relaxed text-slate-600">{s.desc}</p>
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
        <div className="mt-3">
          <Link href={s.href} className="text-sm font-medium text-sky-700 underline-offset-2 hover:underline">
            Open {s.tab} →
          </Link>
        </div>
      </div>
    </details>
  );
}

export default function UserGuidePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="User guide"
        lead="Everything you need to run the month-end freight accrual — set up a new period, work the eight close steps, and reconcile when invoices arrive. Each step links straight to the tab that does the work; the calculation flow lives on Method & sensitivity and the reconciliation flow on Closed periods."
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

      {/* Setting up a new period */}
      <div id="setup" className="scroll-mt-20">
      <Card title="Setting up a new period" subtitle="Get the month's data into the engine — then work the close steps below.">
        <ol className="space-y-2.5 text-sm text-slate-700">
          <li className="flex gap-3"><span className="font-semibold text-slate-900">1.</span><span>Open <Link href="/close" className="font-medium text-sky-700 hover:underline">Run a close</Link>.</span></li>
          <li className="flex gap-3"><span className="font-semibold text-slate-900">2.</span><span>Load a bundled <b>sample period</b> to see it priced instantly, or <b>upload the month's shipments CSV</b> (and any newly-arrived carrier invoices) — validated against the schema, every fallback flagged.</span></li>
          <li className="flex gap-3"><span className="font-semibold text-slate-900">3.</span><span>Confirm the <b>close period</b> (auto-inferred from the file).</span></li>
          <li className="flex gap-3"><span className="font-semibold text-slate-900">4.</span><span>Click <b>Run close</b> — the deterministic engine prices the accrual in your browser and saves it with its inputs and the rate-card version in force, so the close reproduces bit-for-bit.</span></li>
          <li className="flex gap-3"><span className="font-semibold text-slate-900">5.</span><span>The period is now ready — work the eight close steps below.</span></li>
        </ol>
        <div className="mt-3">
          <Link href="/close" className="text-sm font-medium text-sky-700 underline-offset-2 hover:underline">Open Run a close →</Link>
        </div>
      </Card>
      </div>

      {/* Closing the period */}
      <div id="close">
        <h2 className="mb-1 font-serif text-xl font-semibold text-slate-900">Closing the period — the eight steps</h2>
        <p className="mb-3 text-sm text-slate-500">Expand any step for what to look for and the action to take. Each step opens the tab that does the work.</p>
        <div className="space-y-3">
          {STEPS.map((s) => (
            <StepAccordion key={s.n} s={s} />
          ))}
        </div>
      </div>

      {/* Go deeper */}
      <Card title="Go deeper" subtitle="The two detailed process diagrams live on the tabs they belong to.">
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-slate-400">→</span>
            <span>
              <Link href="/method" className="font-medium text-sky-700 hover:underline">How the accrual is calculated</Link> — the branching data-flow (manifest → group by carrier → per-carrier pricing → total), on Method &amp; sensitivity.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-slate-400">→</span>
            <span>
              <Link href="/closed" className="font-medium text-sky-700 hover:underline">Reconciliation flow</Link> — book → invoices arrive → compare vs materiality → true-up → feed next month, on Closed periods.
            </span>
          </li>
        </ul>
      </Card>

      <Card title="Quick reference — what each tab is for" subtitle="Where to go for what. Tab names link straight there.">
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
                  <td className="py-2 pr-4 font-medium">
                    <Link href={t.href} className="text-sky-700 hover:underline">{t.tab}</Link>
                  </td>
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

      <script dangerouslySetInnerHTML={{ __html: OPEN_HASH }} />
    </div>
  );
}
