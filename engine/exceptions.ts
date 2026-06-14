// Exception + controls engine. Collects every flag the run produced (pricing
// fallbacks, data-quality issues) and adds the run-level controls: duplicate
// shipments, calibrated-vs-printed rate divergence, per-shipment cost outliers,
// back-test MAPE alarms, the adjustment-reserve note, and the service-level
// price assumption. Assigns stable IDs and back-fills each shipment estimate.

import { engineConfig, carrierConfig } from "./config";
import { mean } from "./lookups";
import type { RawException } from "./accrue";
import type {
  Carrier,
  ShipmentEstimate,
  CalibrationReport,
  BackTestReport,
  ExceptionRecord,
  ExceptionSeverity,
} from "./types";

export interface ExceptionsResult {
  exceptions: ExceptionRecord[];
  bySeverity: Record<ExceptionSeverity, number>;
  byShipment: Map<string, string[]>;
}

export function buildExceptions(args: {
  rawFromAccrual: RawException[];
  duplicateIds: string[];
  estimates: ShipmentEstimate[];
  calibration: CalibrationReport;
  backtest: BackTestReport;
  /** Control thresholds; default = engine.json. Overridable for sensitivity analysis. */
  thresholds?: typeof engineConfig.thresholds;
  creditReserveEnabled?: boolean;
}): ExceptionsResult {
  const { rawFromAccrual, duplicateIds, estimates, calibration, backtest } = args;
  const th = args.thresholds ?? engineConfig.thresholds;
  const reserveEnabled = args.creditReserveEnabled ?? engineConfig.calibration.creditReserve.enabled;
  const out: ExceptionRecord[] = [];
  let seq = 0;
  const nextId = () => `EXC-${String(++seq).padStart(4, "0")}`;

  const push = (e: Omit<ExceptionRecord, "id">) => {
    out.push({ id: nextId(), ...e });
  };

  // 1) per-shipment exceptions surfaced during pricing / accrual
  for (const e of rawFromAccrual) {
    push({
      code: e.code,
      severity: e.severity,
      carrier: e.carrier,
      shipmentId: e.shipmentId,
      message: e.message,
      detail: e.detail,
    });
  }

  // 2) duplicate shipment rows (dropped from totals)
  for (const id of duplicateIds) {
    push({
      code: "DUPLICATE_SHIPMENT",
      severity: "warn",
      shipmentId: id,
      message: `Duplicate shipment row ${id} detected; the repeat was dropped so it is not double-counted.`,
    });
  }

  // 3) calibrated-vs-printed rate divergence per carrier
  for (const c of ["peak", "heartland", "coastal"] as Carrier[]) {
    const div = calibration[c].divergence;
    if (Math.abs(div.divergencePct) > th.divergencePct) {
      push({
        code: "RATE_DIVERGENCE",
        severity: "warn",
        carrier: c,
        message: `${carrierConfig[c].displayName}: calibrated rate index ${div.calibrated} diverges from the printed card by ${(div.divergencePct * 100).toFixed(1)}% (${div.direction.replace("_", " ")}). Pricing uses calibrated rates; switch rateSource to printed_override to use the card.`,
        detail: { ...div },
      });
    }
  }

  // 4) per-shipment cost outliers (z-score within carrier)
  for (const c of ["peak", "heartland", "coastal"] as Carrier[]) {
    const rows = estimates.filter((e) => e.carrier === c);
    if (rows.length < 5) continue;
    const totals = rows.map((e) => e.total);
    const mu = mean(totals);
    const sd = Math.sqrt(mean(totals.map((t) => (t - mu) ** 2)));
    if (sd <= 0) continue;
    for (const e of rows) {
      const z = (e.total - mu) / sd;
      if (Math.abs(z) > th.costOutlierZ) {
        push({
          code: "COST_OUTLIER",
          severity: "info",
          carrier: c,
          shipmentId: e.shipmentId,
          message: `${e.shipmentId} total $${e.total.toFixed(2)} is ${z.toFixed(1)}σ from the ${carrierConfig[c].displayName} mean ($${mu.toFixed(0)}); review for keying/weight error.`,
          detail: { z: +z.toFixed(2), total: e.total, carrierMean: +mu.toFixed(2) },
        });
      }
    }
  }

  // 5) back-test MAPE alarm per carrier
  for (const c of ["peak", "heartland", "coastal"] as Carrier[]) {
    const m = backtest.byCarrier[c];
    if (m.engineMape > th.backtestMapeAlarmPct) {
      push({
        code: "BACKTEST_MAPE_HIGH",
        severity: "warn",
        carrier: c,
        message: `${carrierConfig[c].displayName} forecast MAPE ${(m.engineMape * 100).toFixed(1)}% exceeds the ${(th.backtestMapeAlarmPct * 100).toFixed(0)}% control threshold — driven by an unpredictable monthly rate index. The accrual carries a confidence band; the engine remains near-unbiased (bias ${(m.engineBias * 100).toFixed(1)}%).`,
        detail: { engineMape: m.engineMape, deniseMape: m.deniseMape, engineBias: m.engineBias },
      });
    }
  }

  // 6) adjustment reserve note (informational control)
  if (reserveEnabled) {
    push({
      code: "ADJUSTMENT_RESIDUAL",
      severity: "info",
      message:
        "A credit reserve equal to the historical net-adjustment run-rate (~-0.3% of invoiced) is booked so the gross accrual is not systematically high vs eventual invoices.",
    });
  }

  // 7) service-level price assumption (run-level)
  if (!engineConfig.normalization.serviceAffectsPrice) {
    push({
      code: "SERVICE_PRICE_ASSUMPTION",
      severity: "info",
      message:
        "No rate card prices by service level and invoices carry no service field; service level is assumed not to affect price (normalized for reporting only).",
    });
  }

  // severity counts + shipment map
  const bySeverity: Record<ExceptionSeverity, number> = { info: 0, warn: 0, error: 0 };
  const byShipment = new Map<string, string[]>();
  for (const e of out) {
    bySeverity[e.severity]++;
    if (e.shipmentId) {
      const arr = byShipment.get(e.shipmentId) ?? [];
      arr.push(e.id);
      byShipment.set(e.shipmentId, arr);
    }
  }

  return { exceptions: out, bySeverity, byShipment };
}
