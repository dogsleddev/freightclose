import Link from "next/link";
import { accrualRun } from "@/app/lib/accrual";
import { Card, Stat, Badge, PageHeader } from "@/components/ui";
import { AskFreightClose } from "@/components/AskFreightClose";
import {
  fmtUsd,
  fmtUsd2,
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
                    <td className="py-2 pr-4 text-right">
                      <Link href="/exceptions" className="text-slate-700 underline-offset-2 hover:text-ink hover:underline">
                        {cs.exceptionCount}
                      </Link>
                    </td>
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
                <td className="py-2 pr-4 text-right">
                  <Link href="/exceptions" className="text-slate-700 underline-offset-2 hover:text-ink hover:underline">
                    {r.exceptions.length}
                  </Link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          <b>Credit reserve</b> is a small credit (≈ {fmtSignedPct(r.totalCreditReserve / (r.totalAccrual - r.totalCreditReserve))}{" "}
          of invoiced) booked every month from the carriers&apos; historical net-adjustment run-rate (post-billing
          credits and corrections), so the accrual is not systematically higher than what the carriers eventually
          invoice.{" "}
          <Link href="/exceptions" className="underline-offset-2 hover:text-ink hover:underline">
            Flags
          </Link>{" "}
          link to the exception register.
        </p>
      </Card>

      {/* calibration thesis — one-liner; full printed-vs-calibrated table lives on Rates */}
      <Card title="Why calibrate from invoices" subtitle="The printed rate card is stale in both directions — calibrating from the carriers' own invoices fixes it.">
        <p className="text-sm leading-relaxed text-slate-600">
          Each carrier applies a monthly rate index on top of its printed card. Peak&apos;s printed card runs{" "}
          <b className="text-amber-700">{fmtSignedPct(r.calibration.peak.divergence.divergencePct)} {r.calibration.peak.divergence.direction === "printed_high" ? "high" : "low"}</b>;
          Heartland and Coastal run low recently. A static card can&apos;t catch either direction — calibrating from
          invoice history does. The full printed-vs-calibrated table, by carrier, is on{" "}
          <Link href="/rates" className="font-medium underline-offset-2 hover:text-ink hover:underline">Rates</Link>,
          and the engine&apos;s out-of-sample accuracy is on{" "}
          <Link href="/backtest" className="font-medium underline-offset-2 hover:text-ink hover:underline">Accuracy</Link>.
        </p>
      </Card>

      {/* journal entry — compact summary; the full entry + month-over-month is on Journal Entries */}
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
            <Link
              href="/je"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              View full entry →
            </Link>
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
          <div>
            <span className="text-slate-500">Dr Freight Expense (by carrier)</span>{" "}
            <span className="tnum font-semibold">{fmtUsd2(r.journalEntry.totalDebits)}</span>
          </div>
          <div>
            <span className="text-slate-500">Cr Accrued Freight Liability</span>{" "}
            <span className="tnum font-semibold">{fmtUsd2(r.journalEntry.totalCredits)}</span>
          </div>
          <Badge
            className={
              r.journalEntry.balanced
                ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
                : "bg-red-100 text-red-800 ring-red-200"
            }
          >
            {r.journalEntry.balanced ? "balanced ✓" : "OUT OF BALANCE"}
          </Badge>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {r.journalEntry.lines.length} lines · NetSuite-import layout · reverses on receipt of carrier invoices. The
          full line-by-line entry with the prior period and the month-over-month move is on{" "}
          <Link href="/je" className="underline-offset-2 hover:text-ink hover:underline">Journal entries</Link>.
        </p>
      </Card>

      <AskFreightClose />
    </div>
  );
}
