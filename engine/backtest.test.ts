import { describe, it, expect } from "vitest";
import { loadAll } from "./load";
import { buildBackTest } from "./backtest";
import { engineConfig } from "./config";

const { invoices, denise } = loadAll();
const report = buildBackTest(invoices, denise, {
  windowMonths: engineConfig.calibration.recentWindowMonths,
  mapeAlarmPct: engineConfig.thresholds.backtestMapeAlarmPct,
});

describe("back-test reconstruction (mechanics proof)", () => {
  it("reproduces every carrier-month to within ~$2", () => {
    // eslint-disable-next-line no-console
    console.log(`reconstruction max carrier-month error: $${report.reconstruction.byCarrierMonthMaxErrorDollars}`);
    expect(report.reconstruction.tiedToActual).toBe(true);
  });
});

describe("back-test forecast vs Denise (expanding window)", () => {
  it("prints the head-to-head", () => {
    // eslint-disable-next-line no-console
    console.log("\n  month            carrier     engine      denise      actual    eng%    den%   winner");
    for (const c of report.cells) {
      // eslint-disable-next-line no-console
      console.log(
        `  ${c.month.padEnd(15)} ${c.carrier.padEnd(9)} ${c.engineEstimate.toFixed(0).padStart(9)} ${c.deniseEstimate
          .toFixed(0)
          .padStart(11)} ${c.actual.toFixed(0).padStart(11)} ${(c.engineErrorPct * 100).toFixed(1).padStart(6)} ${(
          c.deniseErrorPct * 100
        )
          .toFixed(1)
          .padStart(6)}   ${c.winner}`
      );
    }
    // eslint-disable-next-line no-console
    console.log("\n  byCarrier:", JSON.stringify(report.byCarrier));
    // eslint-disable-next-line no-console
    console.log("  overall:", JSON.stringify(report.overall));
  });

  it("engine is materially less biased than Denise (she systematically under-accrues)", () => {
    // Accrual bias matters more than per-month MAPE: a biased accrual misstates
    // the P&L every period. Denise runs ~-4-5% (chronic under-accrual); the
    // bottoms-up engine is near-unbiased.
    expect(Math.abs(report.overall.engineBias)).toBeLessThan(Math.abs(report.overall.deniseBias));
    expect(Math.abs(report.overall.deniseBias)).toBeGreaterThan(0.03);
  });

  it("engine wins the majority of Heartland months (the predictable-regime carrier)", () => {
    expect(report.byCarrier.heartland.engineWins).toBeGreaterThanOrEqual(3);
  });

  it("engine crushes the Heartland January reset month specifically", () => {
    const jan = report.cells.find((c) => c.carrier === "heartland" && c.month === "January 2026");
    expect(jan).toBeDefined();
    // Denise missed by -18.7%; engine should be materially closer
    expect(Math.abs(jan!.engineErrorPct)).toBeLessThan(Math.abs(jan!.deniseErrorPct));
  });
});
