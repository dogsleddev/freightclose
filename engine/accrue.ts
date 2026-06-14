// Accrual assembly: price every (non-duplicate) shipment in the close period,
// sequence Heartland quarter-to-date (reset at quarter starts, carried in for
// mid-quarter months), impute missing weights where they bite, roll up to
// carrier summaries, apply the credit reserve, and assert tie-outs.

import { carrierConfig, engineConfig } from "./config";
import { bundledConfigSet, type ConfigSet } from "./configSet";
import { normalizeCarrier } from "./parse";
import { median, round2 } from "./lookups";
import type { CalibratedRates } from "./calibrate";
import { pricePeak } from "./price/peak";
import { priceHeartland } from "./price/heartland";
import { priceCoastal } from "./price/coastal";
import type { PricingInput, PricedResult, LocalException } from "./price/shared";
import {
  type Carrier,
  CARRIERS,
  type ParsedShipment,
  type RateSource,
  type ShipmentEstimate,
  type CarrierSummary,
  type ExceptionCode,
  type ExceptionSeverity,
  type TieOutResult,
} from "./types";

export interface RawException {
  carrier?: Carrier;
  shipmentId?: string;
  code: ExceptionCode;
  severity: ExceptionSeverity;
  message: string;
  detail?: Record<string, unknown>;
}

export interface AccrualResult {
  estimates: ShipmentEstimate[];
  carrierSummaries: CarrierSummary[];
  totalSubtotal: number;
  totalCreditReserve: number;
  totalAccrual: number;
  rawExceptions: RawException[];
}

function medianLbsPerUnit(shipments: ParsedShipment[], carrier: Carrier): number {
  const vals = shipments
    .filter((s) => s.carrier === carrier && s.weightLbs && s.units > 0)
    .map((s) => (s.weightLbs as number) / s.units);
  const m = median(vals);
  return Number.isFinite(m) && m > 0 ? m : 20;
}

export interface AccrualOptions {
  /** Rate card in force for the close period. Default: bundled /config. */
  cfg?: ConfigSet;
  /** Heartland QTD carry-in for mid-quarter months (count of shipments earlier in the quarter). */
  qtdStart?: { count: number; basis: string };
  /** Per-carrier rate source. printed_override prices index=1.0 on the period card and flags it. */
  rateSource?: Record<Carrier, RateSource>;
  creditReserveEnabled?: boolean;
  /**
   * Scenario fuel-surcharge override (peak/coastal): a KNOWN forward rate change
   * not yet in invoice history (e.g. the May Peak fuel spike 14%→19%). Applies
   * the announced fuel % over the calibrated one and raises a divergence flag —
   * the adaptability a trailing average structurally lacks. Base rates stay
   * calibrated, so the impact is cleanly the fuel delta.
   */
  fuelOverride?: Partial<Record<Carrier, number>>;
}

