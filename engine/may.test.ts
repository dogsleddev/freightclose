import { describe, it, expect } from "vitest";
import { buildMayScenario } from "./may";

const may = buildMayScenario();
const nc = may.variants.find((v) => v.key === "nochange")!;
const fs = may.variants.find((v) => v.key === "fuelspike")!;

describe("May synthetic scenario", () => {
  it("is a badged synthetic period with two variants", () => {
    expect(may.status).toBe("simulated");
    expect(may.source).toBe("synthetic");
    expect(may.badge).toBe("Simulated period");
    expect(may.shipmentCount).toBe(160);
    expect(may.variants.map((v) => v.key)).toEqual(["nochange", "fuelspike"]);
  });

  it("uses calibrated ~14% Peak fuel for no-change and the announced 19% for the spike", () => {
    expect(may.calibratedPeakFuelPct).toBeCloseTo(0.14, 2);
    expect(may.scenarioPeakFuelPct).toBe(0.19);
    expect(nc.peakFuelPct).toBeCloseTo(0.14, 2);
    expect(fs.peakFuelPct).toBe(0.19);
    expect(nc.isScenarioOverride).toBe(false);
    expect(fs.isScenarioOverride).toBe(true);
  });

  it("matches the simulated actuals (no-change $116,758.91 / fuel-spike $119,729.97)", () => {
    expect(nc.actualTotal).toBeCloseTo(116758.91, 2);
    expect(fs.actualTotal).toBeCloseTo(119729.97, 2);
  });

  it("the actual spike is exactly the Peak fuel delta ($2,971.06), Peak-only", () => {
    expect(may.actualSpikeDelta).toBeCloseTo(2971.06, 2);
    // Heartland + Coastal actuals are byte-identical across variants
    for (const carrier of ["heartland", "coastal"] as const) {
      const a = nc.byCarrier.find((c) => c.carrier === carrier)!.actual;
      const b = fs.byCarrier.find((c) => c.carrier === carrier)!.actual;
      expect(a).toBe(b);
    }
    // the entire actual delta is Peak
    const peakNc = nc.byCarrier.find((c) => c.carrier === "peak")!.actual;
    const peakFs = fs.byCarrier.find((c) => c.carrier === "peak")!.actual;
    expect(peakFs - peakNc).toBeCloseTo(2971.06, 2);
  });

  it("the engine override is Peak-only and raises the accrual (adaptability)", () => {
    // Heartland + Coastal ENGINE estimates identical across variants (override is Peak-only)
    for (const carrier of ["heartland", "coastal"] as const) {
      const a = nc.byCarrier.find((c) => c.carrier === carrier)!.engine;
      const b = fs.byCarrier.find((c) => c.carrier === carrier)!.engine;
      expect(a).toBe(b);
    }
    const peakNc = nc.byCarrier.find((c) => c.carrier === "peak")!.engine;
    const peakFs = fs.byCarrier.find((c) => c.carrier === "peak")!.engine;
    expect(peakFs).toBeGreaterThan(peakNc); // the spike override books more Peak
    expect(may.engineSpikeUplift).toBeGreaterThan(0);
    expect(may.engineSpikeUplift).toBeCloseTo(peakFs - peakNc, 2);
  });

  it("flags the fuel-surcharge override divergence only on the spike variant", () => {
    expect(fs.divergenceNote).toBeTruthy();
    expect(fs.divergenceNote).toMatch(/19\.0%/);
    expect(fs.divergenceNote).toMatch(/announced forward rate change/i);
    expect(nc.divergenceNote).toBeNull();
  });

  it("both variants' true-up JEs balance and are not ASC 450", () => {
    for (const v of may.variants) {
      expect(v.trueUpJournal.balanced).toBe(true);
      expect(v.trueUpJournal.framework).not.toBe("ASC 450");
    }
  });

  it("blind under-accrual = fuel-spike actual vs the no-change estimate", () => {
    expect(may.blindUnderAccrual).toBeCloseTo(fs.actualTotal - nc.engineTotal, 2);
    // applying the override more than halves the spike-scenario miss vs staying blind
    expect(Math.abs(fs.varianceDollars)).toBeLessThan(Math.abs(may.blindUnderAccrual));
  });
});
