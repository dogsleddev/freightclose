"use client";

// Closed Periods — the month-end reconciliation surface. For each closed month
// (Oct 2025–Mar 2026) it shows the engine's honest leave-one-out estimate vs the
// ACTUAL invoiced, the variance against materiality thresholds, and the balanced
// TRUE-UP journal entry that books the estimate→actual delta. Denise-free by
// design: the engine-vs-Denise-vs-actual comparison is quarantined to the Denise
// Comparison tab.

import { useState } from "react";
import { closedPeriods } from "@/app/lib/periods";
import { Card, Badge, Stat, PageHeader } from "@/components/ui";
import { fmtUsd, fmtUsd2, fmtSignedPct, carrierName } from "@/app/lib/format";

// Materiality bands (PRD): green ≤5% / amber ≤10% / escalate >10%.
function varAccent(pct: number): string {
  const a = Math.abs(pct);
  return a <= 0.05 ? "text-emerald-700" : a <= 0.1 ? "text-amber-700" : "text-red-700";
}
function varBadge(pct: number): { label: string; cls: string } {
  const a = Math.abs(pct);
  if (a <= 0.05) return { label: "within materiality (≤5%)", cls: "bg-emerald-100 text-emerald-800 ring-emerald-200" };
  if (a <= 0.1) return { label: "review (≤10%)", cls: "bg-amber-100 text-amber-800 ring-amber-200" };
  return { label: "escalate (>10%)", cls: "bg-red-100 text-red-800 ring-red-200" };
}

