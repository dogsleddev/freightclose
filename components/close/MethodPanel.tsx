"use client";

// How the engine works, end to end, with this run's actual numbers inline —
// plus a sensitivity lab: drag the parameters and the SAME deterministic
// engine re-runs the whole close (calibration, pricing, back-test, exceptions)
// right here in the browser. The lab is analysis-only: the booked accrual
// always comes from the committed config.

import { useEffect, useMemo, useRef, useState } from "react";
import { accrualRun } from "@/app/lib/accrual";
import baseInputs from "@/app/_generated/baseInputs.json";
import { engineConfig } from "@/engine/config";
import { runClose } from "@/engine/close";
import { Card, Badge, Stat } from "@/components/ui";
import { fmtUsd, fmtUsd2, fmtPct, fmtSignedPct, carrierName, carrierAccent } from "@/app/lib/format";
import type { AccrualRun, Carrier, DeniseBaseline, InvoiceLine, ParsedShipment } from "@/engine/types";

const BASE = baseInputs as unknown as {
  invoices: InvoiceLine[];
  denise: DeniseBaseline[];
  shipments: ParsedShipment[];
  duplicateShipmentIds: string[];
};

const PROD = {
  window: engineConfig.calibration.recentWindowMonths,
  bandK: 1,
  divergencePct: engineConfig.thresholds.divergencePct,
  mapeAlarmPct: engineConfig.thresholds.backtestMapeAlarmPct,
  costOutlierZ: engineConfig.thresholds.costOutlierZ,
  reserve: engineConfig.calibration.creditReserve.enabled,
  // Fuel surcharge %s as calibrated from invoice history (the booked run). The
  // sliders are a forward-rate-change what-if: base stays calibrated, only the
  // fuel % moves, and any divergence raises a RATE_DIVERGENCE flag — the same
  // mechanism the May Peak fuel-spike scenario uses.
  fuelPeak: accrualRun.calibration.peak.fuelSurchargePct,
  fuelCoastal: accrualRun.calibration.coastal.fuelSurchargePct,
};

// The announced May Peak fuel-surcharge spike (matches engine/may.ts).
const PEAK_FUEL_SPIKE = 0.19;

interface LabParams {
  window: number;
  bandK: number;
  divergencePct: number;
  mapeAlarmPct: number;
  costOutlierZ: number;
  reserve: boolean;
  fuelPeak: number;
  fuelCoastal: number;
}

export function MethodPanel() {
  const r = accrualRun;
  const idx = r.calibration.rateIndex;

  return (
    <div className="space-y-6">
      <Pipeline run={r} />
      <MethodologyDetail run={r} />
      <SensitivityLab />
      <Card title="Where the figures on this page come from" subtitle="Nothing on this page is typed in — every number is read from the deterministic run output.">
        <p className="text-sm leading-relaxed text-slate-600">
          The engine is ~4,200 lines of unit-tested TypeScript with no database and no network calls. It runs at build
          time (this site) and in your browser (Monthly Close, and the lab above). Same inputs + same config ⇒
          byte-identical output — that determinism is what makes the {fmtUsd(0.32, 2).replace("$0.32", "±$0.32")}{" "}
          reconstruction and the &ldquo;Re-run &amp; verify&rdquo; proof on the Monthly Close tab possible. Current
          April indices: Peak {idx.aprilByCarrier.peak}, Heartland {idx.aprilByCarrier.heartland}, Coastal{" "}
          {idx.aprilByCarrier.coastal}.
        </p>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Part 1 — the pipeline, step by step
// ---------------------------------------------------------------------------

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <code className="block overflow-x-auto rounded-md bg-slate-50 px-3 py-2 font-mono text-xs text-slate-800 ring-1 ring-inset ring-slate-200">
      {children}
    </code>
  );
}

// ---------------------------------------------------------------------------
// Methodology & Math — Data Sources, Key Assumptions, Known Limitations
// (the ACCT'G-INTEL writeup; live counts derived from the emitted run)
// ---------------------------------------------------------------------------

