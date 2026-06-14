// May 2026 — synthetic adaptability scenario.
//
// The SAME 160 synthetic May shipments are priced under two rate environments:
//   no-change  — rates calibrated from invoice history (Peak fuel ~14%);
//   fuel-spike — the carrier announces Peak fuel surcharge 14% → 19% effective
//                May, applied via the scenario fuel override (base stays
//                calibrated; only the fuel % moves), with a divergence flag.
// Each variant is reconciled against its simulated actual invoices and gets a
// balanced true-up JE. This is the adaptability proof a trailing average can't
// match — it is blind to an announced forward rate change. Synthetic + badged;
// never mixed with the real periods. Pure + deterministic (build-time only).

import { loadPeriodsIndex, loadPeriod, loadActualsFile } from "./load";
import { runClose, type CloseInputs } from "./close";
import { buildTrueUpJournalEntry } from "./je";
import { endOfMonthIso, round2 } from "./lookups";
import {
  CARRIERS,
  type Carrier,
  type InvoiceLine,
  type AccrualRun,
  type MayScenario,
  type MayVariant,
} from "./types";

// The announced Peak fuel surcharge for the spike variant. Provenance:
// data/2605/rate-cards-fuelspike (Peak FSC 19%) + data/2605/README.md (14%→19%).
const MAY_FUELSPIKE_PEAK_FSC = 0.19;

function pct(numer: number, denom: number): number {
  return denom ? round2((numer / denom) * 100) / 100 : 0;
}

function actualByCarrier(invoices: InvoiceLine[]): Map<Carrier, number> {
  const m = new Map<Carrier, number>(CARRIERS.map((c) => [c, 0]));
  for (const i of invoices) m.set(i.carrier, (m.get(i.carrier) ?? 0) + i.totalCharge);
  for (const c of CARRIERS) m.set(c, round2(m.get(c) ?? 0));
  return m;
}

function buildVariant(
  key: MayVariant["key"],
  title: string,
  isScenarioOverride: boolean,
  peakFuelPct: number,
  run: AccrualRun,
  actuals: InvoiceLine[],
  divergenceNote: string | null,
  label: string,
  periodEndDate: string
): MayVariant {
  const engineByCarrier = new Map(run.carrierSummaries.map((cs) => [cs.carrier, cs.accrual] as const));
  const actualMap = actualByCarrier(actuals);

  const byCarrier = CARRIERS.map((carrier) => {
    const engine = round2(engineByCarrier.get(carrier) ?? 0);
    const actual = round2(actualMap.get(carrier) ?? 0);
    const varianceDollars = round2(actual - engine);
    return { carrier, engine, actual, varianceDollars, variancePct: pct(varianceDollars, actual) };
  });
  const engineTotal = round2(byCarrier.reduce((a, c) => a + c.engine, 0));
  const actualTotal = round2(byCarrier.reduce((a, c) => a + c.actual, 0));
  const varianceDollars = round2(actualTotal - engineTotal);

  const trueUpJournal = buildTrueUpJournalEntry(
    byCarrier.map((c) => ({ carrier: c.carrier, engine: c.engine, actual: c.actual })),
    { periodLabel: `${label} — ${title}`, periodEndDate }
  );

  return {
    key,
    title,
    isScenarioOverride,
    peakFuelPct: round2(peakFuelPct * 10000) / 10000,
    engineTotal,
    actualTotal,
    varianceDollars,
    variancePct: pct(varianceDollars, actualTotal),
    byCarrier,
    trueUpJournal,
    divergenceNote,
  };
}

export function buildMayScenario(): MayScenario {
  const def = loadPeriodsIndex().periods.find((p) => p.id === "2605");
  if (!def) throw new Error("May period (2605) not found in periods.json.");
  if (!def.files.actuals?.length) throw new Error("May period has no actuals files.");
  const periodEndDate = endOfMonthIso(def.period);

  const loaded = loadPeriod("2605");
  const baseInputs: CloseInputs = {
    periodKey: loaded.periodKey,
    shipments: loaded.shipments,
    duplicateShipmentIds: loaded.duplicateShipmentIds,
    invoices: loaded.invoices,
    denise: loaded.denise,
    ingestExceptions: loaded.ingestExceptions,
  };

  // no-change: calibrated rates (Peak fuel ~14% from history)
  const runNc = runClose(baseInputs);
  const calibratedPeakFuelPct = runNc.calibration.peak.fuelSurchargePct;

  // fuel-spike: scenario override raises Peak fuel to 19%, base stays calibrated
  const runFs = runClose({ ...baseInputs, fuelOverride: { peak: MAY_FUELSPIKE_PEAK_FSC } });
  const divergence = runFs.exceptions.find(
    (e) => e.code === "RATE_DIVERGENCE" && e.carrier === "peak" && e.detail?.scenario === true
  );

  const ncFile = def.files.actuals.find((f) => /nochange/i.test(f));
  const fsFile = def.files.actuals.find((f) => /fuelspike/i.test(f));
  if (!ncFile || !fsFile) throw new Error("May actuals files (nochange/fuelspike) not found in periods.json.");
  const actualsNc = loadActualsFile(ncFile);
  const actualsFs = loadActualsFile(fsFile);

  const vNc = buildVariant("nochange", "No change (Peak fuel 14%)", false, calibratedPeakFuelPct, runNc, actualsNc, null, def.label, periodEndDate);
  const vFs = buildVariant("fuelspike", "Peak fuel surcharge spike (14% → 19%)", true, MAY_FUELSPIKE_PEAK_FSC, runFs, actualsFs, divergence?.message ?? null, def.label, periodEndDate);

  return {
    periodId: def.id,
    periodKey: def.period,
    label: def.label,
    status: "simulated",
    source: "synthetic",
    badge: def.badge,
    shipmentCount: loaded.shipments.filter((s) => !s.isDuplicate).length,
    calibratedPeakFuelPct: round2(calibratedPeakFuelPct * 10000) / 10000,
    scenarioPeakFuelPct: MAY_FUELSPIKE_PEAK_FSC,
    variants: [vNc, vFs],
    engineSpikeUplift: round2(vFs.engineTotal - vNc.engineTotal),
    actualSpikeDelta: round2(vFs.actualTotal - vNc.actualTotal),
    blindUnderAccrual: round2(vFs.actualTotal - vNc.engineTotal),
  };
}
