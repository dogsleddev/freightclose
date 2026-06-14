import { describe, it, expect } from "vitest";
import { loadAll } from "./load";
import { parseCsv } from "./csv";
import { normalizeCarrier, normalizeService, mapSpecialHandling } from "./parse";

const data = loadAll();

describe("csv parser", () => {
  it("handles quoted fields with embedded commas", () => {
    const rows = parseCsv('a,b,c\n1,"x, y",3\n');
    expect(rows).toEqual([
      ["a", "b", "c"],
      ["1", "x, y", "3"],
    ]);
  });
  it("handles escaped quotes", () => {
    const rows = parseCsv('a\n"he said ""hi"""\n');
    expect(rows[1][0]).toBe('he said "hi"');
  });
});

describe("carrier normalization", () => {
  it("maps every messy variant to a canonical carrier", () => {
    for (const v of ["Peak Logistics", "PEAK LOG", "Peak"]) expect(normalizeCarrier(v)).toBe("peak");
    for (const v of ["Heartland Freight", "HEARTLAND", "Heartland Freight Co."])
      expect(normalizeCarrier(v)).toBe("heartland");
    for (const v of ["Coastal Express", "Coastal Express LLC", "COASTAL"])
      expect(normalizeCarrier(v)).toBe("coastal");
  });
  it("returns null for an unknown carrier", () => {
    expect(normalizeCarrier("FedEx")).toBeNull();
  });
});

describe("service normalization", () => {
  it("maps STD->Standard and Express->Expedited", () => {
    expect(normalizeService("STD")).toEqual({ service: "Standard", known: true });
    expect(normalizeService("Express")).toEqual({ service: "Expedited", known: true });
  });
});

describe("special handling mapping", () => {
  it("splits multi-token detail and separates residential", () => {
    const r = mapSpecialHandling("Liftgate, Inside Delivery");
    expect(r.codes.sort()).toEqual(["inside", "liftgate"]);
    const res = mapSpecialHandling("Residential Delivery");
    expect(res.hasResidential).toBe(true);
    expect(res.codes).toEqual([]);
  });
});

describe("shipment file", () => {
  it("has 161 rows with exactly one duplicate (SHP-10033)", () => {
    expect(data.shipments.length).toBe(161);
    expect(data.duplicateShipmentIds).toEqual(["SHP-10033"]);
    expect(data.shipments.filter((s) => !s.isDuplicate).length).toBe(160);
  });
  it("normalizes all carriers (no unknowns)", () => {
    const counts = { peak: 0, heartland: 0, coastal: 0 };
    for (const s of data.shipments) counts[s.carrier]++;
    expect(counts.peak + counts.heartland + counts.coastal).toBe(161);
    // raw->canonical: 41 peak, 65 heartland, 55 coastal rows (incl. the dupe)
    expect(counts.peak).toBe(41);
    expect(counts.heartland).toBe(65);
    expect(counts.coastal).toBe(55);
  });
  it("flags 5 rows with missing weight", () => {
    expect(data.shipments.filter((s) => s.weightLbs === null).length).toBe(5);
  });
  it("parses 30 residential shipments", () => {
    expect(data.shipments.filter((s) => s.residential).length).toBe(30);
  });
});

describe("invoice file", () => {
  it("has 811 line items", () => {
    expect(data.invoices.length).toBe(811);
  });
  it("ties to Denise actual_invoiced per carrier-month (the back-test oracle)", () => {
    for (const d of data.denise) {
      const lines = data.invoices.filter(
        (i) => i.carrier === d.carrier && i.serviceMonth === d.month
      );
      const sum = lines.reduce((a, i) => a + i.totalCharge, 0);
      expect(Math.abs(sum - d.actualInvoiced)).toBeLessThan(0.02);
    }
  });
});

describe("denise baseline", () => {
  it("has 18 rows across 3 carriers", () => {
    expect(data.denise.length).toBe(18);
    expect(new Set(data.denise.map((d) => d.carrier)).size).toBe(3);
  });
});