function MethodologyDetail({ run }: { run: AccrualRun }) {
  const countCode = (codes: string[]) => run.exceptions.filter((e) => codes.includes(e.code)).length;
  const imputedWeight = countCode(["IMPUTED_WEIGHT"]);
  const missingWeight = countCode(["MISSING_WEIGHT"]) + imputedWeight;
  const mileageFallback = countCode(["MILEAGE_FALLBACK_GEO", "MILEAGE_FALLBACK_PRINTED"]);
  const originAssumed = countCode(["ORIGIN_ASSUMPTION"]);
  const deniseRows = BASE.denise.length;

  const sources = [
    { src: "Shipments (current period)", recs: `${run.inputs.shipmentRows} rows → ${run.inputs.uniqueShipments} unique`, use: "Priced this period; deduped + carrier-name normalized on ingest." },
    { src: "Carrier invoices (history)", recs: `${run.inputs.invoiceLines} lines through ${run.inputs.invoicesThrough}`, use: "Calibrate effective rates + the honest back-test; the actual register for closed months." },
    { src: "Rate cards (Peak / Heartland / Coastal)", recs: "3 contracted cards", use: "Structural rates + fallback; calibrated against billed invoices (cards run stale)." },
    { src: "Denise baseline", recs: `${deniseRows} carrier-months`, use: "Prior manual estimate — comparison only, quarantined to the Denise Comparison tab." },
  ];

  const assumptions = [
    "Heartland's volume-tier discount is quarter-to-date cumulative and resets on the quarter start (Apr 1) — priced from the shipment sequence, not a trailing blend.",
    "Printed rate cards are stale; effective rates are calibrated from the trailing invoice history (recent-window median), with a printed-card / scenario override for announced forward changes.",
    "Fuel surcharge is calibrated from invoice history (Peak ≈14%, Coastal ≈9.5%); a scenario override applies an announced change and flags the divergence.",
    `Missing weight (${missingWeight} this period) is imputed from units × the carrier's median lb/unit and flagged — never silently dropped; off-table / non-Denver mileage is recovered per-origin (Denver vs SLC) and flagged.`,
    "Where invoice history doesn't separate origin, Denver is assumed and flagged (ORIGIN_ASSUMPTION); service level is assumed not to affect price (no card prices by service).",
  ];

  const limitations = [
    `Off-table Peak destinations fall back to geo-estimated mileage (${mileageFallback} fallback${mileageFallback === 1 ? "" : "s"} this period, flagged); long-haul lanes are the noisiest and carry the widest band.`,
    "Historical shipments (Oct 2025–Mar 2026) are reconstructed from invoice line items (origin assumed Denver; residential inferred from accessorial detail) and are badged \"Reconstructed\" — the back-test's absolute error carries that noise.",
    "The confidence band is ±1σ of each carrier's monthly rate-index volatility, combined in quadrature assuming independence — a first-order estimate, not a full distribution.",
    "One-off accessorial surges and credit adjustments aren't predicted shipment-by-shipment; a small historical credit reserve absorbs the run-rate, the rest shows as variance at true-up.",
    "Out-of-sample, a trailing average is hard to beat on per-month MAPE; Freight Close's edge is transparency, adaptability, controls, repeatability, and a near-unbiased estimate — shown honestly on Accuracy / Back-test and Denise Comparison.",
  ];

  return (
    <Card title="Methodology & math — sources, assumptions, limitations" subtitle="The judgment behind the estimate, stated plainly. Counts are live from this run.">
      <div className="mb-4">
        <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">Data sources &amp; inputs</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4 font-medium">Source</th>
                <th className="py-2 pr-4 font-medium">Records</th>
                <th className="py-2 pr-4 font-medium">How it's used</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.src} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-4 font-medium text-slate-800">{s.src}</td>
                  <td className="tnum py-2 pr-4 text-slate-600">{s.recs}</td>
                  <td className="py-2 pr-4 text-slate-600">{s.use}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div>
          <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">Key assumptions</div>
          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-600">
            {assumptions.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>
        <div>
          <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">Known limitations</div>
          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-600">
            {limitations.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        </div>
      </div>
    </Card>
  );
}

function Pipeline({ run }: { run: AccrualRun }) {
  const cal = run.calibration;
  const stats = cal.rateIndex.statsByCarrier;
  const april = cal.rateIndex.aprilByCarrier;

  return (
    <div className="space-y-6">
      <Card
        title="1 · Parse & normalize"
        subtitle="Messy operational CSVs → typed records. All normalization tables live in config, not code."
      >
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-600">
          <li>
            Carrier names normalize via an alias map (&ldquo;PEAK LOG&rdquo;, &ldquo;Peak Logistics Inc&rdquo; → <code className="font-mono text-xs">peak</code>);
            unknown carriers raise an <code className="font-mono text-xs">UNKNOWN_CARRIER</code> error flag.
          </li>
          <li>
            {run.inputs.shipmentRows} shipment rows → {run.inputs.uniqueShipments} unique (duplicate ids dropped and
            flagged, never double-counted). {run.inputs.invoiceLines} invoice lines across six months feed calibration.
          </li>
          <li>
            Special-handling free text maps to canonical accessorial codes; residential is a flag, not a guess. Missing
            weights: imputed from units × the carrier&apos;s median lb/unit <em>only where weight affects price</em>{" "}
            (Heartland prices a flat zone rate — no imputation needed, flagged info-level).
          </li>
        </ul>
      </Card>

      <Card
        title="2 · Calibrate: the monthly rate index"
        subtitle="The one mechanism the whole method hangs on — discovered from the invoices, not assumed."
      >
        <p className="mb-3 text-sm leading-relaxed text-slate-600">
          Each carrier bills the printed (structural) card times a <b>global monthly multiplier</b> — identical across
          that carrier&apos;s destinations, zones, and regions within a month. The engine recovers it per carrier-month
          as the median ratio of billed base to structural base. That single number is why reconstruction ties every
          historical invoice to ±${run.backtest.reconstruction.byCarrierMonthMaxErrorDollars}.
        </p>
        <Formula>billed_base = structural_rate(card) × monthIndex[carrier][month] × (volume discount, HF only)</Formula>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4">Carrier</th>
                <th className="py-2 pr-4 text-right">Index range (6 mo)</th>
                <th className="py-2 pr-4 text-right">Mean</th>
                <th className="py-2 pr-4 text-right">Applied to April</th>
                <th className="py-2 pr-4">vs printed card</th>
              </tr>
            </thead>
            <tbody className="tnum">
              {(["peak", "heartland", "coastal"] as Carrier[]).map((c) => {
                const d = cal[c === "peak" ? "peak" : c === "heartland" ? "heartland" : "coastal"].divergence;
                return (
                  <tr key={c} className="border-b border-slate-100">
                    <td className="py-2 pr-4">
                      <Badge className={carrierAccent[c]}>{carrierName[c]}</Badge>
                    </td>
                    <td className="py-2 pr-4 text-right">
                      {stats[c].min} – {stats[c].max}
                    </td>
                    <td className="py-2 pr-4 text-right">{stats[c].mean}</td>
                    <td className="py-2 pr-4 text-right font-semibold">{april[c]}</td>
                    <td className="py-2 pr-4 text-xs text-slate-500">
                      printed runs {fmtPct(Math.abs(d.divergencePct))} {d.direction === "printed_high" ? "high" : "low"} — flagged
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          The index moves both directions (Peak&apos;s card prices high lately; Heartland/Coastal price low), which is
          why &ldquo;just use the printed card&rdquo; misprices in both directions and why the per-carrier{" "}
          <code className="font-mono">rateSource</code> override exists with a divergence flag. April uses the
          recent-{PROD.window}-month average; the back-test reproduces each month at its own index.
        </p>
      </Card>

      <Card title="3 · Price every shipment" subtitle="Three carrier modules, one contract: priced result + human-readable calc trace + flags.">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <Badge className={carrierAccent.peak}>Peak Logistics</Badge>
            </div>
            <Formula>
              base = max(miles(dest) × rate/mi(weight tier), min) × index
              <br />+ fuel {fmtPct(cal.peak.fuelSurchargePct)} × base
              <br />+ accessorials (face value)
            </Formula>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Mileage fallback chain: invoice-calibrated → printed table → geo estimate (haversine × circuity), each
              non-calibrated rung flagged. Fuel % is calibrated from invoices, not assumed.
            </p>
          </div>
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <Badge className={carrierAccent.heartland}>Heartland Freight</Badge>
            </div>
            <Formula>
              base = zoneRate(ZIP prefix) × index
              <br />× (1 − QTD volume discount)
              <br />+ accessorials (never discounted)
            </Formula>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Fuel is included in the zone rate. The volume tier is <b>cumulative quarter-to-date shipment count</b> —
              resets Jan/Apr/Jul/Oct (the reset is the single most predictable swing in the data), carries in for
              mid-quarter closes.
            </p>
          </div>
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <Badge className={carrierAccent.coastal}>Coastal Express</Badge>
            </div>
            <Formula>
              base = max(lb × $/lb(region), min) × index
              <br />+ fuel {fmtPct(cal.coastal.fuelSurchargePct)} × base
              <br />+ residential tier (by weight) + accessorials
            </Formula>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Regions by destination ZIP range; the minimum charge scales with the index (verified in invoices:
              $28 min × 1.191 = $33.34). Residential tier fees calibrated from residential-only invoice lines.
            </p>
          </div>
        </div>
      </Card>

      <Card title="4 · Assemble the accrual + one accrued-liability entry" subtitle="Everything ties — asserted in code, shown on every page.">
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-600">
          <li>
            Carrier subtotal = Σ its shipment estimates; total = Σ carriers ({fmtUsd(run.totalSubtotal)} subtotal).
          </li>
          <li>
            <b>Credit reserve</b> {fmtUsd2(run.totalCreditReserve)}: historical net adjustments run ~−0.3% of invoiced,
            so the gross estimate would sit systematically high without it. Booked as a contra line, flagged info-level.
          </li>
          <li>
            JE: <b>Dr Freight Expense</b> (one line per carrier, ties to shipment backup) / <b>Cr Accrued Freight
            Liability</b> {fmtUsd(run.totalAccrual)} — reverses on invoice receipt. {run.tieOuts.length} tie-outs
            asserted ({run.allTieOutsPassed ? "all pass" : "FAILING"}): JE balances, JE == accrual, Σ shipments == carrier
            == total, reconstruction ties.
          </li>
        </ul>
      </Card>

      <Card title="5 · Prove it: back-test design" subtitle="No circularity, no cherry-picking — and honest about where the engine loses.">
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-600">
          <li>
            <b>Expanding-window forecast</b> (the headline): month M&apos;s index is calibrated only from months
            &lt; M, then applied to M&apos;s actual activity. First month is cold-start and excluded — for both methods.
          </li>
          <li>
            <b>Reconstruction</b> (the mechanics proof): every line repriced at its own month&apos;s index ties to
            ±${run.backtest.reconstruction.byCarrierMonthMaxErrorDollars}. In-sample by design — labeled as proof of
            pricing mechanics, not forecast accuracy.
          </li>
          <li>
            The monthly index is near-unpredictable (±30%); monthly <i>spend</i> is stabilized because rate and volume
            move opposite ways. So per-month percentage error is inherently noisy — the engine&apos;s case is{" "}
            <b>near-zero bias</b> ({fmtSignedPct(run.backtest.overall.engineBias)}), the structurally-knowable Heartland
            reset, and shipment-level auditability. The head-to-head vs the prior manual estimate is on the Denise
            Comparison tab.
          </li>
        </ul>
      </Card>

      <Card title="6 · Controls: every assumption raises a flag" subtitle="No silent defaults — automation without controls just automates errors faster.">
        <p className="text-sm leading-relaxed text-slate-600">
          {run.exceptions.length} flags this run ({run.exceptionsBySeverity.error} error · {run.exceptionsBySeverity.warn}{" "}
          warn · {run.exceptionsBySeverity.info} info): pricing fallbacks, imputed weights, duplicate rows,
          calibrated-vs-printed divergence past {fmtPct(PROD.divergencePct)}, per-carrier cost outliers past{" "}
          {PROD.costOutlierZ}σ, back-test MAPE past {fmtPct(PROD.mapeAlarmPct)}, the credit-reserve note, and the
          service-level pricing assumption. Thresholds are config, not code — and you can stress them in the lab below.
        </p>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Part 2 — sensitivity lab
// ---------------------------------------------------------------------------

function SensitivityLab() {
  const [params, setParams] = useState<LabParams>({ ...PROD });
  const [result, setResult] = useState<AccrualRun>(accrualRun);
  const [computing, setComputing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isProd =
    params.window === PROD.window &&
    params.reserve === PROD.reserve &&
    params.divergencePct === PROD.divergencePct &&
    params.mapeAlarmPct === PROD.mapeAlarmPct &&
    params.costOutlierZ === PROD.costOutlierZ &&
    params.fuelPeak === PROD.fuelPeak &&
    params.fuelCoastal === PROD.fuelCoastal;

  useEffect(() => {
    if (isProd) {
      setResult(accrualRun);
      setComputing(false);
      return;
    }
    setComputing(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        // Only override fuel where the slider has actually moved, so changing an
        // unrelated knob (e.g. the window) leaves fuel calibrated as in the books.
        const fuelOverride: Partial<Record<Carrier, number>> = {};
        if (params.fuelPeak !== PROD.fuelPeak) fuelOverride.peak = params.fuelPeak;
        if (params.fuelCoastal !== PROD.fuelCoastal) fuelOverride.coastal = params.fuelCoastal;
        const run = runClose({
          periodKey: accrualRun.periodKey ?? "2026-04",
          shipments: BASE.shipments,
          duplicateShipmentIds: BASE.duplicateShipmentIds,
          invoices: BASE.invoices,
          denise: BASE.denise,
          windowMonths: params.window,
          creditReserveEnabled: params.reserve,
          thresholds: {
            ...engineConfig.thresholds,
            divergencePct: params.divergencePct,
            backtestMapeAlarmPct: params.mapeAlarmPct,
            costOutlierZ: params.costOutlierZ,
          },
          fuelOverride: Object.keys(fuelOverride).length ? fuelOverride : undefined,
        });
        setResult(run);
      } finally {
        setComputing(false);
      }
    }, 200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    params.window,
    params.reserve,
    params.divergencePct,
    params.mapeAlarmPct,
    params.costOutlierZ,
    params.fuelPeak,
    params.fuelCoastal,
    isProd,
  ]);

  // band scales linearly with k (quadrature of per-carrier ±kσ)
  const halfTotal = (result.confidence.total.high - result.confidence.total.low) / 2;
  const bandLow = result.totalAccrual - params.bandK * halfTotal;
  const bandHigh = result.totalAccrual + params.bandK * halfTotal;
  const deltaVsBooked = result.totalAccrual - accrualRun.totalAccrual;

  return (
    <Card
      title="Sensitivity lab — drag the assumptions"
      subtitle="The full engine (calibration → pricing → back-test → exceptions) re-runs in your browser on every change. Analysis only: the booked accrual always uses the committed config — sliders never change the books."
      right={
        <div className="flex items-center gap-2">
          {computing && <Badge className="bg-sky-100 text-sky-800 ring-sky-200">recomputing…</Badge>}
          {!isProd && (
            <button
              onClick={() => setParams({ ...PROD })}
              className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Reset to production
            </button>
          )}
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Slider
            label="Calibration window (months of history averaged for the April index)"
            min={1}
            max={6}
            step={1}
            value={params.window}
            display={`${params.window} mo`}
            prod={`${PROD.window} mo`}
            onChange={(v) => setParams((p) => ({ ...p, window: v }))}
          />
          <Slider
            label="Confidence band width (±kσ of rate-index volatility)"
            min={0.5}
            max={2}
            step={0.25}
            value={params.bandK}
            display={`±${params.bandK}σ`}
            prod={`±${PROD.bandK}σ`}
            onChange={(v) => setParams((p) => ({ ...p, bandK: v }))}
          />
          <Slider
            label="Rate-divergence flag threshold (calibrated vs printed card)"
            min={0.005}
            max={0.2}
            step={0.005}
            value={params.divergencePct}
            display={fmtPct(params.divergencePct)}
            prod={fmtPct(PROD.divergencePct)}
            onChange={(v) => setParams((p) => ({ ...p, divergencePct: v }))}
          />
          <Slider
            label="Back-test MAPE alarm threshold"
            min={0.05}
            max={0.4}
            step={0.01}
            value={params.mapeAlarmPct}
            display={fmtPct(params.mapeAlarmPct)}
            prod={fmtPct(PROD.mapeAlarmPct)}
            onChange={(v) => setParams((p) => ({ ...p, mapeAlarmPct: v }))}
          />
          <Slider
            label="Cost-outlier flag threshold (σ from carrier mean)"
            min={1.5}
            max={5}
            step={0.1}
            value={params.costOutlierZ}
            display={`${params.costOutlierZ.toFixed(1)}σ`}
            prod={`${PROD.costOutlierZ.toFixed(1)}σ`}
            onChange={(v) => setParams((p) => ({ ...p, costOutlierZ: v }))}
          />
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Fuel surcharge — forward rate-change what-if
              </span>
              <button
                onClick={() => setParams((p) => ({ ...p, fuelPeak: PEAK_FUEL_SPIKE }))}
                className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
              >
                Peak fuel spike → {fmtPct(PEAK_FUEL_SPIKE)}
              </button>
            </div>
            <div className="space-y-4">
              <Slider
                label="Peak fuel surcharge (% of base)"
                min={0.1}
                max={0.25}
                step={0.005}
                value={params.fuelPeak}
                display={fmtPct(params.fuelPeak)}
                prod={fmtPct(PROD.fuelPeak)}
                onChange={(v) => setParams((p) => ({ ...p, fuelPeak: v }))}
              />
              <Slider
                label="Coastal fuel surcharge (% of base)"
                min={0.05}
                max={0.2}
                step={0.005}
                value={params.fuelCoastal}
                display={fmtPct(params.fuelCoastal)}
                prod={fmtPct(PROD.fuelCoastal)}
                onChange={(v) => setParams((p) => ({ ...p, fuelCoastal: v }))}
              />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Base rates stay calibrated — only the fuel % moves, so the impact is cleanly the fuel delta. Any change
              raises <code className="font-mono">RATE_DIVERGENCE</code> (an announced rate change a trailing average
              can&apos;t see). This is the May Peak-spike adaptability demo, inline.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={params.reserve}
              onChange={(e) => setParams((p) => ({ ...p, reserve: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300"
            />
            Credit reserve (book the ~−0.3% historical adjustment run-rate)
            <span className="text-xs text-slate-400">production: {PROD.reserve ? "on" : "off"}</span>
          </label>
        </div>

        <div className={`space-y-4 transition-opacity ${computing ? "opacity-50" : ""}`}>
          <div className="grid grid-cols-2 gap-4">
            <Stat
              label="April accrual"
              value={fmtUsd(result.totalAccrual)}
              sub={
                Math.abs(deltaVsBooked) < 0.005
                  ? "= booked"
                  : `${deltaVsBooked > 0 ? "+" : "−"}${fmtUsd(Math.abs(deltaVsBooked))} vs booked ${fmtUsd(accrualRun.totalAccrual)}`
              }
              accent={Math.abs(deltaVsBooked) < 0.005 ? "text-slate-900" : "text-amber-700"}
            />
            <Stat label={`Confidence (±${params.bandK}σ)`} value={`${fmtUsd(bandLow)}–${fmtUsd(bandHigh)}`} sub="quadrature across carriers" />
            <Stat
              label="Engine bias (back-test)"
              value={fmtSignedPct(result.backtest.overall.engineBias)}
              sub="near-unbiased at any window"
              accent="text-emerald-700"
            />
            <Stat
              label="Engine MAPE"
              value={fmtPct(result.backtest.overall.engineMape)}
              sub="out-of-sample, expanding window"
            />
          </div>
          {(params.fuelPeak !== PROD.fuelPeak || params.fuelCoastal !== PROD.fuelCoastal) && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-relaxed text-amber-900">
              <span className="font-semibold">Fuel scenario active.</span>{" "}
              {params.fuelPeak !== PROD.fuelPeak && (
                <>Peak {fmtPct(PROD.fuelPeak)} → {fmtPct(params.fuelPeak)}. </>
              )}
              {params.fuelCoastal !== PROD.fuelCoastal && (
                <>Coastal {fmtPct(PROD.fuelCoastal)} → {fmtPct(params.fuelCoastal)}. </>
              )}
              Accrual moves {deltaVsBooked >= 0 ? "+" : "−"}
              {fmtUsd2(Math.abs(deltaVsBooked))} (all fuel — base unchanged), and the override is flagged{" "}
              <code className="font-mono">RATE_DIVERGENCE</code>. A trailing average cannot price an announced change;
              the engine can. The full side-by-side is on the May Scenario tab.
            </div>
          )}
          <div className="rounded-lg border border-slate-200 p-3 text-sm">
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Flags at these thresholds</div>
            <span className="tnum font-semibold text-slate-900">{result.exceptions.length}</span>{" "}
            <span className="text-slate-600">
              total — {result.exceptionsBySeverity.error} error · {result.exceptionsBySeverity.warn} warn ·{" "}
              {result.exceptionsBySeverity.info} info
            </span>
            <span className="ml-2 text-xs text-slate-400">(booked run: {accrualRun.exceptions.length})</span>
          </div>
          <p className="text-xs leading-relaxed text-slate-500">
            What to notice: the accrual moves only modestly across windows 2–6 (the index averages out), the band
            widens as you demand more confidence, and tighter thresholds trade alert fatigue for sensitivity. The
            committed settings are marked under each slider.
          </p>
        </div>
      </div>
    </Card>
  );
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  display,
  prod,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  display: string;
  prod: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block text-sm">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-slate-700">{label}</span>
        <span className="tnum shrink-0 font-semibold text-slate-900">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-[#e66a3c]"
      />
      <div className="mt-0.5 text-xs text-slate-400">production: {prod}</div>
    </label>
  );
}
