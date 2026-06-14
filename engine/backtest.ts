// Back-test — the proof.
//
// Two views, both honest:
//   reconstruction (full sample): price each historical invoice line at its OWN
//     month's calibrated index. Proves the pricing mechanics reproduce actuals
//     to the cent. NOT an accuracy claim (in-sample).
//   forecast (expanding window): to score month M, forecast each carrier's rate
//     index from months < M only (recent window), price M's actual shipment
//     activity, and compare to actual next to Denise's trailing-3-mo average.
//     This is the apples-to-apples accuracy contest, with no circularity: the
//     rate level for M never sees M's own invoices.

import { buildModel, resolveRates, recentWindow, type CalibratedRates, type CalibrationModel } from "./calibrate";
import { bundledConfigSet, type ConfigSet } from "./configSet";
import { parseMonth, type MonthMeta } from "./lookups";
import { pricePeak } from "./price/peak";
import { priceHeartland } from "./price/heartland";
import { priceCoastal } from "./price/coastal";
import type { PricingInput } from "./price/shared";
import {
  type Carrier,
  CARRIERS,
  type InvoiceLine,
  type DeniseBaseline,
  type BackTestReport,
  type BackTestCell,
} from "./types";

function toInput(line: InvoiceLine): PricingInput {
  return {
    id: line.invoiceId,
    destination: line.destination,
    weightLbs: line.weightLbs,
    residential: line.accessorialDetail.includes("residential"),
    accessorials: line.accessorialDetail.filter((c) => c !== "residential"),
  };
}

/** Global QTD sequence for Heartland lines (by month then file order). */
function heartlandQtd(invoices: InvoiceLine[]): Map<string, number> {
  const hf = invoices
    .map((line, idx) => ({ line, idx, meta: parseMonth(line.serviceMonth) }))
    .filter((x) => x.line.carrier === "heartland" && x.meta) as { line: InvoiceLine; idx: number; meta: MonthMeta }[];
  hf.sort((a, b) => a.meta.ordinal - b.meta.ordinal || a.idx - b.idx);
  const map = new Map<string, number>();
  let q = "";
  let n = 0;
  for (const { line, meta } of hf) {
    if (meta.quarterKey !== q) {
      q = meta.quarterKey;
      n = 0;
    }
    map.set(line.invoiceId, ++n);
  }
  return map;
}

function priceLineTotal(
  line: InvoiceLine,
  rates: CalibratedRates,
  qtd: Map<string, number>,
  cfg: ConfigSet
): number {
  const input = toInput(line);
  if (line.carrier === "peak") return pricePeak(input, rates, cfg.peak).total;
  if (line.carrier === "coastal") return priceCoastal(input, rates, cfg.coastal).total;
  return priceHeartland(input, rates, { qtdIndex: qtd.get(line.invoiceId) ?? 1 }, cfg.heartland).total;
}

function printedRates(model: CalibrationModel, label: string): CalibratedRates {
  // index 1.0 == price on the printed card (cold-start, no prior invoices)
  const r = resolveRates(model, { indexMonths: model.monthsOrdered, label });
  return { ...r, peakIndex: 1, heartlandIndex: 1, coastalIndex: 1, basisLabel: label };
}

export interface BackTestOptions {
  windowMonths: number;
  mapeAlarmPct: number;
  /** Month-aware rate-card resolution (effective-dated versions). Default: bundled. */
  configFor?: (monthKey: string) => ConfigSet;
}

