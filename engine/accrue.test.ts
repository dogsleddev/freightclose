import { describe, it, expect } from "vitest";
import { loadAll } from "./load";
import { calibrateForApril } from "./calibrate";
import { engineConfig } from "./config";
import { buildAccrual, tieOuts } from "./accrue";

const { shipments, invoices } = loadAll();
const { rates } = calibrateForApril(invoices, engineConfig.calibration.recentWindowMonths);
const accrual = buildAccrual(shipments, rates);

describe("accrual assembly", () => {
  it("prices every non-duplicate shipment (160)", () => {
    expect(accrual.estimates.length).toBe(160);
    const counts = { peak: 0, heartland: 0, coastal: 0 };
    for (const e of accrual.estimates) counts[e.carrier]++;
    expect(counts).toEqual({ peak: 40, heartland: 65, coastal: 55 });
  });

  it("all tie-outs pass", () => {
    const tos = tieOuts(accrual);
    for (const t of tos) expect(t.passed).toBe(true);
    expect(tos.length).toBeGreaterThanOrEqual(5);
  });

  it("books a small negative credit reserve", () => {
    expect(accrual.totalCreditReserve).toBeLessThan(0);
    expect(accrual.totalCreditReserve).toBeGreaterThan(-1000);
    expect(accrual.totalAccrual).toBeCloseTo(accrual.totalSubtotal + accrual.totalCreditReserve, 2);
  });

  it("produces a plausible April accrual (~$80-100K)", () => {
    // eslint-disable-next-line no-console
    console.log(
      "April accrual:",
      accrual.carrierSummaries.map((s) => `${s.carrier}=$${s.subtotal} (acc $${s.accrual})`).join("  "),
      `| total subtotal=$${accrual.totalSubtotal} reserve=$${accrual.totalCreditReserve} accrual=$${accrual.totalAccrual}`
    );
    expect(accrual.totalAccrual).toBeGreaterThan(70000);
    expect(accrual.totalAccrual).toBeLessThan(110000);
  });

  it("flags Heartland QTD reset: first 50 at tier 1, rest step down", () => {
    const hf = accrual.estimates.filter((e) => e.carrier === "heartland");
    const tier1 = hf.filter((e) => e.classification.heartlandTier === 1).length;
    const tier2plus = hf.filter((e) => (e.classification.heartlandTier as number) >= 2).length;
    expect(tier1).toBe(50);
    expect(tier2plus).toBe(hf.length - 50);
  });

  it("imputes the 2 Coastal missing weights and flags them", () => {
    const imputed = accrual.rawExceptions.filter((e) => e.code === "IMPUTED_WEIGHT");
    expect(imputed.length).toBe(2);
    expect(imputed.every((e) => e.carrier === "coastal")).toBe(true);
  });
});
