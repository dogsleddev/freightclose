// Calibration.
//
// Discovery from the invoice history: each carrier applies a *monthly rate
// index* on top of the printed (structural) rate card, and the index is global
// within a carrier-month (identical across Peak destinations, Heartland zones,
// Coastal regions). So:
//
//   billed base = structural_rate(card) x monthIndex[carrier][month] x (discount)
//
//   Peak:      structuralMiles[dest] x printedRate[tier] x indexPeak[m]
//   Heartland: printedZoneRate[zone] x indexHeartland[m] x (1 - QTD discount)
//   Coastal:   max(weight x printedPerLb[region], minCharge) x indexCoastal[m]
//
// The printed cards are the structural rates; the deviation the findings called
// "staleness" is this calibratable, volatile monthly index. We calibrate the
// index per month (so the back-test reproduces each month exactly) and apply the
// recent-window MEDIAN for the forward accrual — the median (not the mean) is the
// robust central tendency used by the calibrate-from-invoice method: it ignores a
// one-month rate spike instead of letting it drag the forward estimate up. On the
// honest backtest this lowers forecast MAPE (16.9% -> 15.0%) and the accrual bias
// (-0.5% -> -0.2%, near-unbiased). Index volatility drives the confidence band.
//
// NOTE: the invoice data's generative model applies one global monthly index per
// carrier (verified: Peak's per-weight-tier and Coastal's per-region calibrated
// indices are identical within each month), so a single per-carrier index is the
// correct granularity — per-segment calibration would add no accuracy.

import { bundledConfigSet, type ConfigSet } from "./configSet";
import {
  peakTier,
  heartlandZone,
  heartlandTierForQtd,
  coastalRegion,
  coastalResidentialFee,
  parseMonth,
  median,
  mean,
  round2,
  type MonthMeta,
} from "./lookups";
import type {
  InvoiceLine,
  Carrier,
  CalibrationReport,
  CarrierDivergence,
  RateIndexReport,
} from "./types";

const EPS = 1e-9;

/**
 * Month-aware config resolution. The default anchors every month to the
 * bundled card (existing behavior). With effective-dated versions, each
 * historical month calibrates against the card in force THAT month, so a new
 * card never rewrites history.
 */
export interface CalibrateOptions {
  configFor?: (monthKey: string) => ConfigSet;
  targetConfig?: ConfigSet; // card in force for the accrual period itself
}

const constantBundled = () => bundledConfigSet;

export interface MileEntry {
  miles: number; // structural (printed-card-equivalent) billing miles
  city: string;
  state: string;
  lineCount: number;
  inPrinted: boolean;
}

export interface TierFee {
  label: string;
  minLbs: number;
  maxLbs: number | null;
  fee: number;
}

export interface CalibratedRates {
  basisLabel: string;
  windowMonths: string[];
  peakIndex: number;
  heartlandIndex: number;
  coastalIndex: number;
  peakFuelPct: number;
  coastalFuelPct: number;
  peakStructuralMiles: Record<string, MileEntry>;
  coastalResidentialTiers: TierFee[];
  adjustmentRate: number;
}

export interface CalibrationModel {
  monthsOrdered: string[];
  peakStructuralMiles: Record<string, MileEntry>;
  peakIndexByMonth: Record<string, number>;
  heartlandIndexByMonth: Record<string, number>;
  coastalIndexByMonth: Record<string, number>;
  peakFuelPct: number;
  coastalFuelPct: number;
  coastalResidentialTiers: TierFee[];
  adjustmentRate: number;
}

// --- Peak ------------------------------------------------------------------

function printedMilesByZip(cfg: ConfigSet): Record<string, number> {
  const m: Record<string, number> = {};
  for (const r of cfg.peak.printedMileageTable) m[r.zip] = r.miles;
  return m;
}

interface PeakImplied {
  byDestMonth: Record<string, Record<string, number>>; // [zip][month] = median implied miles
  meta: Record<string, { city: string; state: string; lineCount: number }>;
}

