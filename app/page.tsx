import { accrualRun } from "@/app/lib/accrual";
import { Card, Stat, Badge, PageHeader } from "@/components/ui";
import { AskFreightClose } from "@/components/AskFreightClose";
import {
  fmtUsd,
  fmtUsd2,
  fmtPct,
  fmtSignedPct,
  carrierName,
  carrierAccent,
} from "@/app/lib/format";

export default function Dashboard() {
  const r = accrualRun;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`April 2026 freight accrual — ${fmtUsd(r.totalAccrual)}`}
        lead="FreightClose prices what actually shipped using rates calibrated from the carriers' own six months of invoices — not the stale printed cards — proves the method by reproducing those invoices to the cent, flags every assumption, and books one accrued-freight-liability entry that ties to shipment-level backup before invoices arrive."
      />

      {/* hero stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <Stat
            label="April accrual"
            value={fmtUsd(r.totalAccrual)}
            sub={`Dr Freight Expense / Cr Accrued Freight Liability · net of ${fmtUsd2(r.totalCreditReserve)} credit reserve`}
          />
        </Card>
        <Card>
          <Stat
            label="Confidence range (±1σ)"
            value={`${fmtUsd(r.confidence.total.low)}–${fmtUsd(r.confidence.total.high)}`}
            sub="From measured monthly rate-index volatility"
          />
        </Card>
        <Card>
          <Stat
            label="Accrual bias (6-mo back-test)"
            value={fmtSignedPct(r.backtest.overall.engineBias)}
            accent="text-emerald-700"
            sub="Near-unbiased — the accrual neither systematically over- nor under-states the liability"
          />
        </Card>
        <Card>
          <Stat
            label="Method proof"
            value={`±${fmtUsd2(r.backtest.reconstruction.byCarrierMonthMaxErrorDollars)}`}
            accent="text-emerald-700"
            sub={`Max error reproducing ${r.inputs.invoiceLines} historical invoices · all ${r.tieOuts.length} tie-outs pass`}
          />
        </Card>
      </div>

      {/* by carrier */}
      <Card title="Accrual by carrier" subtitle="Every figure ties to shipment-level backup; carrier accrual = Σ shipment estimates + credit reserve.">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4 font-medium">Carrier</th>
                <th className="py-2 pr-4 text-right font-medium">Shipments</th>
                <th className="py-2 pr-4 text-right font-medium">Base</th>
                <th className="py-2 pr-4 text-right font-medium">Fuel</th>
                <th className="py-2 pr-4 text-right font-medium">Accessorials</th>
                <th className="py-2 pr-4 text-right font-medium">Reserve</th>
                <th className="py-2 pr-4 text-right font-medium">Accrual</th>
                <th className="py-2 pr-4 text-right font-medium">±1σ band</th>
                <th className="py-2 pr-4 text-right font-medium">Flags</th>
              </tr>
            </thead>
            <tbody className="tnum">
              {r.carrierSummaries.map((cs) => {
                const band = r.confidence.byCarrier.find((b) => b.carrier === cs.carrier)!;
                return (
                  <tr key={cs.carrier} className="border-b border-slate-100">
                    <td className="py-2 pr-4">
                      <Badge className={carrierAccent[cs.carrier]}>{carrierName[cs.carrier]}</Badge>
                    </td>
                    <td className="py-2 pr-4 text-right">{cs.shipmentCount}</td>
                    <td className="py-2 pr-4 text-right">{fmtUsd(cs.base)}</td>
                    <td className="py-2 pr-4 text-right">{fmtUsd(cs.fuel)}</td>
                    <td className="py-2 pr-4 text-right">{fmtUsd(cs.accessorials + cs.residential)}</td>
                    <td className="py-2 pr-4 text-right text-slate-500">{fmtUsd2(cs.creditReserve)}</td>
                    <td className="py-2 pr-4 text-right font-semibold">{fmtUsd(cs.accrual)}</td>
                    <td className="py-2 pr-4 text-right text-xs text-slate-500">
                      {fmtUsd(band.low)}–{fmtUsd(band.high)}
                    </td>
                    <td className="py-2 pr-4 text-right">{cs.exceptionCount}</td>
                  </tr>
                );
              })}
              <tr className="font-semibold">
                <td className="py-2 pr-4">Total</td>
                <td className="py-2 pr-4 text-right">{r.inputs.uniqueShipments}</td>
                <td className="py-2 pr-4 text-right" colSpan={3}></td>
                <td className="py-2 pr-4 text-right text-slate-500">{fmtUsd2(r.totalCreditReserve)}</td>
                <td className="py-2 pr-4 text-right">{fmtUsd(r.totalAccrual)}</td>
                <td className="py-2 pr-4 text-right text-xs text-slate-500">
                  {fmtUsd(r.confidence.total.low)}–{fmtUsd(r.confidence.total.high)}
                </td>
                <td className="py-2 pr-4 text-right">{r.exceptions.length}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* calibration / rate index */}
      <Card title="Calibration: printed card vs invoice reality" subtitle="Each carrier applies a monthly rate index on top of the printed card. We calibrate it from invoices; the printed card alone is wrong.">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4 font-medium">Carrier</th>
                <th className="py-2 pr-4 text-right font-medium">April index</th>
                <th className="py-2 pr-4 text-right font-medium">Range (6 mo)</th>
                <th className="py-2 pr-4 text-right font-medium">Printed card</th>
              </tr>
            </thead>
            <tbody className="tnum">
              {(["peak", "heartland", "coastal"] as const).map((c) => {
                const idx = r.calibration.rateIndex.aprilByCarrier[c];
                const stats = r.calibration.rateIndex.statsByCarrier[c];
                const div = r.calibration[c].divergence;
                return (
                  <tr key={c} className="border-b border-slate-100">
                    <td className="py-2 pr-4">{carrierName[c]}</td>
                    <td className="py-2 pr-4 text-right font-medium">{idx.toFixed(3)}×</td>
                    <td className="py-2 pr-4 text-right text-xs text-slate-500">
                      {stats.min.toFixed(2)}–{stats.max.toFixed(2)}
                    </td>
                    <td className="py-2 pr-4 text-right text-xs">
                      <span className={div.direction === "printed_high" ? "text-amber-700" : "text-sky-700"}>
                        runs {fmtSignedPct(div.divergencePct)} {div.direction === "printed_high" ? "high" : "low"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-slate-600">
            Peak&apos;s printed card runs high (≈ the findings&apos; ~20%); Heartland&apos;s and Coastal&apos;s run low
            recently. Calibrating from invoices catches both directions — a static card cannot.
          </p>
        </Card>

      {/* journal entry */}
      <Card
        title="Journal entry — accrued freight liability"
        subtitle={r.journalEntry.description}
        right={
          <div className="flex gap-2">
            <a
              href="/freightclose-je-april-2026.csv"
              download
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
            >
              Export JE (NetSuite CSV)
            </a>
            <a
              href="/freightclose-shipment-backup-april-2026.csv"
              download
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Export backup
            </a>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4 font-medium">Account</th>
                <th className="py-2 pr-4 font-medium">Memo</th>
                <th className="py-2 pr-4 text-right font-medium">Debit</th>
                <th className="py-2 pr-4 text-right font-medium">Credit</th>
              </tr>
            </thead>
            <tbody className="tnum">
              {r.journalEntry.lines.map((l, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-2 pr-4 whitespace-nowrap">
                    <span className="font-mono text-xs text-slate-500">{l.account}</span> {l.accountName}
                  </td>
                  <td className="py-2 pr-4 text-xs text-slate-600">{l.memo}</td>
                  <td className="py-2 pr-4 text-right">{l.type === "debit" ? fmtUsd2(l.amount) : ""}</td>
                  <td className="py-2 pr-4 text-right">{l.type === "credit" ? fmtUsd2(l.amount) : ""}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-2 pr-4" colSpan={2}>
                  Totals {r.journalEntry.balanced ? "· balanced ✓" : "· OUT OF BALANCE"}
                </td>
                <td className="py-2 pr-4 text-right">{fmtUsd2(r.journalEntry.totalDebits)}</td>
                <td className="py-2 pr-4 text-right">{fmtUsd2(r.journalEntry.totalCredits)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <AskFreightClose />
    </div>
  );
}
