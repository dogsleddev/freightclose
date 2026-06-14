// runClose — the pure, period-aware close orchestrator.
//
// One function produces the complete AccrualRun for any period from typed
// inputs: parsed shipments for the period, the full invoice history available
// at close, the Denise baseline (may not cover new months), and the
// effective-dated rate-config versions. No filesystem, no wall clock, no env —
// it runs identically at build time (engine/run.ts) and in the browser
// (/close uploads). Determinism is the reproducibility guarantee: same inputs
// + same config version => byte-identical run.

import { engineConfig } from "./config";
import {
  BUNDLED_VERSION,
  configResolver,
  resolveConfigFor,
  type RateConfigVersion,
} from "./configSet";
import { calibrateForPeriod } from "./calibrate";
import { buildAccrual, tieOuts, type RawException } from "./accrue";
import { buildBackTest } from "./backtest";
import { buildExceptions } from "./exceptions";
import { buildJournalEntry } from "./je";
import {
  endOfMonthIso,
  mean,
  monthMetaFromKey,
  monthShortLabel,
  parseMonth,
  priorMonthsInQuarter,
  round2,
} from "./lookups";
import {
  CARRIERS,
  type AccrualRun,
  type Carrier,
  type DeniseBaseline,
  type InvoiceLine,
  type ParsedShipment,
  type RateSource,
  type TieOutResult,
} from "./types";

/** Bump when pricing/calibration logic changes (provenance for reproducibility). */
export const ENGINE_VERSION = "1.1.0";

export interface CloseInputs {
  periodKey: string; // "2026-05"
  shipments: ParsedShipment[];
  duplicateShipmentIds: string[];
  invoices: InvoiceLine[]; // full history available at this close
  denise: DeniseBaseline[];
  configVersions?: RateConfigVersion[];
  windowMonths?: number; // default: engine.json calibration window
  rateSource?: Record<Carrier, RateSource>; // default: engine.json
  /**
   * Heartland QTD carry-in for mid-quarter periods. If omitted it is derived
   * from invoice history for the prior in-quarter months; gaps are flagged,
   * never silently assumed.
   */
  qtdStartOverride?: { count: number; basis: string };
  /** Control thresholds; default = engine.json. Overridable for sensitivity analysis. */
  thresholds?: typeof engineConfig.thresholds;
  creditReserveEnabled?: boolean;
  /**
   * Ingest-time control exceptions (Finding 0): serialization normalization
   * notes + any calibration-join failures. Surfaced in the run's exceptions so
   * the close never silently degrades on messy date/month formats.
   */
  ingestExceptions?: RawException[];
  /** Scenario fuel-surcharge override (peak/coastal) for a known forward rate change (the May spike). */
  fuelOverride?: Partial<Record<Carrier, number>>;
}

function std(xs: number[]): number {
  if (xs.length < 2) return 0;
  const mu = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - mu) ** 2)));
}

/** Heartland QTD carry-in: explicit override > invoice-history count > 0 (flagged). */
function deriveQtdStart(
  periodKey: string,
  invoices: InvoiceLine[],
  override?: { count: number; basis: string }
): { count: number; basis: string; extraExceptions: RawException[] } {
  const meta = monthMetaFromKey(periodKey)!;
  const isQuarterStart = (meta.month - 1) % 3 === 0;
  if (isQuarterStart) {
    return {
      count: 0,
      basis: `quarter start (${monthShortLabel(meta.month)}-1 contractual volume-tier reset)`,
      extraExceptions: [],
    };
  }
  if (override) return { count: override.count, basis: override.basis, extraExceptions: [] };

  const priorMonths = priorMonthsInQuarter(periodKey);
  let count = 0;
  const gapMonths: string[] = [];
  for (const mk of priorMonths) {
    const lines = invoices.filter(
      (i) => i.carrier === "heartland" && parseMonth(i.serviceMonth)?.key === mk
    ).length;
    if (lines === 0) gapMonths.push(mk);
    count += lines;
  }
  const extraExceptions: RawException[] = [];
  if (gapMonths.length) {
    extraExceptions.push({
      carrier: "heartland",
      code: "QTD_CARRYOVER_ASSUMED",
      severity: "warn",
      message:
        `Heartland QTD carry-in derived from invoice history, but ${gapMonths.join(", ")} ` +
        `ha${gapMonths.length > 1 ? "ve" : "s"} no Heartland invoice lines. Carry-in of ${count} may understate the ` +
        `quarter-to-date count (volume discount would be understated, accrual conservative-high). ` +
        `Upload those months' invoices or supply the prior close's shipment count.`,
      detail: { gapMonths, derivedCount: count },
    });
  }
  return {
    count,
    basis: `invoice history for ${priorMonths.join(", ") || "(none)"}`,
    extraExceptions,
  };
}

