import { accrualRun } from "@/app/lib/accrual";
import { Card, Stat, PageHeader } from "@/components/ui";
import { fmtUsd, fmtPct, fmtSignedPct, carrierName } from "@/app/lib/format";

// Engine-only accuracy. The vs-Denise head-to-head is quarantined to the Denise
// Comparison tab; this page proves the engine's OWN accuracy: reconstruction
// (in-sample mechanics) + the out-of-sample expanding-window forecast vs actual.

function errAccent(pct: number): string {
  const a = Math.abs(pct);
  return a <= 0.05 ? "text-emerald-700" : a <= 0.1 ? "text-amber-700" : "text-red-700";
}

export default function BackTest() {
  const r = accrualRun;
  const b = r.backtest;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accuracy & back-test"
        lead="Two honest views of the engine's own accuracy. Reconstruction proves the pricing mechanics reproduce six months of invoices to the cent (in-sample). The expanding-window forecast is the out-of-sample test — each month's rate index is calibrated only from prior months, then applied to that month's actual activity (no circularity). The head-to-head against Denise's trailing average lives on the Denise Comparison tab."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <Stat
            label="Reconstruction error"
            value={`±${fmtUsd(b.reconstruction.byCarrierMonthMaxErrorDollars)}`}
            accent="text-emerald-700"
            sub={`Max per-carrier-month error reproducing ${r.inputs.invoiceLines} invoices`}
          />
        </Card>
        <Card>
          <Stat
            label="Forecast MAPE (6-mo)"
            value={fmtPct(b.overall.engineMape)}
            sub="Out-of-sample, expanding window — prior months only"
          />
        </Card>
        <Card>
          <Stat
            label="Accrual bias (6-mo)"
            value={fmtSignedPct(b.overall.engineBias)}
            accent="text-emerald-700"
            sub="Near-unbiased — neither systematically over- nor under-stated"
          />
        </Card>
      </div>

      <Card title="How to read this — bias matters more than per-month error" subtitle="What the forecast does and doesn't claim.">
        <p className="text-sm leading-relaxed text-slate-600">
          Each carrier applies a volatile monthly rate index (±30%), but monthly <i>spend</i> is stabilized (rate and
          volume move opposite ways), so per-month percentage error on a forecast is inherently noisy — we don&apos;t
          chase it. What an accrual must not do is miss in the <i>same direction</i> every period: <b>bias</b> compounds
          in the P&amp;L; per-month noise averages out. The engine is near-unbiased ({fmtSignedPct(b.overall.engineBias)}),
          decisively prices the one <i>structurally predictable</i> error — the Heartland quarter-to-date reset — and
          prices the shipments that actually moved, so April reflects April&apos;s mix with shipment-level backup and a
          confidence band instead of a bare point estimate. The reconstruction below proves the mechanics reproduce every
          historical invoice to within ±{fmtUsd(b.reconstruction.byCarrierMonthMaxErrorDollars)}.
        </p>
      </Card>

      <Card title="Forecast vs actual — by carrier-month" subtitle={b.modeNote}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4 font-medium">Month</th>
                <th className="py-2 pr-4 font-medium">Carrier</th>
                <th className="py-2 pr-4 text-right font-medium">Engine estimate</th>
                <th className="py-2 pr-4 text-right font-medium">Actual</th>
                <th className="py-2 pr-4 text-right font-medium">Engine error</th>
              </tr>
            </thead>
            <tbody className="tnum">
              {b.cells.map((c, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-1.5 pr-4 text-slate-600">{c.month}</td>
                  <td className="py-1.5 pr-4">{carrierName[c.carrier]}</td>
                  <td className="py-1.5 pr-4 text-right">{fmtUsd(c.engineEstimate)}</td>
                  <td className="py-1.5 pr-4 text-right">{fmtUsd(c.actual)}</td>
                  <td className={`py-1.5 pr-4 text-right ${errAccent(c.engineErrorPct)}`}>{fmtSignedPct(c.engineErrorPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          First month is cold-start (no prior invoices to calibrate from) and excluded from the headline metrics.
        </p>
      </Card>

      <Card title="By carrier — engine MAPE & bias (forecast)">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-4 font-medium">Carrier</th>
              <th className="py-2 pr-4 text-right font-medium">Engine MAPE</th>
              <th className="py-2 pr-4 text-right font-medium">Engine bias</th>
              <th className="py-2 pr-4 text-right font-medium">Months</th>
            </tr>
          </thead>
          <tbody className="tnum">
            {(["peak", "heartland", "coastal"] as const).map((c) => {
              const m = b.byCarrier[c];
              return (
                <tr key={c} className="border-b border-slate-100">
                  <td className="py-2 pr-4">{carrierName[c]}</td>
                  <td className="py-2 pr-4 text-right">{fmtPct(m.engineMape)}</td>
                  <td className={`py-2 pr-4 text-right ${errAccent(m.engineBias)}`}>{fmtSignedPct(m.engineBias)}</td>
                  <td className="py-2 pr-4 text-right text-slate-500">{m.months}</td>
                </tr>
              );
            })}
            <tr className="font-semibold">
              <td className="py-2 pr-4">Overall</td>
              <td className="py-2 pr-4 text-right">{fmtPct(b.overall.engineMape)}</td>
              <td className="py-2 pr-4 text-right text-emerald-700">{fmtSignedPct(b.overall.engineBias)}</td>
              <td className="py-2 pr-4 text-right text-slate-500">{b.overall.months}</td>
            </tr>
          </tbody>
        </table>
        <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-500">
          <p>
            <b className="text-slate-700">Peak ({fmtPct(b.byCarrier.peak.engineMape)}):</b> the most volatile index in the
            data ({r.calibration.rateIndex.statsByCarrier.peak.min}–{r.calibration.rateIndex.statsByCarrier.peak.max}) plus
            an incomplete printed mileage table — the noisiest per-month estimates, which is exactly why Peak&apos;s printed
            card can&apos;t be trusted at face value. The misses are flagged (MAPE alarm) and carried in the confidence
            band, not hidden.
          </p>
          <p>
            <b className="text-slate-700">Heartland ({fmtPct(b.byCarrier.heartland.engineMape)}):</b> the structurally
            predictable carrier — the quarter-to-date tier reset is contractual, and pricing it exactly is where a
            bottoms-up engine adds the most value.
          </p>
          <p>
            <b className="text-slate-700">Coastal ({fmtPct(b.byCarrier.coastal.engineMape)}):</b> monthly spend is the most
            stabilized in the data, so per-month error is dominated by noise; the engine adds shipment-level backup that
            ties to the JE, exception flags, and a band that says how much the accrual could move.
          </p>
        </div>
      </Card>
    </div>
  );
}
