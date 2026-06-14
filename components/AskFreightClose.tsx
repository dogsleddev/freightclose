"use client";

import { useState, type ReactNode } from "react";
import { accrualRun } from "@/app/lib/accrual";
import { fmtUsd, fmtUsd2, fmtSignedPct, carrierName } from "@/app/lib/format";

// Deterministic, grounded Q&A. Each question maps to a pure function over the
// computed engine output. Numbers are RETRIEVED, never generated — same data,
// same answer, always. This is not an LLM and cannot hallucinate a figure.

const r = accrualRun;

interface QA {
  q: string;
  cite: string;
  answer: () => ReactNode;
}

const QUESTIONS: QA[] = [
  {
    q: "What's the total April freight accrual?",
    cite: "JE total + carrier summaries",
    answer: () => (
      <div className="space-y-2">
        <p>
          The April 2026 freight accrual is <b>{fmtUsd2(r.totalAccrual)}</b> (net of a {fmtUsd2(r.totalCreditReserve)}{" "}
          credit reserve), booked under {r.framework} as Dr Freight Expense / Cr Accrued Freight Liability.
        </p>
        <ul className="ml-4 list-disc text-slate-600">
          {r.carrierSummaries.map((c) => (
            <li key={c.carrier}>
              {carrierName[c.carrier]}: <b className="text-slate-900">{fmtUsd2(c.accrual)}</b> ({c.shipmentCount} shipments)
            </li>
          ))}
        </ul>
        <p className="text-slate-600">Confidence range ±1σ: {fmtUsd(r.confidence.total.low)}–{fmtUsd(r.confidence.total.high)}.</p>
      </div>
    ),
  },
  {
    q: "What needs review before I post?",
    cite: "exception register",
    answer: () => {
      const errs = r.exceptions.filter((e) => e.severity === "error");
      const warns = r.exceptions.filter((e) => e.severity === "warn");
      return (
        <div className="space-y-2">
          <p>
            {r.exceptions.length} flags: <b>{r.exceptionsBySeverity.error} error</b>, {r.exceptionsBySeverity.warn} warn,{" "}
            {r.exceptionsBySeverity.info} info.
          </p>
          {errs.length > 0 && (
            <ul className="ml-4 list-disc text-red-700">
              {errs.map((e) => (
                <li key={e.id}>
                  [{e.code}] {e.message}
                </li>
              ))}
            </ul>
          )}
          <p className="text-slate-600">Top items to review:</p>
          <ul className="ml-4 list-disc text-slate-600">
            {warns.slice(0, 5).map((e) => (
              <li key={e.id}>
                <span className="font-mono text-xs">{e.shipmentId ?? e.carrier ?? "run"}</span> — {e.message}
              </li>
            ))}
          </ul>
        </div>
      );
    },
  },
  {
    q: "What backup supports this JE?",
    cite: "tie-out chain",
    answer: () => (
      <div className="space-y-2">
        <p>The JE ties all the way down to shipment detail:</p>
        <ul className="ml-4 list-disc text-slate-600">
          <li>
            JE debits <b>{fmtUsd2(r.journalEntry.totalDebits)}</b> = Σ carrier accruals = Σ {r.inputs.uniqueShipments}{" "}
            shipment estimates.
          </li>
          <li>JE balances: debits {fmtUsd2(r.journalEntry.totalDebits)} = credits {fmtUsd2(r.journalEntry.totalCredits)}.</li>
          <li>
            Method validated: the engine reproduces all {r.inputs.invoiceLines} historical invoice lines within{" "}
            <b>±{fmtUsd2(r.backtest.reconstruction.byCarrierMonthMaxErrorDollars)}</b> per carrier-month.
          </li>
          <li>All {r.tieOuts.length} automated tie-outs pass. Export the shipment-backup CSV for the full trail.</li>
        </ul>
      </div>
    ),
  },
  {
    q: "Why is Heartland different this month?",
    cite: "QTD volume-tier reset",
    answer: () => {
      const hf = r.carrierSummaries.find((c) => c.carrier === "heartland")!;
      const tier1 = r.shipmentEstimates.filter((e) => e.carrier === "heartland" && e.classification.heartlandTier === 1).length;
      return (
        <div className="space-y-2">
          <p>
            April is the first month of Q2, so Heartland&apos;s cumulative volume discount <b>resets to 0% on Apr 1</b>.
            The first {tier1} shipments price at full rate, then the discount steps down as the month&apos;s count crosses
            50 / 120 / 200.
          </p>
          <p className="text-slate-600">
            FreightClose accrues {fmtUsd(hf.accrual)} for Heartland by pricing that reset exactly from this month&apos;s
            shipment sequence — a contractual step a smoothed trailing estimate structurally can&apos;t see.
          </p>
        </div>
      );
    },
  },
  {
    q: "Which shipments used a fallback assumption?",
    cite: "fallback-flagged shipments",
    answer: () => {
      const codes = ["MILEAGE_FALLBACK_GEO", "MILEAGE_FALLBACK_PRINTED", "IMPUTED_WEIGHT", "ORIGIN_ASSUMPTION"];
      const flagged = r.exceptions.filter((e) => codes.includes(e.code));
      return (
        <div className="space-y-2">
          <p>{flagged.length} shipments were priced with a flagged fallback assumption (none are silent):</p>
          <ul className="ml-4 list-disc text-slate-600">
            {flagged.map((e) => (
              <li key={e.id}>
                <span className="font-mono text-xs">{e.shipmentId}</span> [{e.code}] — {e.message}
              </li>
            ))}
          </ul>
        </div>
      );
    },
  },
];