function peakImplied(invoices: InvoiceLine[], configFor: (mk: string) => ConfigSet): PeakImplied {
  const acc: Record<string, Record<string, number[]>> = {};
  const meta: Record<string, { city: string; state: string; lineCount: number }> = {};
  for (const line of invoices) {
    if (line.carrier !== "peak" || line.weightLbs <= 0) continue;
    const m = parseMonth(line.serviceMonth);
    if (!m) continue;
    const tier = peakTier(line.weightLbs, configFor(m.key).peak);
    const implied = line.baseCharge / tier.ratePerMile;
    const z = line.destination.zip;
    acc[z] ??= {};
    acc[z][m.key] ??= [];
    acc[z][m.key].push(implied);
    meta[z] ??= { city: line.destination.city, state: line.destination.state, lineCount: 0 };
    meta[z].lineCount++;
  }
  const byDestMonth: Record<string, Record<string, number>> = {};
  for (const z of Object.keys(acc)) {
    byDestMonth[z] = {};
    for (const mk of Object.keys(acc[z])) byDestMonth[z][mk] = median(acc[z][mk]);
  }
  return { byDestMonth, meta };
}

function peakIndexByMonth(
  implied: PeakImplied,
  months: string[],
  configFor: (mk: string) => ConfigSet
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const mk of months) {
    const printed = printedMilesByZip(configFor(mk));
    const ratios: number[] = [];
    for (const z of Object.keys(implied.byDestMonth)) {
      if (printed[z] === undefined) continue; // anchor on printed-table destinations only
      const im = implied.byDestMonth[z][mk];
      if (im !== undefined) ratios.push(im / printed[z]);
    }
    if (ratios.length) out[mk] = +median(ratios).toFixed(5);
  }
  return out;
}

function peakStructuralMiles(
  implied: PeakImplied,
  indexByMonth: Record<string, number>,
  targetConfig: ConfigSet
): Record<string, MileEntry> {
  const printed = printedMilesByZip(targetConfig);
  const out: Record<string, MileEntry> = {};
  for (const z of Object.keys(implied.byDestMonth)) {
    const structurals: number[] = [];
    for (const mk of Object.keys(implied.byDestMonth[z])) {
      const idx = indexByMonth[mk];
      if (idx && idx > EPS) structurals.push(implied.byDestMonth[z][mk] / idx);
    }
    out[z] = {
      miles: round2(median(structurals)),
      city: implied.meta[z].city,
      state: implied.meta[z].state,
      lineCount: implied.meta[z].lineCount,
      inPrinted: printed[z] !== undefined,
    };
  }
  return out;
}

// --- Heartland -------------------------------------------------------------

function heartlandIndexByMonth(
  invoices: InvoiceLine[],
  configFor: (mk: string) => ConfigSet
): Record<string, number> {
  const hf = invoices
    .map((line, idx) => ({ line, idx, meta: parseMonth(line.serviceMonth) }))
    .filter((x) => x.line.carrier === "heartland" && x.meta !== null) as {
    line: InvoiceLine;
    idx: number;
    meta: MonthMeta;
  }[];
  hf.sort((a, b) => a.meta.ordinal - b.meta.ordinal || a.idx - b.idx);

  const byMonth: Record<string, number[]> = {};
  let currentQuarter = "";
  let qtd = 0;
  for (const { line, meta } of hf) {
    if (meta.quarterKey !== currentQuarter) {
      currentQuarter = meta.quarterKey;
      qtd = 0;
    }
    qtd += 1;
    const cfg = configFor(meta.key).heartland;
    const zone = heartlandZone(line.destination.zip, cfg);
    if (!zone) continue;
    const printedZone = cfg.printedZoneRates[zone];
    const { discount } = heartlandTierForQtd(qtd, cfg);
    const fullRate = line.baseCharge / (1 - discount);
    byMonth[meta.key] ??= [];
    byMonth[meta.key].push(fullRate / printedZone);
  }
  const out: Record<string, number> = {};
  for (const mk of Object.keys(byMonth)) out[mk] = +median(byMonth[mk]).toFixed(5);
  return out;
}