export default function ClosedPeriods() {
  const periods = closedPeriods;
  const [sel, setSel] = useState(periods[periods.length - 1].periodId); // default: most recent close
  const p = periods.find((x) => x.periodId === sel)!;
  const slug = p.label.toLowerCase().replace(/\s+/g, "-");
  const vb = varBadge(p.variancePct);
  const underAccrued = p.varianceDollars >= 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Closed periods — reconciliation & true-up"
        lead="Each closed month, side by side: what Freight Close would have accrued at the close (calibrated only from prior months — the honest leave-one-out estimate) vs the actual invoiced once the carriers billed, the variance against materiality thresholds, and the balanced journal entry that trues the accrual up to actual. This is the close loop a trailing average can't run: every dollar ties to a shipment and self-corrects against actuals."
      />

      {/* period switcher */}
      <div className="flex flex-wrap gap-1.5">
        {periods.map((x) => (
          <button
            key={x.periodId}
            onClick={() => setSel(x.periodId)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              x.periodId === sel ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            {x.label}
          </button>
        ))}
      </div>

      {/* hero stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <Stat label="Engine estimate" value={fmtUsd(p.engineTotal)} sub={p.isColdStart ? "cold start — no prior history" : "calibrated from prior months only"} />
        </Card>
        <Card>
          <Stat label="Actual invoiced" value={fmtUsd(p.actualTotal)} sub="this month's carrier invoice register" />
        </Card>
        <Card>
          <Stat label="Variance" value={fmtUsd(p.varianceDollars)} accent={varAccent(p.variancePct)} sub={`${fmtSignedPct(p.variancePct)} · ${underAccrued ? "under-accrued" : "over-accrued"}`} />
        </Card>
        <Card>
          <Stat label="True-up entry" value={fmtUsd(p.trueUpJournal.totalDebits)} sub={p.trueUpJournal.balanced ? "balanced Dr = Cr" : "OUT OF BALANCE"} accent={p.trueUpJournal.balanced ? "text-slate-900" : "text-red-700"} />
        </Card>
      </div>

      {/* three-way (engine vs actual) — Denise-free */}
      <Card
        title={`${p.label} — estimate vs actual by carrier`}
        subtitle="Variance = actual − engine estimate (positive = under-accrued). Materiality: green ≤5% / amber ≤10% / escalate >10%."
        right={
          <div className="flex items-center gap-2">
            <Badge className="bg-sky-100 text-sky-800 ring-sky-200">{p.badge}</Badge>
            {p.isColdStart && <Badge className="bg-slate-100 text-slate-600 ring-slate-200">cold start</Badge>}
            <Badge className={vb.cls}>{vb.label}</Badge>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4 font-medium">Carrier</th>
                <th className="py-2 pr-4 text-right font-medium">Engine estimate</th>
                <th className="py-2 pr-4 text-right font-medium">Actual invoiced</th>
                <th className="py-2 pr-4 text-right font-medium">Variance $</th>
                <th className="py-2 pr-4 text-right font-medium">Variance %</th>
              </tr>
            </thead>
            <tbody className="tnum">
              {p.byCarrier.map((c) => (
                <tr key={c.carrier} className="border-b border-slate-100">
                  <td className="py-2 pr-4">{carrierName[c.carrier]}</td>
                  <td className="py-2 pr-4 text-right">{fmtUsd2(c.engine)}</td>
                  <td className="py-2 pr-4 text-right">{fmtUsd2(c.actual)}</td>
                  <td className={`py-2 pr-4 text-right ${varAccent(c.variancePct)}`}>{fmtUsd2(c.varianceDollars)}</td>
                  <td className={`py-2 pr-4 text-right ${varAccent(c.variancePct)}`}>{fmtSignedPct(c.variancePct)}</td>
                </tr>
              ))}
              <tr className="font-semibold text-slate-900">
                <td className="py-2 pr-4">Total</td>
                <td className="tnum py-2 pr-4 text-right">{fmtUsd2(p.engineTotal)}</td>
                <td className="tnum py-2 pr-4 text-right">{fmtUsd2(p.actualTotal)}</td>
                <td className={`tnum py-2 pr-4 text-right ${varAccent(p.variancePct)}`}>{fmtUsd2(p.varianceDollars)}</td>
                <td className={`tnum py-2 pr-4 text-right ${varAccent(p.variancePct)}`}>{fmtSignedPct(p.variancePct)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          {p.isColdStart
            ? "October is the first month on record — with no prior invoices to calibrate from, the estimate prices on the printed contract card (cold start), so its variance is expected to be wider and is not an accuracy claim."
            : "The engine estimate is the leave-one-out figure: calibrated only from months before this one, so it reflects what Freight Close would have booked at the close, before these invoices existed."}{" "}
          The invoice register reconciles to the recorded actuals control: <b>{p.actualsReconcileToDenise ? "tie-out passed" : "TIE-OUT FAILED"}</b>.
        </p>
      </Card>

      {/* true-up journal entry */}
      <Card
        title={`True-up journal entry — ${p.label}`}
        subtitle={`${p.trueUpJournal.framework} · entry date ${p.trueUpJournal.date}`}
        right={
          <Badge className={p.trueUpJournal.balanced ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-red-100 text-red-800 ring-red-200"}>
            {p.trueUpJournal.balanced ? "balanced" : "OUT OF BALANCE"}
          </Badge>
        }
      >
        <p className="mb-3 text-xs leading-relaxed text-slate-500">{p.trueUpJournal.description}</p>
        {p.trueUpJournal.lines.length === 0 ? (
          <p className="text-sm text-slate-600">No adjustment needed — the accrual estimate matched actual invoiced.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3">Account</th>
                  <th className="py-2 pr-3">Memo</th>
                  <th className="py-2 pr-3 text-right">Debit</th>
                  <th className="py-2 pl-3 text-right">Credit</th>
                </tr>
              </thead>
              <tbody>
                {p.trueUpJournal.lines.map((l, i) => (
                  <tr key={i} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-3">
                      <div className="font-mono text-xs text-slate-500">{l.account}</div>
                      <div className="text-slate-800">{l.accountName}</div>
                      {l.carrier && <div className="text-xs text-slate-400">{carrierName[l.carrier]}</div>}
                    </td>
                    <td className="py-2 pr-3 text-xs leading-relaxed text-slate-600">{l.memo}</td>
                    <td className="tnum py-2 pr-3 text-right">{l.type === "debit" ? fmtUsd2(l.amount) : ""}</td>
                    <td className="tnum py-2 pl-3 text-right">{l.type === "credit" ? fmtUsd2(l.amount) : ""}</td>
                  </tr>
                ))}
                <tr className="font-semibold text-slate-900">
                  <td className="py-2 pr-3">Totals</td>
                  <td />
                  <td className="tnum py-2 pr-3 text-right">{fmtUsd2(p.trueUpJournal.totalDebits)}</td>
                  <td className="tnum py-2 pl-3 text-right">{fmtUsd2(p.trueUpJournal.totalCredits)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-3 text-right">
          <a
            href={`/freightclose-trueup-je-${slug}.csv`}
            download
            className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Download NetSuite CSV
          </a>
        </div>
      </Card>
    </div>
  );
}