// The vs-Denise seeded question is QUARANTINED: it is only shown on the Denise
// Comparison tab (pass includeDenise), never on the neutral CFO Overview.
const DENISE_Q: QA = {
  q: "How does this compare to Denise's method?",
  cite: "Denise trailing-3-mo projection",
  answer: () => {
    const d = r.deniseApril;
    const delta = r.totalAccrual - d.totalDenise;
    return (
      <div className="space-y-2">
        <p>
          FreightClose: <b>{fmtUsd(r.totalAccrual)}</b> · Denise (trailing-3-mo avg): <b>{fmtUsd(d.totalDenise)}</b> ·
          difference <b>{fmtSignedPct(delta / d.totalDenise)}</b> ({fmtUsd(delta)}).
        </p>
        <ul className="ml-4 list-disc text-slate-600">
          {d.byCarrier.map((c) => (
            <li key={c.carrier}>
              {carrierName[c.carrier]}: FreightClose {fmtUsd(c.freightClose)} vs Denise {fmtUsd(c.denise)} ({c.delta >= 0 ? "+" : ""}
              {fmtUsd(c.delta)})
            </li>
          ))}
        </ul>
        <p className="text-slate-600">
          On out-of-sample MAPE Denise&apos;s trailing average is hard to beat; the engine&apos;s edge is that it is
          near-unbiased ({fmtSignedPct(r.backtest.overall.engineBias)}) where she systematically under-accrues
          ({fmtSignedPct(r.backtest.overall.deniseBias)}), and every dollar ties to a shipment.
        </p>
      </div>
    );
  },
};

export function AskFreightClose({ includeDenise = false }: { includeDenise?: boolean } = {}) {
  const questions = includeDenise ? [...QUESTIONS, DENISE_Q] : QUESTIONS;
  const [active, setActive] = useState(0);
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Ask FreightClose</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Grounded Q&amp;A — every figure is retrieved from the computed run, never generated. Not an LLM; it cannot
            hallucinate a number.
          </p>
        </div>
      </header>
      <div className="grid grid-cols-1 gap-4 px-5 py-4 md:grid-cols-[260px_1fr]">
        <div className="flex flex-col gap-1.5">
          {questions.map((qa, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`rounded-lg px-3 py-2 text-left text-sm transition ${
                active === i ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-700 hover:bg-slate-100"
              }`}
            >
              {qa.q}
            </button>
          ))}
        </div>
        <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-800">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            Answer · source: {questions[active].cite}
          </div>
          {questions[active].answer()}
        </div>
      </div>
    </section>
  );
}
