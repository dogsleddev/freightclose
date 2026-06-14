// May 2026 — synthetic adaptability scenario. The SAME 160 shipments priced
// under two rate environments (no-change vs an announced Peak fuel spike), side
// by side, to demonstrate the engine's response to a known forward rate change.
// Clearly badged SYNTHETIC — the real/synthetic boundary is physical and loud.

import { mayScenario } from "@/app/lib/periods";
import { Card, Stat, PageHeader, Badge } from "@/components/ui";
import { fmtUsd, fmtUsd2, fmtSignedPct, fmtPct, carrierName } from "@/app/lib/format";
import type { MayVariant } from "@/engine/types";

function varAccent(pct: number): string {
  const a = Math.abs(pct);
  return a <= 0.05 ? "text-emerald-700" : a <= 0.1 ? "text-amber-700" : "text-red-700";
}

function VariantCard({ v }: { v: MayVariant }) {
  return (
    <Card
      title={v.title}
      subtitle={`Engine estimate vs simulated actual · Peak fuel ${fmtPct(v.peakFuelPct)}`}
      right={
        v.isScenarioOverride ? (
          <Badge className="bg-amber-100 text-amber-800 ring-amber-200">scenario override</Badge>
        ) : (
          <Badge className="bg-slate-100 text-slate-600 ring-slate-200">calibrated</Badge>
        )
      }
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="py-2 pr-4 font-medium">Carrier</th>
            <th className="py-2 pr-4 text-right font-medium">Engine</th>
            <th className="py-2 pr-4 text-right font-medium">Actual</th>
            <th className="py-2 pr-4 text-right font-medium">Variance</th>
          </tr>
        </thead>
        <tbody className="tnum">
          {v.byCarrier.map((c) => (
            <tr key={c.carrier} className="border-b border-slate-100">
              <td className="py-2 pr-4">{carrierName[c.carrier]}</td>
              <td className="py-2 pr-4 text-right">{fmtUsd2(c.engine)}</td>
              <td className="py-2 pr-4 text-right">{fmtUsd2(c.actual)}</td>
              <td className={`py-2 pr-4 text-right ${varAccent(c.variancePct)}`}>{fmtUsd2(c.varianceDollars)}</td>
            </tr>
          ))}
          <tr className="font-semibold text-slate-900">
            <td className="py-2 pr-4">Total</td>
            <td className="tnum py-2 pr-4 text-right">{fmtUsd2(v.engineTotal)}</td>
            <td className="tnum py-2 pr-4 text-right">{fmtUsd2(v.actualTotal)}</td>
            <td className={`tnum py-2 pr-4 text-right ${varAccent(v.variancePct)}`}>
              {fmtUsd2(v.varianceDollars)} ({fmtSignedPct(v.variancePct)})
            </td>
          </tr>
        </tbody>
      </table>
      {v.divergenceNote && (
        <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900 ring-1 ring-inset ring-amber-200">
          <b>Control flag — rate-source divergence:</b> {v.divergenceNote}
        </div>
      )}
      <div className="mt-3 text-right">
        <a
          href={`/freightclose-trueup-je-may-2026-${v.key}.csv`}
          download
          className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Download true-up JE (NetSuite CSV)
        </a>
      </div>
    </Card>
  );
}

export default function MayScenarioPage() {
  const m = mayScenario;

  return (
    <div className="space-y-6">
      {/* loud synthetic boundary */}
      <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <span className="mr-2">🧪</span>
        <b>Simulated period — synthetic data.</b> May 2026 is generated, not real Numeric activity. It exists only
        to demonstrate adaptability to a known forward rate change. Real and synthetic data never share a folder.
      </div>

      <PageHeader
        title="May 2026 — adaptability scenario"
        lead="The same 160 May shipments, priced under two rate environments side by side: a no-change baseline (Peak fuel calibrated at 14% from history) and an announced Peak fuel-surcharge spike (14% → 19%). This is the test a trailing average fails: it is blind to a rate change that hasn't hit invoices yet. Freight Close applies the change as a scenario rate-source override, books it, and flags the divergence."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <Stat
            label="Actual spike impact"
            value={fmtUsd(m.actualSpikeDelta)}
            sub="Entirely Peak fuel — same shipments, +5 pts on base"
          />
        </Card>
        <Card>
          <Stat
            label="Engine captures (override)"
            value={fmtUsd(m.engineSpikeUplift)}
            accent="text-emerald-700"
            sub={`Peak fuel ${fmtPct(m.calibratedPeakFuelPct)} → ${fmtPct(m.scenarioPeakFuelPct)}, flagged`}
          />
        </Card>
        <Card>
          <Stat
            label="If blind to the change"
            value={fmtUsd(m.blindUnderAccrual)}
            accent="text-amber-700"
            sub="Under-accrual a history-only / trailing estimate would book"
          />
        </Card>
      </div>

      <Card title="The takeaway" subtitle="Adaptability is the one axis a trailing average structurally can't compete on.">
        <p className="text-sm leading-relaxed text-slate-600">
          Peak announces its fuel surcharge rising <b>{fmtPct(m.calibratedPeakFuelPct)} → {fmtPct(m.scenarioPeakFuelPct)}</b>{" "}
          for May — before a single invoice reflects it. A trailing average is blind to the announcement and would
          under-accrue by <b>{fmtUsd(m.blindUnderAccrual)}</b>. Freight Close applies the announced rate as a{" "}
          <b>scenario override</b> (only fuel moves; base stays calibrated), books it, and raises a <b>control flag</b>{" "}
          so it&apos;s never silent — landing within <b>{fmtPct(Math.abs(m.variants[1].variancePct))}</b> of actual.
        </p>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {m.variants.map((v) => (
          <VariantCard key={v.key} v={v} />
        ))}
      </div>
    </div>
  );
}
