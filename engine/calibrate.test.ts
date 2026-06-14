import { describe, it, expect } from "vitest";
import { loadAll } from "./load";
import { buildModel, calibrateForApril } from "./calibrate";

const { invoices } = loadAll();
const model = buildModel(invoices);

describe("Peak structural mileage", () => {
  it("recovers printed-table mileage for known cities (index factored out)", () => {
    expect(model.peakStructuralMiles["80901"].miles).toBeCloseTo(70, 0); // Colorado Springs
    expect(model.peakStructuralMiles["82001"].miles).toBeCloseTo(100, 0); // Cheyenne
    expect(model.peakStructuralMiles["83401"].miles).toBeCloseTo(480, 0); // Idaho Falls
    expect(model.peakStructuralMiles["84601"].miles).toBeCloseTo(490, 0); // Provo
  });
  it("calibrates structural mileage for destinations NOT on the printed table", () => {
    expect(model.peakStructuralMiles["82601"]?.inPrinted).toBe(false); // Casper
    expect(model.peakStructuralMiles["82601"].miles).toBeGreaterThan(0);
    expect(model.peakStructuralMiles["81501"].miles).toBeGreaterThan(0); // Grand Junction
  });
});

describe("monthly rate index", () => {
  it("Peak fuel 14%, Coastal fuel 9.5%", () => {
    expect(model.peakFuelPct).toBeCloseTo(0.14, 3);
    expect(model.coastalFuelPct).toBeCloseTo(0.095, 3);
  });
  it("Heartland index: Oct ~1.033, Jan ~1.227 (printed card understates recently)", () => {
    expect(model.heartlandIndexByMonth["2025-10"]).toBeCloseTo(1.033, 2);
    expect(model.heartlandIndexByMonth["2026-01"]).toBeCloseTo(1.227, 2);
  });
  it("Peak index: Oct ~0.906 (printed card overstates)", () => {
    expect(model.peakIndexByMonth["2025-10"]).toBeCloseTo(0.906, 2);
  });
  it("Coastal index present and positive for every month", () => {
    for (const m of model.monthsOrdered) {
      expect(model.coastalIndexByMonth[m]).toBeGreaterThan(0);
    }
  });
});

describe("adjustment run-rate", () => {
  it("is small and negative (~-0.3%)", () => {
    expect(model.adjustmentRate).toBeLessThan(0);
    expect(model.adjustmentRate).toBeGreaterThan(-0.01);
  });
});

describe("April calibration basis", () => {
  it("uses the recent 3-month window and yields sensible indices", () => {
    const { rates } = calibrateForApril(invoices, 3);
    expect(rates.windowMonths).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(rates.peakIndex).toBeGreaterThan(0.6);
    expect(rates.peakIndex).toBeLessThan(1.1);
    expect(rates.heartlandIndex).toBeGreaterThan(1.0);
    expect(rates.coastalIndex).toBeGreaterThan(1.0);
    // eslint-disable-next-line no-console
    console.log("April indices:", {
      peak: rates.peakIndex,
      heartland: rates.heartlandIndex,
      coastal: rates.coastalIndex,
    });
  });
  it("divergences flag printed-vs-calibrated direction", () => {
    const { report } = calibrateForApril(invoices, 3);
    expect(report.peak.divergence.direction).toBe("printed_high");
    expect(report.heartland.divergence.direction).toBe("printed_low");
    expect(report.coastal.divergence.direction).toBe("printed_low");
  });
});