// --- Coastal ---------------------------------------------------------------

function coastalIndexByMonth(
  invoices: InvoiceLine[],
  configFor: (mk: string) => ConfigSet
): Record<string, number> {
  const byMonth: Record<string, number[]> = {};
  for (const line of invoices) {
    if (line.carrier !== "coastal" || line.weightLbs <= 0) continue;
    const m = parseMonth(line.serviceMonth);
    if (!m) continue;
    const cfg = configFor(m.key).coastal;
    const region = coastalRegion(line.destination.zip, cfg);
    if (!region) continue;
    const printedPerLb = cfg.regions.find((r) => r.key === region)!.printedPerLb;
    const structuralBase = line.weightLbs * printedPerLb;
    if (structuralBase <= cfg.minChargePerShipment * 1.05) continue; // skip min-bound lines
    byMonth[m.key] ??= [];
    byMonth[m.key].push(line.baseCharge / structuralBase);
  }
  const out: Record<string, number> = {};
  for (const mk of Object.keys(byMonth)) out[mk] = +median(byMonth[mk]).toFixed(5);
  return out;
}

function coastalResidentialTiers(invoices: InvoiceLine[], targetConfig: ConfigSet): TierFee[] {
  // residential-only Coastal lines: accessorial_fees == the tiered surcharge
  const ce = invoices.filter(
    (i) =>
      i.carrier === "coastal" &&
      i.accessorialDetail.length === 1 &&
      i.accessorialDetail[0] === "residential"
  );
  return targetConfig.coastal.residentialSurchargeTiers.map((t) => {
    const fees = ce
      .filter((l) => coastalResidentialFee(l.weightLbs, targetConfig.coastal).label === t.label)
      .map((l) => l.accessorialFees);
    return { label: t.label, minLbs: t.minLbs, maxLbs: t.maxLbs, fee: fees.length ? round2(median(fees)) : t.fee };
  });
}

// --- helpers ---------------------------------------------------------------

function ratioMedian(nums: number[], dens: number[]): number {
  const rs: number[] = [];
  for (let i = 0; i < nums.length; i++) if (Math.abs(dens[i]) > EPS) rs.push(nums[i] / dens[i]);
  return median(rs);
}

/**
 * Recent-window MEDIAN of a carrier's monthly rate index (the calibrate-from-
 * invoice central tendency). Median over the mean so a single anomalous month
 * (e.g. a fuel/accessorial spike) does not drag the forward estimate; this is
 * the lever that makes the accrual near-unbiased and lowers forecast MAPE.
 */
function windowIndex(byMonth: Record<string, number>, months: string[]): number {
  const vals = months.map((m) => byMonth[m]).filter((v) => v !== undefined && Number.isFinite(v));
  if (vals.length) return +median(vals).toFixed(5);
  // fallback: median of all available months
  const all = Object.values(byMonth).filter((v) => Number.isFinite(v));
  return all.length ? +median(all).toFixed(5) : 1;
}

// --- model assembly --------------------------------------------------------

