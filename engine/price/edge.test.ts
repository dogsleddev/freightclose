import { describe, it, expect } from "vitest";
import { loadAll } from "./../load";
import { calibrateForApril } from "./../calibrate";
import { heartlandConfig } from "./../config";
import { pricePeak } from "./peak";
import { priceHeartland } from "./heartland";
import { priceCoastal } from "./coastal";
import type { PricingInput } from "./shared";

const { invoices } = loadAll();
const { rates } = calibrateForApril(invoices, 3);

describe("Peak mileage fallback + territory", () => {
  it("Reno NV (no history, no printed entry) uses geo fallback and flags out-of-territory", () => {
    const input: PricingInput = {
      id: "SHP-10006",
      origin: { city: "Denver", state: "CO" },
      destination: { city: "Reno", state: "NV", zip: "89501" },
      weightLbs: 339.8,
      residential: false,
      accessorials: [],
    };
    const r = pricePeak(input, rates);
    expect(r.classification.peakMileageSource).toBe("geo");
    expect(r.classification.peakMiles as number).toBeGreaterThan(700);
    const codes = r.exceptions.map((e) => e.code);
    expect(codes).toContain("MILEAGE_FALLBACK_GEO");
    expect(codes).toContain("OUT_OF_TERRITORY");
    expect(r.total).toBeGreaterThan(0);
  });
});

describe("Heartland QTD volume tiers (Apr 1 reset)", () => {
  const base: PricingInput = {
    id: "x",
    destination: { city: "Chicago", state: "IL", zip: "60601" }, // Z3
    weightLbs: 1000,
    residential: false,
    accessorials: [],
  };
  it("tier 1 (count<=50) charges full rate; tier 3 (121-200) is 10% off base", () => {
    const t1 = priceHeartland(base, rates, { qtdIndex: 1 });
    const t3 = priceHeartland(base, rates, { qtdIndex: 130 });
    expect(t1.classification.heartlandTier).toBe(1);
    expect(t3.classification.heartlandTier).toBe(3);
    expect(t3.baseCharge).toBeCloseTo(t1.baseCharge * 0.9, 1);
  });
  it("zone comes from ZIP prefix, not state (KC KS 66101 is Z1)", () => {
    const r = priceHeartland(
      { ...base, destination: { city: "Kansas City", state: "KS", zip: "66101" } },
      rates,
      { qtdIndex: 1 }
    );
    expect(r.classification.heartlandZone).toBe("Z1");
  });
  it("residential Heartland shipment flags RESIDENTIAL_NO_FEE (no surcharge charged)", () => {
    const r = priceHeartland({ ...base, residential: true }, rates, { qtdIndex: 1 });
    expect(r.residentialSurcharge).toBe(0);
    expect(r.exceptions.map((e) => e.code)).toContain("RESIDENTIAL_NO_FEE");
  });
});

describe("Coastal min charge + residential surcharge", () => {
  it("light shipment hits the $28 min (scaled by index)", () => {
    const r = priceCoastal(
      { id: "x", destination: { city: "Los Angeles", state: "CA", zip: "90001" }, weightLbs: 5, residential: false, accessorials: [] },
      rates
    );
    expect(r.minChargeApplied).toBe(true);
    expect(r.baseCharge).toBeCloseTo(28 * rates.coastalIndex, 1);
  });
  it("residential surcharge applies tier fee by weight", () => {
    const r = priceCoastal(
      { id: "x", destination: { city: "Los Angeles", state: "CA", zip: "90001" }, weightLbs: 40, residential: true, accessorials: [] },
      rates
    );
    expect(r.residentialSurcharge).toBe(12.5);
  });
  it("out-of-range ZIP is flagged not-served", () => {
    const r = priceCoastal(
      { id: "x", destination: { city: "Reno", state: "NV", zip: "89501" }, weightLbs: 50, residential: false, accessorials: [] },
      rates
    );
    expect(r.exceptions.map((e) => e.code)).toContain("OUT_OF_TERRITORY");
  });
});

describe("config sanity", () => {
  it("Heartland volume tiers match the card", () => {
    expect(heartlandConfig.volumeTiers.map((t) => t.discount)).toEqual([0, 0.05, 0.1, 0.15]);
  });
});
