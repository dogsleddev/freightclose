import { describe, it, expect } from "vitest";
import { loadAll } from "./../load";
import { buildModel, resolveRates, type CalibratedRates } from "./../calibrate";
import { parseMonth, type MonthMeta } from "./../lookups";
import type { InvoiceLine, Carrier } from "./../types";
import { pricePeak } from "./peak";
import { priceHeartland } from "./heartland";
import { priceCoastal } from "./coastal";
import type { PricedResult, PricingInput } from "./shared";

const { invoices } = loadAll();
const model = buildModel(invoices);

// rates cache per month (reconstruction uses each line's own month index)
const ratesCache = new Map<string, CalibratedRates>();
function ratesFor(monthKey: string): CalibratedRates {
  if (!ratesCache.has(monthKey))
    ratesCache.set(monthKey, resolveRates(model, { indexMonths: [monthKey], label: monthKey }));
  return ratesCache.get(monthKey)!;
}

function toInput(line: InvoiceLine): PricingInput {
  const residential = line.accessorialDetail.includes("residential");
  const accessorials = line.accessorialDetail.filter((c) => c !== "residential");
  return {
    id: line.invoiceId,
    destination: line.destination,
    weightLbs: line.weightLbs,
    residential,
    accessorials,
  };
}

// assign QTD index to each heartland line (sequence by month then file order)
const hfQtd = new Map<string, number>();
{
  const hf = invoices
    .map((line, idx) => ({ line, idx, meta: parseMonth(line.serviceMonth) }))
    .filter((x) => x.line.carrier === "heartland" && x.meta) as { line: InvoiceLine; idx: number; meta: MonthMeta }[];
  hf.sort((a, b) => a.meta.ordinal - b.meta.ordinal || a.idx - b.idx);
  let q = "";
  let n = 0;
  for (const { line, meta } of hf) {
    if (meta.quarterKey !== q) {
      q = meta.quarterKey;
      n = 0;
    }
    n += 1;
    hfQtd.set(line.invoiceId, n);
  }
}

function priceLine(line: InvoiceLine): PricedResult {
  const mk = parseMonth(line.serviceMonth)!.key;
  const rates = ratesFor(mk);
  const input = toInput(line);
  if (line.carrier === "peak") return pricePeak(input, rates);
  if (line.carrier === "coastal") return priceCoastal(input, rates);
  return priceHeartland(input, rates, { qtdIndex: hfQtd.get(line.invoiceId) ?? 1 });
}

interface Err {
  base: number;
  fuel: number;
  acc: number;
  total: number;
  sumEngine: number;
  sumActual: number;
}

function reconcile(carrier: Carrier): Err {
  const lines = invoices.filter((i) => i.carrier === carrier);
  let base = 0,
    fuel = 0,
    acc = 0,
    total = 0,
    sumEngine = 0,
    sumActual = 0;
  for (const l of lines) {
    const p = priceLine(l);
    base = Math.max(base, Math.abs(p.baseCharge - l.baseCharge));
    fuel = Math.max(fuel, Math.abs(p.fuelSurcharge - l.fuelSurcharge));
    acc = Math.max(acc, Math.abs(p.accessorialTotal + p.residentialSurcharge - l.accessorialFees));
    // engine has no post-close adjustments; compare to actual excluding adjustments
    const actualNoAdj = l.totalCharge - l.adjustments;
    total = Math.max(total, Math.abs(p.total - actualNoAdj));
    sumEngine += p.total;
    sumActual += actualNoAdj;
  }
  return { base, fuel, acc, total, sumEngine, sumActual };
}

for (const carrier of ["peak", "heartland", "coastal"] as Carrier[]) {
  describe(`reconstruction: ${carrier}`, () => {
    const e = reconcile(carrier);
    it("ties base, fuel, accessorials, and total per line", () => {
      // eslint-disable-next-line no-console
      console.log(`${carrier}: maxBaseErr=${e.base.toFixed(2)} maxFuelErr=${e.fuel.toFixed(2)} maxAccErr=${e.acc.toFixed(2)} maxTotalErr=${e.total.toFixed(2)}  sumEngine=${e.sumEngine.toFixed(2)} sumActual(no adj)=${e.sumActual.toFixed(2)} diff=${(e.sumEngine - e.sumActual).toFixed(2)}`);
      expect(e.base).toBeLessThan(1.0);
      expect(e.fuel).toBeLessThan(1.0);
      expect(e.acc).toBeLessThan(1.0);
      expect(e.total).toBeLessThan(2.0);
    });
  });
}