export function runClose(inputs: CloseInputs): AccrualRun {
  const meta = monthMetaFromKey(inputs.periodKey);
  if (!meta) throw new Error(`Invalid period key '${inputs.periodKey}' (expected "YYYY-MM").`);
  const periodLabel = meta.raw;
  const periodEndDate = endOfMonthIso(inputs.periodKey);
  const windowMonths = inputs.windowMonths ?? engineConfig.calibration.recentWindowMonths;
  const rateSource = inputs.rateSource ?? engineConfig.rateSource;
  const versions = inputs.configVersions ?? [];
  const configFor = configResolver(versions);
  const activeVersion = resolveConfigFor(versions, inputs.periodKey);
  const targetConfig = activeVersion.set;

  const { shipments, duplicateShipmentIds, invoices, denise } = inputs;

  // 1) calibrate (month-aware cards) + 2) accrue on the period card
  const { model, rates, report } = calibrateForPeriod(invoices, windowMonths, {
    configFor,
    targetConfig,
  });
  const thresholds = inputs.thresholds ?? engineConfig.thresholds;
  const qtdStart = deriveQtdStart(inputs.periodKey, invoices, inputs.qtdStartOverride);
  const accrual = buildAccrual(shipments, rates, {
    cfg: targetConfig,
    rateSource,
    qtdStart: qtdStart.count > 0 ? { count: qtdStart.count, basis: qtdStart.basis } : undefined,
    creditReserveEnabled: inputs.creditReserveEnabled,
    fuelOverride: inputs.fuelOverride,
  });
  accrual.rawExceptions.push(...qtdStart.extraExceptions);
  if (inputs.ingestExceptions?.length) accrual.rawExceptions.push(...inputs.ingestExceptions);

  // 3) back-test
  const backtest = buildBackTest(invoices, denise, {
    windowMonths,
    mapeAlarmPct: thresholds.backtestMapeAlarmPct,
    configFor,
  });

  // 4) exceptions + back-fill estimate exceptionIds and summary counts
  const exc = buildExceptions({
    rawFromAccrual: accrual.rawExceptions,
    duplicateIds: duplicateShipmentIds,
    estimates: accrual.estimates,
    calibration: report,
    backtest,
    thresholds,
    creditReserveEnabled: inputs.creditReserveEnabled,
  });
  for (const e of accrual.estimates) e.exceptionIds = exc.byShipment.get(e.shipmentId) ?? [];
  for (const cs of accrual.carrierSummaries) {
    cs.backtestMape = backtest.byCarrier[cs.carrier].engineMape;
    cs.exceptionCount = accrual.estimates
      .filter((e) => e.carrier === cs.carrier)
      .reduce((a, e) => a + e.exceptionIds.length, 0);
  }

  // 4b) Denise's projection for this period (her trailing-3-month method).
  // Actuals come from her file where the month exists there, else from invoice
  // totals — same source, hers is just pre-rounded.
  const recent3 = model.monthsOrdered.slice(-3);
  const actualFor = (c: Carrier, mk: string): number | null => {
    const d = denise.find((x) => x.carrier === c && parseMonth(x.month)?.key === mk);
    if (d) return d.actualInvoiced;
    const lines = invoices.filter((i) => i.carrier === c && parseMonth(i.serviceMonth)?.key === mk);
    if (!lines.length) return null;
    return round2(lines.reduce((a, l) => a + l.totalCharge, 0));
  };
  const deniseByCarrier = CARRIERS.map((c) => {
    const vals = recent3.map((mk) => actualFor(c, mk)).filter((v): v is number => v !== null);
    const deniseVal = round2(vals.length ? mean(vals) : 0);
    const fc = accrual.carrierSummaries.find((s) => s.carrier === c)!.accrual;
    return { carrier: c, freightClose: fc, denise: deniseVal, delta: round2(fc - deniseVal) };
  });
  const windowMeta = recent3.map((mk) => monthMetaFromKey(mk)!);
  const sameYear = windowMeta.every((w) => w.year === windowMeta[windowMeta.length - 1]?.year);
  const rangeLabel = windowMeta.length
    ? `${monthShortLabel(windowMeta[0].month)}${sameYear ? "" : ` ${windowMeta[0].year}`}–${monthShortLabel(windowMeta[windowMeta.length - 1].month)} ${windowMeta[windowMeta.length - 1].year}`
    : "n/a";
  const monthName = periodLabel.split(" ")[0];
  const isQuarterStart = (meta.month - 1) % 3 === 0;
  const resetClause = isQuarterStart
    ? ` or the ${monthShortLabel(meta.month)}-1 Heartland volume-tier reset`
    : "";
  const deniseApril = {
    note: `Denise's method applied to ${monthName}: trailing 3-month average of actual invoiced (${rangeLabel}) per carrier. She has no ${monthName} activity input, so her estimate cannot reflect ${monthName}'s shipment mix${resetClause}.`,
    byCarrier: deniseByCarrier,
    totalFreightClose: round2(deniseByCarrier.reduce((a, b) => a + b.freightClose, 0)),
    totalDenise: round2(deniseByCarrier.reduce((a, b) => a + b.denise, 0)),
  };

  // 5) JE
  const journalEntry = buildJournalEntry(accrual.carrierSummaries, accrual.totalAccrual, {
    periodLabel,
    periodEndDate,
  });

  // 6) confidence band from monthly rate-index volatility (±1σ, quadrature)
  const idxByCarrier: Record<Carrier, Record<string, number>> = {
    peak: model.peakIndexByMonth,
    heartland: model.heartlandIndexByMonth,
    coastal: model.coastalIndexByMonth,
  };
  const bandByCarrier = accrual.carrierSummaries.map((cs) => {
    const series = Object.values(idxByCarrier[cs.carrier]);
    const cv = mean(series) > 0 ? std(series) / mean(series) : 0;
    const swing = Math.abs(cs.accrual) * cv;
    return {
      carrier: cs.carrier,
      accrual: cs.accrual,
      cvPct: round2(cv * 100),
      low: round2(cs.accrual - swing),
      high: round2(cs.accrual + swing),
    };
  });
  const totalSwing = Math.sqrt(
    bandByCarrier.reduce((a, b) => a + ((b.high - b.low) / 2) ** 2, 0)
  );
  const confidence = {
    note: "±1σ from the historical volatility of each carrier's monthly rate index (carriers combined in quadrature, assumed independent). The point accrual is the recent-window central estimate.",
    byCarrier: bandByCarrier,
    total: {
      low: round2(accrual.totalAccrual - totalSwing),
      high: round2(accrual.totalAccrual + totalSwing),
    },
  };

  // 7) tie-outs (controls)
  const tos: TieOutResult[] = [...tieOuts(accrual)];
  tos.push({
    name: "Journal entry balances (Σ debits == Σ credits)",
    expected: journalEntry.totalDebits,
    actual: journalEntry.totalCredits,
    passed: journalEntry.balanced,
    toleranceUsd: 0.01,
  });
  tos.push({
    name: "JE total debits == total accrual",
    expected: accrual.totalAccrual,
    actual: journalEntry.totalDebits,
    passed: Math.abs(accrual.totalAccrual - journalEntry.totalDebits) < 0.01,
    toleranceUsd: 0.01,
  });
  tos.push({
    name: "Back-test reconstruction ties to actual invoices",
    expected: 0,
    actual: backtest.reconstruction.byCarrierMonthMaxErrorDollars,
    passed: backtest.reconstruction.tiedToActual,
    toleranceUsd: 2.0,
  });
  const allTieOutsPassed = tos.every((t) => t.passed);

  const lastMonth = model.monthsOrdered[model.monthsOrdered.length - 1];
  const invoicesThrough =
    invoices.map((i) => i.serviceMonth).find((m) => parseMonth(m)?.key === lastMonth) ?? lastMonth;

  const usingBundledOnly = versions.length === 0;
  return {
    generatedAtNote: usingBundledOnly
      ? "Deterministic engine output. Every figure derives only from the bundled CSVs + /config; no wall-clock value is baked into any number."
      : "Deterministic engine output. Every figure derives only from the provided CSVs + the rate-config version in force for each month; no wall-clock value is baked into any number.",
    period: periodLabel,
    periodKey: inputs.periodKey,
    periodEndDate,
    framework: engineConfig.accounting.framework,
    provenance: {
      engineVersion: ENGINE_VERSION,
      configVersionId: activeVersion.id,
      configEffectiveFrom: activeVersion.effectiveFrom,
      rateSource,
      ...(qtdStart.count > 0 ? { qtdStart: { count: qtdStart.count, basis: qtdStart.basis } } : {}),
    },
    inputs: {
      shipmentRows: shipments.length,
      uniqueShipments: accrual.estimates.length,
      invoiceLines: invoices.length,
      invoicesThrough,
    },
    rateSource,
    calibration: report,
    shipmentEstimates: accrual.estimates,
    carrierSummaries: accrual.carrierSummaries,
    totalSubtotal: accrual.totalSubtotal,
    totalCreditReserve: accrual.totalCreditReserve,
    totalAccrual: accrual.totalAccrual,
    confidence,
    deniseApril,
    journalEntry,
    exceptions: exc.exceptions,
    exceptionsBySeverity: exc.bySeverity,
    backtest,
    tieOuts: tos,
    allTieOutsPassed,
  };
}

/** Shipment-level backup CSV for a run (download mirror of the JE's support). */
export function shipmentBackupCsv(run: AccrualRun): string {
  const header = [
    "shipment_id", "carrier", "date", "destination_city", "destination_state", "destination_zip",
    "service_level", "weight_lbs", "units", "residential", "classification",
    "base", "fuel", "accessorials", "residential_surcharge", "min_charge_applied", "total", "exceptions",
  ];
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const rows = [header.join(",")];
  for (const e of run.shipmentEstimates) {
    rows.push(
      [
        e.shipmentId, e.carrier, e.date, e.destination.city, e.destination.state, e.destination.zip,
        e.serviceLevel, e.weightLbs ?? "", e.units, e.residential,
        JSON.stringify(e.classification),
        e.baseCharge.toFixed(2), e.fuelSurcharge.toFixed(2), e.accessorialTotal.toFixed(2),
        e.residentialSurcharge.toFixed(2), e.minChargeApplied, e.total.toFixed(2), e.exceptionIds.join(" "),
      ]
        .map((c) => esc(String(c)))
        .join(",")
    );
  }
  return rows.join("\n") + "\n";
}

export { BUNDLED_VERSION };