export function buildAccrual(
  shipments: ParsedShipment[],
  rates: CalibratedRates,
  opts: AccrualOptions = {}
): AccrualResult {
  const cfg = opts.cfg ?? bundledConfigSet;
  const rateSource = opts.rateSource ?? engineConfig.rateSource;
  const rawExceptions: RawException[] = [];
  const active = shipments.filter((s) => !s.isDuplicate);

  // printed_override: price that carrier at index 1.0 (the period card itself)
  // and flag the calibrated index being set aside — never a silent switch.
  const indexKey = { peak: "peakIndex", heartland: "heartlandIndex", coastal: "coastalIndex" } as const;
  let effRates = rates;
  for (const c of CARRIERS) {
    if (rateSource[c] !== "printed_override") continue;
    const calibrated = rates[indexKey[c]];
    effRates = { ...effRates, [indexKey[c]]: 1 };
    rawExceptions.push({
      carrier: c,
      code: "RATE_DIVERGENCE",
      severity: "warn",
      message: `${carrierConfig[c].displayName}: rateSource=printed_override — priced on the printed card (index 1.0), setting aside the calibrated index ${calibrated} (${((1 - calibrated) / calibrated * 100).toFixed(1)}% divergence).`,
      detail: { calibratedIndex: calibrated, overrideIndex: 1 },
    });
  }

  // Scenario fuel-surcharge override (a known forward rate change). Keeps base
  // rates calibrated and replaces only the fuel %, flagging the divergence from
  // the history-calibrated rate so the override is never silent.
  const fuelOverride = opts.fuelOverride ?? {};
  const fuelKey = { peak: "peakFuelPct", coastal: "coastalFuelPct" } as const;
  for (const c of ["peak", "coastal"] as const) {
    const override = fuelOverride[c];
    const calibrated = effRates[fuelKey[c]];
    if (override === undefined || Math.abs(override - calibrated) < 1e-9) continue;
    effRates = { ...effRates, [fuelKey[c]]: override };
    rawExceptions.push({
      carrier: c,
      code: "RATE_DIVERGENCE",
      severity: "warn",
      message: `${carrierConfig[c].displayName}: fuel surcharge overridden to ${(override * 100).toFixed(1)}% for this scenario (announced forward rate change) vs ${(calibrated * 100).toFixed(1)}% calibrated from invoice history (${(((override - calibrated) / calibrated) * 100).toFixed(1)}% divergence). A trailing average cannot incorporate an announced change; the engine prices it and flags the override.`,
      detail: { overrideFuelPct: override, calibratedFuelPct: calibrated, scenario: true },
    });
  }

  // weight imputation factors
  const lbsPerUnit: Record<Carrier, number> = {
    peak: medianLbsPerUnit(shipments, "peak"),
    heartland: medianLbsPerUnit(shipments, "heartland"),
    coastal: medianLbsPerUnit(shipments, "coastal"),
  };

  // Heartland QTD sequence ordered by date then id. Quarter-start months begin
  // at 1; mid-quarter months carry in the prior in-quarter count (qtdStart).
  const qtdOffset = opts.qtdStart?.count ?? 0;
  const hfOrder = active
    .filter((s) => s.carrier === "heartland")
    .sort((a, b) => a.date.localeCompare(b.date) || a.shipmentId.localeCompare(b.shipmentId));
  const qtdByShipment = new Map<string, number>();
  hfOrder.forEach((s, i) => qtdByShipment.set(s.shipmentId, qtdOffset + i + 1));
  if (qtdOffset > 0) {
    rawExceptions.push({
      carrier: "heartland",
      code: "QTD_CARRYOVER",
      severity: "info",
      message: `Heartland volume tier starts at QTD ${qtdOffset + 1} this period (carry-in of ${qtdOffset} shipments earlier in the quarter; basis: ${opts.qtdStart?.basis ?? "caller"}).`,
      detail: { qtdStart: qtdOffset, basis: opts.qtdStart?.basis },
    });
  }

  const estimates: ShipmentEstimate[] = [];

  for (const s of active) {
    // carrier sanity (post-normalization guard)
    if (normalizeCarrier(s.carrierRaw) === null) {
      rawExceptions.push({
        shipmentId: s.shipmentId,
        code: "UNKNOWN_CARRIER",
        severity: "error",
        message: `Carrier '${s.carrierRaw}' did not normalize to a known carrier.`,
        detail: { raw: s.carrierRaw },
      });
    }

    // resolve weight (impute where it affects price)
    let weight = s.weightLbs;
    let imputed = false;
    if (weight === null) {
      if (s.carrier === "heartland") {
        // flat zone rate: weight does not affect price
        rawExceptions.push({
          carrier: s.carrier,
          shipmentId: s.shipmentId,
          code: "MISSING_WEIGHT",
          severity: "info",
          message: "Missing weight; no price impact (Heartland prices a flat zone rate).",
        });
        weight = 0;
      } else {
        weight = round2(s.units * lbsPerUnit[s.carrier]);
        imputed = true;
        rawExceptions.push({
          carrier: s.carrier,
          shipmentId: s.shipmentId,
          code: "IMPUTED_WEIGHT",
          severity: "warn",
          message: `Missing weight imputed as ${weight} lb (${s.units} units x ${round2(lbsPerUnit[s.carrier])} lb/unit median).`,
          detail: { units: s.units, weightLbs: weight },
        });
      }
    }

    const input: PricingInput = {
      id: s.shipmentId,
      date: s.date,
      origin: s.origin,
      destination: s.destination,
      weightLbs: weight ?? 0,
      residential: s.residential,
      accessorials: s.accessorials,
    };

    let priced: PricedResult;
    if (s.carrier === "peak") priced = pricePeak(input, effRates, cfg.peak);
    else if (s.carrier === "coastal") priced = priceCoastal(input, effRates, cfg.coastal);
    else priced = priceHeartland(input, effRates, { qtdIndex: qtdByShipment.get(s.shipmentId) ?? 1 }, cfg.heartland);

    for (const e of priced.exceptions)
      rawExceptions.push({ carrier: s.carrier, shipmentId: s.shipmentId, ...e });

    estimates.push({
      shipmentId: s.shipmentId,
      carrier: s.carrier,
      date: s.date,
      origin: s.origin,
      destination: s.destination,
      serviceLevel: s.serviceLevel,
      weightLbs: s.weightLbs,
      units: s.units,
      residential: s.residential,
      classification: { ...priced.classification, ...(imputed ? { weightImputed: true } : {}) },
      baseCharge: priced.baseCharge,
      fuelSurcharge: priced.fuelSurcharge,
      accessorials: priced.accessorials,
      accessorialTotal: priced.accessorialTotal,
      residentialSurcharge: priced.residentialSurcharge,
      minChargeApplied: priced.minChargeApplied,
      total: priced.total,
      rateSource: rateSource[s.carrier],
      calcTrace: priced.calcTrace,
      exceptionIds: [],
    });
  }

  // carrier summaries
  const reserveEnabled = opts.creditReserveEnabled ?? engineConfig.calibration.creditReserve.enabled;
  const carrierSummaries: CarrierSummary[] = CARRIERS.map((c) => {
    const rows = estimates.filter((e) => e.carrier === c);
    const sum = (f: (e: ShipmentEstimate) => number) => round2(rows.reduce((a, e) => a + f(e), 0));
    const subtotal = sum((e) => e.total);
    const creditReserve = reserveEnabled ? round2(subtotal * rates.adjustmentRate) : 0;
    return {
      carrier: c,
      shipmentCount: rows.length,
      base: sum((e) => e.baseCharge),
      fuel: sum((e) => e.fuelSurcharge),
      accessorials: sum((e) => e.accessorialTotal),
      residential: sum((e) => e.residentialSurcharge),
      subtotal,
      creditReserve,
      accrual: round2(subtotal + creditReserve),
      backtestMape: null,
      exceptionCount: 0,
    };
  });

  const totalSubtotal = round2(carrierSummaries.reduce((a, s) => a + s.subtotal, 0));
  const totalCreditReserve = round2(carrierSummaries.reduce((a, s) => a + s.creditReserve, 0));
  const totalAccrual = round2(totalSubtotal + totalCreditReserve);

  return { estimates, carrierSummaries, totalSubtotal, totalCreditReserve, totalAccrual, rawExceptions };
}

