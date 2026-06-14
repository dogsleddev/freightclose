// Closed-period reconciliation (the three-way view's data layer).
//
// For each CLOSED month (Oct 2025–Mar 2026) we produce a deterministic
// reconciliation of three numbers:
//   engine  — what Freight Close WOULD have accrued at that close, calibrated
//             ONLY from prior months (leave-one-out: loadPeriod() returns the
//             strictly-earlier invoice history, so the month never prices itself);
//   actual  — the actual invoiced register for that month (its OWN invoices.csv,
//             net of adjustments), independent of Denise;
//   Denise  — her recorded accrual estimate (from that month's denise.csv).
// Plus the variance and a balanced TRUE-UP journal entry that books the
// estimate→actual delta. The Denise leg is isolated under `denise` so the
// neutral reconciliation surface stays Denise-free (quarantine).
//
// Pure + deterministic; build-time only (engine/run.ts emits the JSON).

import { loadPeriodsIndex, loadPeriod, loadPeriodOwn } from "./load";
import { runClose } from "./close";
import { buildHistoricalJournals } from "./history";
import { buildTrueUpJournalEntry } from "./je";
import { endOfMonthIso, round2 } from "./lookups";
import {
  CARRIERS,
  type Carrier,
  type ClosedPeriodReconciliation,
  type PeriodsIndexEntry,
} from "./types";

/** The emitted period index that drives UI navigation + badges. */
export function buildPeriodsIndex(): PeriodsIndexEntry[] {
  return loadPeriodsIndex().periods.map((p) => ({
    id: p.id,
    label: p.label,
    periodKey: p.period,
    status: p.status,
    source: p.source,
    badge: p.badge,
  }));
}

function pct(numer: number, denom: number): number {
  return denom ? round2((numer / denom) * 100) / 100 : 0;
}

/** One closed period's three-way reconciliation + true-up JE. */
function reconcilePeriod(periodId: string, isColdStart: boolean): ClosedPeriodReconciliation {
  const def = loadPeriodsIndex().periods.find((p) => p.id === periodId)!;
  const periodEndDate = endOfMonthIso(def.period);

  // 1) engine leg — full close on the period's reconstructed shipments, calibrated
  //    from prior months only (loadPeriod history is strictly < this period).
  const loaded = loadPeriod(periodId);
  const run = runClose({
    periodKey: loaded.periodKey,
    shipments: loaded.shipments,
    duplicateShipmentIds: loaded.duplicateShipmentIds,
    invoices: loaded.invoices,
    denise: loaded.denise,
    ingestExceptions: loaded.ingestExceptions,
  });
  const engineByCarrier = new Map<Carrier, number>();
  for (const cs of run.carrierSummaries) engineByCarrier.set(cs.carrier, cs.accrual);

  // 2) actual + Denise legs — this period's OWN invoices + denise.csv.
  const own = loadPeriodOwn(periodId);
  const hist = buildHistoricalJournals(own.invoices)[0]; // single month
  const actualByCarrier = new Map<Carrier, number>();
  for (const c of hist?.byCarrier ?? []) actualByCarrier.set(c.carrier, c.total);
  const deniseByCarrier = new Map<Carrier, number>();
  for (const d of own.denise) deniseByCarrier.set(d.carrier, d.accrualEstimate);
  const deniseActualByCarrier = new Map<Carrier, number>();
  for (const d of own.denise) deniseActualByCarrier.set(d.carrier, d.actualInvoiced);

  // 3) per-carrier join (Denise-free) + the quarantined Denise three-way.
  const byCarrier = CARRIERS.map((carrier) => {
    const engine = round2(engineByCarrier.get(carrier) ?? 0);
    const actual = round2(actualByCarrier.get(carrier) ?? 0);
    const varianceDollars = round2(actual - engine);
    return { carrier, engine, actual, varianceDollars, variancePct: pct(varianceDollars, actual) };
  });
  const deniseRows = CARRIERS.map((carrier) => {
    const engine = round2(engineByCarrier.get(carrier) ?? 0);
    const actual = round2(actualByCarrier.get(carrier) ?? 0);
    const denise = round2(deniseByCarrier.get(carrier) ?? 0);
    return {
      carrier,
      engine,
      denise,
      actual,
      engineErrPct: pct(engine - actual, actual),
      deniseErrPct: pct(denise - actual, actual),
    };
  });

  const engineTotal = round2(byCarrier.reduce((a, c) => a + c.engine, 0));
  const actualTotal = round2(byCarrier.reduce((a, c) => a + c.actual, 0));
  const deniseTotal = round2(deniseRows.reduce((a, c) => a + c.denise, 0));
  const varianceDollars = round2(actualTotal - engineTotal);

  // CONTROL: the invoice register must tie to Denise's recorded actual_invoiced,
  // within her workbook rounding. Denise pre-rounds some carrier cells to whole
  // dollars (e.g. Jan Coastal 25,400 vs register 25,400.01), so the cross-source
  // reconciliation tolerates ~a dollar — tight enough to flag any real divergence.
  const deniseActualTotal = round2(CARRIERS.reduce((a, c) => a + (deniseActualByCarrier.get(c) ?? 0), 0));
  const actualsReconcileToDenise = Math.abs(actualTotal - deniseActualTotal) < 1.0;

  const trueUpJournal = buildTrueUpJournalEntry(
    byCarrier.map((c) => ({ carrier: c.carrier, engine: c.engine, actual: c.actual })),
    { periodLabel: def.label, periodEndDate }
  );

  return {
    periodId,
    periodKey: def.period,
    label: def.label,
    status: "closed",
    source: "real",
    badge: def.badge,
    isColdStart,
    engineTotal,
    actualTotal,
    varianceDollars,
    variancePct: pct(varianceDollars, actualTotal),
    byCarrier,
    trueUpJournal,
    actualsJournal: hist.journalEntry,
    actualsReconcileToDenise,
    denise: { totalDenise: deniseTotal, byCarrier: deniseRows },
  };
}

/** All closed-period reconciliations, in chronological order. */
export function buildClosedPeriods(): ClosedPeriodReconciliation[] {
  const closed = loadPeriodsIndex()
    .periods.filter((p) => p.status === "closed")
    .sort((a, b) => a.period.localeCompare(b.period));
  // The first closed month has no prior history → cold-start (printed-card index).
  return closed.map((p, i) => reconcilePeriod(p.id, i === 0));
}
