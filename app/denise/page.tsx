// Denise Comparison — the ONE place vs-Denise content lives (quarantine). The
// neutral surfaces (CFO Overview, Closed Periods, Journal Entries) stay
// Denise-free; the head-to-head — including the honest "a trailing average is
// hard to beat on MAPE" story — is consolidated here.

import { accrualRun } from "@/app/lib/accrual";
import { closedPeriods } from "@/app/lib/periods";
import { Card, Stat, PageHeader, Badge } from "@/components/ui";
import { fmtUsd, fmtPct, fmtSignedPct, carrierName } from "@/app/lib/format";
import { AskFreightClose } from "@/components/AskFreightClose";

// Grouped-bar chart of the closed-months three-way (engine vs Denise vs actual).
// Pure SVG on a light inset panel so it reads in both light and dark themes,
// matching the map/flow diagrams. Renders the same closedPeriods the table does.
const SHORT = (lbl: string) => {
  const [m, y] = lbl.split(" ");
  return `${m.slice(0, 3)} '${(y ?? "").slice(2)}`;
};

function ThreeWayChart() {
  const data = closedPeriods.map((p) => ({
    label: SHORT(p.label),
    engine: p.engineTotal,
    denise: p.denise.totalDenise,
    actual: p.actualTotal,
    coldStart: p.isColdStart,
  }));
  const hasColdStart = data.some((d) => d.coldStart);
  const max = Math.max(...data.flatMap((d) => [d.engine, d.denise, d.actual])) * 1.05 || 1;
  const W = 760, H = 280, padL = 52, padB = 40, padT = 10, padR = 10;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const groupW = plotW / data.length;
  const barW = (groupW * 0.66) / 3;
  const y = (v: number) => padT + plotH - (v / max) * plotH;
  const series = [
    { key: "engine" as const, label: "Engine estimate", color: "#2F6FB0" },
    { key: "denise" as const, label: "Denise", color: "#9A958C" },
    { key: "actual" as const, label: "Actual invoiced", color: "#2E8B6B" },
  ];
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[640px]"
        role="img"
        aria-label="Closed months engine vs Denise vs actual, grouped bars"
      >
        <rect x="0" y="0" width={W} height={H} rx="8" fill="#FBFAF6" />
        {ticks.map((t, i) => {
          const yy = y(t);
          return (
            <g key={i}>
              <line x1={padL} y1={yy} x2={W - padR} y2={yy} stroke="#E7E3D8" strokeWidth="1" />
              <text x={padL - 6} y={yy + 3} textAnchor="end" fontSize="10" fill="#8A887F">
                ${Math.round(t / 1000)}k
              </text>
            </g>
          );
        })}
        {data.map((d, gi) => {
          const gx = padL + gi * groupW + (groupW - barW * 3) / 2;
          return (
            <g key={gi}>
              {series.map((s, si) => {
                const v = d[s.key];
                const yy = y(v);
                return (
                  <rect
                    key={s.key}
                    x={gx + si * barW}
                    y={yy}
                    width={barW - 2}
                    height={padT + plotH - yy}
                    fill={s.color}
                    fillOpacity={d.coldStart ? 0.4 : 1}
                    rx="1.5"
                  />
                );
              })}
              <text x={padL + gi * groupW + groupW / 2} y={H - padB + 16} textAnchor="middle" fontSize="10" fill="#5B5A54">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-600">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      {hasColdStart && (
        <p className="mt-1.5 text-xs text-slate-400">
          October is cold-start (printed-card priced, no prior history) — dimmed, and excluded from the head-to-head below.
        </p>
      )}
    </div>
  );
}

export default function DeniseComparison() {
  const r = accrualRun;
  const b = r.backtest;
  const da = r.deniseApril;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Denise comparison — the honest accuracy story"
        lead="Denise is the prior manual process: a trailing-3-month average of actual invoiced per carrier. We hold ourselves to an honest standard and put every vs-Denise number here, on its own tab."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card>
          <Stat label="Freight Close MAPE" value={fmtPct(b.overall.engineMape)} sub="out-of-sample, 6-mo back-test" />
        </Card>
        <Card>
          <Stat label="Denise MAPE" value={fmtPct(b.overall.deniseMape)} accent="text-slate-900" sub="trailing-3-mo average" />
        </Card>
        <Card>
          <Stat label="Freight Close bias" value={fmtSignedPct(b.overall.engineBias)} accent="text-emerald-700" sub="near-unbiased" />
        </Card>
        <Card>
          <Stat label="Denise bias" value={fmtSignedPct(b.overall.deniseBias)} accent="text-amber-700" sub="chronic under-accrual" />
        </Card>
      </div>

      <Card title="What this comparison does — and doesn't — claim">
        <p className="text-sm leading-relaxed text-slate-600">
          On out-of-sample percentage error, <b>Denise&apos;s trailing average is hard to beat</b> — she runs{" "}
          {fmtPct(b.overall.deniseMape)} MAPE to Freight Close&apos;s {fmtPct(b.overall.engineMape)}, because a trailing
          average smooths the month-to-month rate/volume noise that per-shipment pricing cannot foresee. We do{" "}
          <b>not</b> claim to beat her headline error. Freight Close wins on the axes a trailing average can&apos;t touch:
          every dollar <b>ties to a shipment</b> (auditability) instead of a black-box average never tied to what shipped;
          it <b>adapts</b> to rate changes and new carriers (the May fuel-surcharge scenario) where a trailing average is
          structurally blind; it carries <b>controls</b> (validation, exceptions, materiality, divergence flags); it&apos;s{" "}
          <b>repeatable</b> by anyone; and it is <b>near-unbiased</b> ({fmtSignedPct(b.overall.engineBias)}) where Denise
          chronically <b>under</b>-accrues ({fmtSignedPct(b.overall.deniseBias)}) — a bias that understates the P&amp;L
          every period, while per-month noise averages out.
        </p>
      </Card>

      <Card title="FreightClose vs Denise — April 2026" subtitle={da.note}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-4 font-medium">Carrier</th>
              <th className="py-2 pr-4 text-right font-medium">FreightClose</th>
              <th className="py-2 pr-4 text-right font-medium">Denise</th>
              <th className="py-2 pr-4 text-right font-medium">Δ</th>
            </tr>
          </thead>
          <tbody className="tnum">
            {da.byCarrier.map((d) => (
              <tr key={d.carrier} className="border-b border-slate-100">
                <td className="py-2 pr-4">{carrierName[d.carrier]}</td>
                <td className="py-2 pr-4 text-right font-medium">{fmtUsd(d.freightClose)}</td>
                <td className="py-2 pr-4 text-right text-slate-500">{fmtUsd(d.denise)}</td>
                <td className={`py-2 pr-4 text-right ${d.delta >= 0 ? "text-emerald-700" : "text-amber-700"}`}>
                  {d.delta >= 0 ? "+" : ""}
                  {fmtUsd(d.delta)}
                </td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="py-2 pr-4">Total</td>
              <td className="py-2 pr-4 text-right">{fmtUsd(da.totalFreightClose)}</td>
              <td className="py-2 pr-4 text-right text-slate-500">{fmtUsd(da.totalDenise)}</td>
              <td className={`py-2 pr-4 text-right ${da.totalFreightClose - da.totalDenise >= 0 ? "text-emerald-700" : "text-amber-700"}`}>
                {da.totalFreightClose - da.totalDenise >= 0 ? "+" : ""}
                {fmtUsd(da.totalFreightClose - da.totalDenise)}
              </td>
            </tr>
          </tbody>
        </table>
        <p className="mt-3 text-xs text-slate-600">
          The Heartland gap is the headline: April is the first month of Q2, so the volume-tier discount{" "}
          <span className="font-medium">resets to 0%</span>. Denise&apos;s trailing average still embeds Q1&apos;s
          discounted months, so she structurally under-accrues the reset — her worst historical miss (Jan −18.7%).
        </p>
      </Card>

      <Card
        title="Closed months — engine vs Denise vs actual"
        subtitle="The full three-way for each reconstructed historical month. Error % is signed vs actual invoiced; 'Closer' is whoever was nearer that month."
      >
        <ThreeWayChart />
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4 font-medium">Month</th>
                <th className="py-2 pr-4 text-right font-medium">Engine</th>
                <th className="py-2 pr-4 text-right font-medium">Denise</th>
                <th className="py-2 pr-4 text-right font-medium">Actual</th>
                <th className="py-2 pr-4 text-right font-medium">Engine err</th>
                <th className="py-2 pr-4 text-right font-medium">Denise err</th>
                <th className="py-2 pr-4 text-center font-medium">Closer</th>
              </tr>
            </thead>
            <tbody className="tnum">
              {closedPeriods.map((p) => {
                const engErr = p.actualTotal ? (p.engineTotal - p.actualTotal) / p.actualTotal : 0;
                const denErr = p.actualTotal ? (p.denise.totalDenise - p.actualTotal) / p.actualTotal : 0;
                const closer = p.isColdStart ? "n/a" : Math.abs(engErr) < Math.abs(denErr) - 1e-9 ? "engine" : Math.abs(denErr) < Math.abs(engErr) - 1e-9 ? "denise" : "tie";
                const showWinner = !p.isColdStart; // cold-start month is excluded from the head-to-head — no winner highlight
                return (
                  <tr key={p.periodId} className="border-b border-slate-100">
                    <td className="py-1.5 pr-4 text-slate-600">
                      {p.label}
                      {p.isColdStart && <span className="ml-1 text-xs text-slate-400">(cold start)</span>}
                    </td>
                    <td className="py-1.5 pr-4 text-right">{fmtUsd(p.engineTotal)}</td>
                    <td className="py-1.5 pr-4 text-right text-slate-500">{fmtUsd(p.denise.totalDenise)}</td>
                    <td className="py-1.5 pr-4 text-right">{fmtUsd(p.actualTotal)}</td>
                    <td className={`py-1.5 pr-4 text-right ${showWinner && Math.abs(engErr) <= Math.abs(denErr) ? "font-medium text-emerald-700" : "text-slate-500"}`}>{fmtSignedPct(engErr)}</td>
                    <td className={`py-1.5 pr-4 text-right ${showWinner && Math.abs(denErr) < Math.abs(engErr) ? "font-medium text-emerald-700" : "text-slate-500"}`}>{fmtSignedPct(denErr)}</td>
                    <td className="py-1.5 pr-4 text-center">
                      {closer === "engine" ? (
                        <Badge className="bg-emerald-100 text-emerald-800 ring-emerald-200">engine</Badge>
                      ) : closer === "denise" ? (
                        <Badge className="bg-slate-100 text-slate-600 ring-slate-200">denise</Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-500 ring-slate-200">{closer}</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          October is cold-start (no prior invoices to calibrate from) and excluded from the head-to-head, exactly as a
          trailing method has no first-month basis either. The neutral close loop — engine estimate vs actual + the
          true-up entry, with no Denise column — lives on the <b>Closed Periods</b> tab.
        </p>
      </Card>

      <AskFreightClose includeDenise />
    </div>
  );
}