export function buildBackTest(
  invoices: InvoiceLine[],
  denise: DeniseBaseline[],
  opts: BackTestOptions
): BackTestReport {
  const configFor = opts.configFor ?? (() => bundledConfigSet);
  const model = buildModel(invoices, { configFor });
  const qtd = heartlandQtd(invoices);

  // month key <-> label
  const months = model.monthsOrdered;
  const labelByKey = new Map<string, string>();
  for (const i of invoices) {
    const m = parseMonth(i.serviceMonth);
    if (m) labelByKey.set(m.key, m.raw);
  }
  const deniseBy = new Map<string, DeniseBaseline>();
  for (const d of denise) deniseBy.set(`${d.carrier}|${d.month}`, d);

  // ---- reconstruction (in-sample, mechanics proof) ----
  let reconMax = 0;
  for (const mk of months) {
    const rates = resolveRates(model, { indexMonths: [mk], label: mk });
    const cfg = configFor(mk);
    for (const c of CARRIERS) {
      const lines = invoices.filter((i) => i.carrier === c && parseMonth(i.serviceMonth)?.key === mk);
      if (!lines.length) continue;
      const engine = lines.reduce((a, l) => a + priceLineTotal(l, rates, qtd, cfg), 0);
      const actualNoAdj = lines.reduce((a, l) => a + (l.totalCharge - l.adjustments), 0);
      reconMax = Math.max(reconMax, Math.abs(engine - actualNoAdj));
    }
  }

  // ---- forecast (expanding window, vs Denise) ----
  const cells: BackTestCell[] = [];
  for (let k = 0; k < months.length; k++) {
    const mk = months[k];
    const label = labelByKey.get(mk) ?? mk;
    const prior = months.slice(0, k);
    const coldStart = prior.length === 0;
    const window = recentWindow(prior, opts.windowMonths);
    const rates = coldStart
      ? printedRates(model, "cold start (printed card)")
      : resolveRates(model, { indexMonths: window, label: `forecast from ${window.join(", ")}` });

    const monthCfg = configFor(mk);
    for (const c of CARRIERS) {
      const d = deniseBy.get(`${c}|${label}`);
      if (!d) continue;
      const lines = invoices.filter((i) => i.carrier === c && parseMonth(i.serviceMonth)?.key === mk);
      const subtotal = lines.reduce((a, l) => a + priceLineTotal(l, rates, qtd, monthCfg), 0);
      const engineEstimate = Math.round((subtotal + subtotal * model.adjustmentRate) * 100) / 100;
      const actual = d.actualInvoiced;
      const engineErr = engineEstimate - actual;
      const deniseErr = d.accrualEstimate - actual;
      const ePct = actual ? engineErr / actual : 0;
      const dPct = actual ? deniseErr / actual : 0;
      cells.push({
        carrier: c,
        month: label,
        engineEstimate,
        actual,
        engineErrorDollars: Math.round(engineErr * 100) / 100,
        engineErrorPct: ePct,
        deniseEstimate: d.accrualEstimate,
        deniseErrorDollars: Math.round(deniseErr * 100) / 100,
        deniseErrorPct: dPct,
        winner:
          Math.abs(ePct) < Math.abs(dPct) - 1e-6
            ? "engine"
            : Math.abs(dPct) < Math.abs(ePct) - 1e-6
              ? "denise"
              : "tie",
      });
    }
  }

  // forecast cells exclude cold-start (first) month from headline accuracy
  const firstMonthLabel = labelByKey.get(months[0]);
  const scored = cells.filter((c) => c.month !== firstMonthLabel);

  const mape = (xs: BackTestCell[], pick: (c: BackTestCell) => number) =>
    xs.length ? xs.reduce((a, c) => a + Math.abs(pick(c)), 0) / xs.length : 0;
  const bias = (xs: BackTestCell[], pick: (c: BackTestCell) => number) =>
    xs.length ? xs.reduce((a, c) => a + pick(c), 0) / xs.length : 0;

  const byCarrier = {} as BackTestReport["byCarrier"];
  for (const c of CARRIERS) {
    const xs = scored.filter((x) => x.carrier === c);
    byCarrier[c] = {
      engineMape: +mape(xs, (x) => x.engineErrorPct).toFixed(4),
      deniseMape: +mape(xs, (x) => x.deniseErrorPct).toFixed(4),
      engineBias: +bias(xs, (x) => x.engineErrorPct).toFixed(4),
      deniseBias: +bias(xs, (x) => x.deniseErrorPct).toFixed(4),
      engineWins: xs.filter((x) => x.winner === "engine").length,
      months: xs.length,
    };
  }

  return {
    mode: "expanding",
    modeNote:
      "Headline = expanding-window forecast: each month's rate index is calibrated only from prior months, then applied to that month's actual shipment activity. The first month is cold-start (printed card) and excluded from headline metrics. Reconstruction below proves the pricing mechanics reproduce every invoice to the cent.",
    cells,
    byCarrier,
    overall: {
      engineMape: +mape(scored, (x) => x.engineErrorPct).toFixed(4),
      deniseMape: +mape(scored, (x) => x.deniseErrorPct).toFixed(4),
      engineBias: +bias(scored, (x) => x.engineErrorPct).toFixed(4),
      deniseBias: +bias(scored, (x) => x.deniseErrorPct).toFixed(4),
      engineWins: scored.filter((x) => x.winner === "engine").length,
      months: scored.length,
    },
    reconstruction: {
      note: "Each historical invoice line repriced at its own month's calibrated index (base+fuel+accessorials, pre-adjustment).",
      byCarrierMonthMaxErrorDollars: Math.round(reconMax * 100) / 100,
      tiedToActual: reconMax < 2.0,
    },
  };
}