// --- tie-out controls ------------------------------------------------------

export function tieOuts(result: AccrualResult): TieOutResult[] {
  const tol = 0.01;
  const out: TieOutResult[] = [];

  for (const cs of result.carrierSummaries) {
    const sumShip = round2(
      result.estimates.filter((e) => e.carrier === cs.carrier).reduce((a, e) => a + e.total, 0)
    );
    out.push({
      name: `${carrierConfig[cs.carrier].displayName}: Σ shipment totals == carrier subtotal`,
      expected: cs.subtotal,
      actual: sumShip,
      passed: Math.abs(cs.subtotal - sumShip) <= tol,
      toleranceUsd: tol,
    });
  }

  const sumSubtotals = round2(result.carrierSummaries.reduce((a, s) => a + s.subtotal, 0));
  out.push({
    name: "Σ carrier subtotals == total subtotal",
    expected: result.totalSubtotal,
    actual: sumSubtotals,
    passed: Math.abs(result.totalSubtotal - sumSubtotals) <= tol,
    toleranceUsd: tol,
  });

  const sumAccruals = round2(result.carrierSummaries.reduce((a, s) => a + s.accrual, 0));
  out.push({
    name: "Σ carrier accruals == total accrual (incl. credit reserve)",
    expected: result.totalAccrual,
    actual: sumAccruals,
    passed: Math.abs(result.totalAccrual - sumAccruals) <= tol,
    toleranceUsd: tol,
  });

  return out;
}