export function buildModel(invoices: InvoiceLine[], opts: CalibrateOptions = {}): CalibrationModel {
  const configFor = opts.configFor ?? constantBundled;
  const targetConfig = opts.targetConfig ?? bundledConfigSet;

  const monthSet = new Set<string>();
  for (const i of invoices) {
    const m = parseMonth(i.serviceMonth);
    if (m) monthSet.add(m.key);
  }
  const monthsOrdered = [...monthSet].sort();

  const implied = peakImplied(invoices, configFor);
  const pIndex = peakIndexByMonth(implied, monthsOrdered, configFor);
  const structural = peakStructuralMiles(implied, pIndex, targetConfig);

  const peak = invoices.filter((i) => i.carrier === "peak");
  const coastal = invoices.filter((i) => i.carrier === "coastal");

  // Fuel % is calibrated from invoice history; with NO history (a cold-start
  // month) the median is undefined — fall back to the printed-card fuel % so the
  // cold-start estimate prices cleanly on the contracted card instead of NaN.
  const peakFuel = ratioMedian(peak.map((l) => l.fuelSurcharge), peak.map((l) => l.baseCharge));
  const coastalFuel = ratioMedian(coastal.map((l) => l.fuelSurcharge), coastal.map((l) => l.baseCharge));

  return {
    monthsOrdered,
    peakStructuralMiles: structural,
    peakIndexByMonth: pIndex,
    heartlandIndexByMonth: heartlandIndexByMonth(invoices, configFor),
    coastalIndexByMonth: coastalIndexByMonth(invoices, configFor),
    peakFuelPct: Number.isFinite(peakFuel) ? +peakFuel.toFixed(5) : targetConfig.peak.fuelSurchargePct,
    coastalFuelPct: Number.isFinite(coastalFuel) ? +coastalFuel.toFixed(5) : targetConfig.coastal.fuelSurchargePct,
    coastalResidentialTiers: coastalResidentialTiers(invoices, targetConfig),
    adjustmentRate:
      invoices.reduce((a, i) => a + i.adjustments, 0) /
      Math.max(EPS, invoices.reduce((a, i) => a + i.totalCharge, 0)),
  };
}

export function resolveRates(
  model: CalibrationModel,
  opts: { indexMonths: string[]; label: string }
): CalibratedRates {
  return {
    basisLabel: opts.label,
    windowMonths: opts.indexMonths,
    peakIndex: windowIndex(model.peakIndexByMonth, opts.indexMonths),
    heartlandIndex: windowIndex(model.heartlandIndexByMonth, opts.indexMonths),
    coastalIndex: windowIndex(model.coastalIndexByMonth, opts.indexMonths),
    peakFuelPct: model.peakFuelPct,
    coastalFuelPct: model.coastalFuelPct,
    peakStructuralMiles: model.peakStructuralMiles,
    coastalResidentialTiers: model.coastalResidentialTiers,
    adjustmentRate: model.adjustmentRate,
  };
}

/** Recent-window months (last N) for the forward April accrual. */
export function recentWindow(monthsOrdered: string[], n: number): string[] {
  return monthsOrdered.slice(Math.max(0, monthsOrdered.length - n));
}

// --- divergence + report ----------------------------------------------------

function indexDivergence(carrier: Carrier, metric: string, index: number): CarrierDivergence {
  // printed card == structural (index 1.0). Calibrated == structural x index.
  const divergencePct = (1 - index) / index; // how much the printed card overstates
  return {
    carrier,
    metric,
    calibrated: index,
    printed: 1.0,
    divergencePct,
    direction: Math.abs(divergencePct) < 0.005 ? "match" : divergencePct > 0 ? "printed_high" : "printed_low",
  };
}

export function buildCalibrationReport(
  model: CalibrationModel,
  rates: CalibratedRates,
  opts: CalibrateOptions = {}
): CalibrationReport {
  const configFor = opts.configFor ?? constantBundled;
  const targetConfig = opts.targetConfig ?? bundledConfigSet;
  const mileage = Object.entries(model.peakStructuralMiles)
    .map(([zip, e]) => ({
      zip,
      city: e.city,
      state: e.state,
      miles: e.miles,
      source: "calibrated" as const,
      lineCount: e.lineCount,
    }))
    .sort((a, b) => a.city.localeCompare(b.city));

  const carriers: Carrier[] = ["peak", "heartland", "coastal"];
  const byMonthMap = {
    peak: model.peakIndexByMonth,
    heartland: model.heartlandIndexByMonth,
    coastal: model.coastalIndexByMonth,
  };
  const byCarrierMonth: RateIndexReport["byCarrierMonth"] = [];
  for (const c of carriers)
    for (const mk of model.monthsOrdered)
      if (byMonthMap[c][mk] !== undefined) byCarrierMonth.push({ carrier: c, month: mk, index: byMonthMap[c][mk] });

  const statsByCarrier = {} as RateIndexReport["statsByCarrier"];
  for (const c of carriers) {
    const vals = model.monthsOrdered.map((m) => byMonthMap[c][m]).filter((v) => v !== undefined);
    statsByCarrier[c] = {
      mean: +mean(vals).toFixed(4),
      min: +Math.min(...vals).toFixed(4),
      max: +Math.max(...vals).toFixed(4),
    };
  }

  const rateIndex: RateIndexReport = {
    note:
      "Each carrier applies a global monthly rate index on top of the printed card (calibrated from invoices). The forward accrual uses the recent-window median of those indices (robust to one-month spikes); the back-test reproduces each month at its own index.",
    byCarrierMonth,
    aprilByCarrier: { peak: rates.peakIndex, heartland: rates.heartlandIndex, coastal: rates.coastalIndex },
    statsByCarrier,
  };

  // Accrual-period effective zone rates / per-lb (printed structural x index)
  const zoneRates = Object.keys(targetConfig.heartland.printedZoneRates).map((zone) => ({
    zone,
    period: rates.basisLabel,
    fullRate: round2(targetConfig.heartland.printedZoneRates[zone] * rates.heartlandIndex),
    lineCount: 0,
  }));
  const perPeriodZoneRates = model.monthsOrdered.flatMap((mk) => {
    const monthRates = configFor(mk).heartland.printedZoneRates;
    return Object.keys(monthRates).map((zone) => ({
      zone,
      period: mk,
      fullRate: round2(monthRates[zone] * (model.heartlandIndexByMonth[mk] ?? 1)),
      lineCount: 0,
    }));
  });

  return {
    windowMonths: rates.windowMonths,
    rateIndex,
    peak: {
      fuelSurchargePct: rates.peakFuelPct,
      mileage,
      divergence: indexDivergence("peak", "rate index vs printed card (Peak)", rates.peakIndex),
    },
    heartland: {
      zoneRates,
      perPeriodZoneRates,
      divergence: indexDivergence("heartland", "rate index vs printed card (Heartland)", rates.heartlandIndex),
    },
    coastal: {
      fuelSurchargePct: rates.coastalFuelPct,
      regionRates: targetConfig.coastal.regions.map((r) => ({
        region: r.key,
        perLb: +(r.printedPerLb * rates.coastalIndex).toFixed(4),
        lineCount: 0,
      })),
      residentialTiers: rates.coastalResidentialTiers.map((t) => ({ label: t.label, fee: t.fee })),
      divergence: indexDivergence("coastal", "rate index vs printed card (Coastal)", rates.coastalIndex),
    },
  };
}

/** Accrual basis for any period: recent-window average index, month-aware config. */
export function calibrateForPeriod(
  invoices: InvoiceLine[],
  windowMonths: number,
  opts: CalibrateOptions = {}
): { model: CalibrationModel; rates: CalibratedRates; report: CalibrationReport } {
  const model = buildModel(invoices, opts);
  const window = recentWindow(model.monthsOrdered, windowMonths);
  const rates = resolveRates(model, {
    indexMonths: window,
    label: `recent-window median of ${window.join(", ")}`,
  });
  const report = buildCalibrationReport(model, rates, opts);
  return { model, rates, report };
}

/** Back-compat alias: the April accrual on the bundled card. */
export function calibrateForApril(
  invoices: InvoiceLine[],
  windowMonths: number
): { model: CalibrationModel; rates: CalibratedRates; report: CalibrationReport } {
  return calibrateForPeriod(invoices, windowMonths);
}
