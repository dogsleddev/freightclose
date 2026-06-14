// Multi-period close: effective-dated config versions, QTD carry-over,
// printed_override, and reproducibility. The load-bearing claims:
//   1. April (bundled) is unchanged by the refactor — same accrual to the cent.
//   2. A card version effective May moves May's accrual but leaves every
//      historical month's index and reconstruction untouched.
//   3. Mid-quarter closes carry the Heartland QTD count in (or flag the gap).
//   4. Same inputs + same config version => byte-identical run (reproducibility).

import { describe, expect, it } from "vitest";
import { loadAll } from "./load";
import { runClose, ENGINE_VERSION } from "./close";
import { buildModel } from "./calibrate";
import { bundledConfigSet, resolveConfigFor, configResolver, validateConfigSet, type ConfigSet, type RateConfigVersion } from "./configSet";
import { journalEntryToCsv } from "./je";
import type { InvoiceLine, ParsedShipment } from "./types";

const data = loadAll();

function aprilClose() {
  return runClose({
    periodKey: "2026-04",
    shipments: data.shipments,
    duplicateShipmentIds: data.duplicateShipmentIds,
    invoices: data.invoices,
    denise: data.denise,
  });
}

/** Deep-clone the bundled set so a version can be edited without mutating it. */
function cloneSet(): ConfigSet {
  return JSON.parse(JSON.stringify(bundledConfigSet)) as ConfigSet;
}

/** Minimal May shipments: one per carrier, destinations with invoice history. */
function mayShipments(): { shipments: ParsedShipment[]; duplicateIds: string[] } {
  const base = data.shipments.filter((s) => !s.isDuplicate);
  const peak = base.find((s) => s.carrier === "peak")!;
  const heartland = base.find((s) => s.carrier === "heartland")!;
  const coastal = base.find((s) => s.carrier === "coastal")!;
  const may = [peak, heartland, coastal].map((s, i) => ({
    ...s,
    shipmentId: `MAY-${i + 1}`,
    date: `2026-05-0${i + 1}`,
  }));
  return { shipments: may, duplicateIds: [] };
}

describe("runClose — April identity", () => {
  it("reproduces the verified April accrual exactly", () => {
    // Calibrate-from-invoice (recent-window MEDIAN) result on the canonical data.
    const run = aprilClose();
    expect(run.totalAccrual).toBe(93530.38);
    expect(run.period).toBe("April 2026");
    expect(run.periodKey).toBe("2026-04");
    expect(run.periodEndDate).toBe("2026-04-30");
    expect(run.shipmentEstimates.length).toBe(160);
    expect(run.exceptions.length).toBe(22);
    expect(run.allTieOutsPassed).toBe(true);
    expect(run.backtest.reconstruction.byCarrierMonthMaxErrorDollars).toBeLessThanOrEqual(0.32);
  });

  it("April JE external id derives to the legacy value", () => {
    const run = aprilClose();
    expect(journalEntryToCsv(run.journalEntry)).toContain("FREIGHTCLOSE-2026-04");
  });

  it("April provenance: bundled config version, no QTD carry-in (Q2 start)", () => {
    const run = aprilClose();
    expect(run.provenance?.configVersionId).toBe("v0-bundled");
    expect(run.provenance?.engineVersion).toBe(ENGINE_VERSION);
    expect(run.provenance?.qtdStart).toBeUndefined();
  });

  it("is byte-identical across runs (reproducibility)", () => {
    expect(JSON.stringify(aprilClose())).toBe(JSON.stringify(aprilClose()));
  });
});

describe("effective-dated config versions", () => {
  it("resolveConfigFor picks the latest version at or before the month", () => {
    const v1: RateConfigVersion = { id: "v1", effectiveFrom: "2026-05", note: "test", set: cloneSet() };
    expect(resolveConfigFor([v1], "2026-04").id).toBe("v0-bundled");
    expect(resolveConfigFor([v1], "2026-05").id).toBe("v1");
    expect(resolveConfigFor([v1], "2026-07").id).toBe("v1");
  });

  it("a May card change leaves historical indices and reconstruction untouched", () => {
    const edited = cloneSet();
    // Carrier reprices Heartland zones +10% effective May 2026
    for (const z of Object.keys(edited.heartland.printedZoneRates)) {
      edited.heartland.printedZoneRates[z] = +(edited.heartland.printedZoneRates[z] * 1.1).toFixed(2);
    }
    const v1: RateConfigVersion = { id: "v1-hf-2026-05", effectiveFrom: "2026-05", note: "HF +10%", set: edited };

    const baseModel = buildModel(data.invoices);
    const versionedModel = buildModel(data.invoices, { configFor: configResolver([v1]) });
    // History is Oct 2025–Mar 2026, all before the version: identical indices.
    expect(versionedModel.heartlandIndexByMonth).toEqual(baseModel.heartlandIndexByMonth);
    expect(versionedModel.peakIndexByMonth).toEqual(baseModel.peakIndexByMonth);
    expect(versionedModel.coastalIndexByMonth).toEqual(baseModel.coastalIndexByMonth);
  });

  it("a card change effective May moves the May accrual (numerator), Heartland only", () => {
    const { shipments, duplicateIds } = mayShipments();
    const edited = cloneSet();
    for (const z of Object.keys(edited.heartland.printedZoneRates)) {
      edited.heartland.printedZoneRates[z] = +(edited.heartland.printedZoneRates[z] * 1.1).toFixed(2);
    }
    const v1: RateConfigVersion = { id: "v1-hf-2026-05", effectiveFrom: "2026-05", note: "HF +10%", set: edited };

    const base = runClose({
      periodKey: "2026-05",
      shipments,
      duplicateShipmentIds: duplicateIds,
      invoices: data.invoices,
      denise: data.denise,
    });
    const repriced = runClose({
      periodKey: "2026-05",
      shipments,
      duplicateShipmentIds: duplicateIds,
      invoices: data.invoices,
      denise: data.denise,
      configVersions: [v1],
    });

    const hfBase = base.carrierSummaries.find((c) => c.carrier === "heartland")!;
    const hfNew = repriced.carrierSummaries.find((c) => c.carrier === "heartland")!;
    expect(hfNew.subtotal).toBeGreaterThan(hfBase.subtotal);
    // +10% on the zone rate should move the HF base by exactly 10%
    expect(hfNew.base / hfBase.base).toBeCloseTo(1.1, 2);
    // other carriers unmoved
    for (const c of ["peak", "coastal"] as const) {
      expect(repriced.carrierSummaries.find((x) => x.carrier === c)!.subtotal).toBe(
        base.carrierSummaries.find((x) => x.carrier === c)!.subtotal
      );
    }
    expect(repriced.provenance?.configVersionId).toBe("v1-hf-2026-05");
    // reconstruction (history only) still ties
    expect(repriced.backtest.reconstruction.tiedToActual).toBe(true);
  });

  it("validateConfigSet rejects a broken edit", () => {
    const broken = cloneSet();
    (broken.heartland.printedZoneRates as Record<string, unknown>)["HF-A"] = "not a number";
    const issues = validateConfigSet(broken);
    expect(issues.some((i) => i.path.includes("printedZoneRates"))).toBe(true);
    expect(validateConfigSet(bundledConfigSet)).toEqual([]);
  });
});

describe("Heartland QTD carry-over (mid-quarter close)", () => {
  it("April (quarter start) resets to tier 1 with no carry-in", () => {
    const run = aprilClose();
    const hfFirst = run.shipmentEstimates
      .filter((e) => e.carrier === "heartland")
      .sort((a, b) => a.date.localeCompare(b.date) || a.shipmentId.localeCompare(b.shipmentId))[0];
    expect(hfFirst.classification.heartlandQtdIndex).toBe(1);
  });

  it("May without April invoices flags the assumed carry-in", () => {
    const { shipments, duplicateIds } = mayShipments();
    const run = runClose({
      periodKey: "2026-05",
      shipments,
      duplicateShipmentIds: duplicateIds,
      invoices: data.invoices, // history ends March — April gap
      denise: data.denise,
    });
    expect(run.exceptions.some((e) => e.code === "QTD_CARRYOVER_ASSUMED")).toBe(true);
  });

  it("an explicit prior-close count seeds the QTD index and is flagged info-level", () => {
    const { shipments, duplicateIds } = mayShipments();
    const run = runClose({
      periodKey: "2026-05",
      shipments,
      duplicateShipmentIds: duplicateIds,
      invoices: data.invoices,
      denise: data.denise,
      qtdStartOverride: { count: 65, basis: "April 2026 close: 65 Heartland shipments" },
    });
    const hf = run.shipmentEstimates.find((e) => e.shipmentId === "MAY-2")!;
    expect(hf.classification.heartlandQtdIndex).toBe(66);
    // 66 shipments QTD => tier 2 per bundled card (51-120 => 5%), vs tier 1 (0%)
    // if the carry-in were wrongly reset — the mid-quarter correctness fix.
    expect(hf.classification.heartlandTier).toBe(2);
    expect(hf.classification.heartlandDiscountPct).toBe(0.05);
    expect(run.exceptions.some((e) => e.code === "QTD_CARRYOVER")).toBe(true);
    expect(run.exceptions.some((e) => e.code === "QTD_CARRYOVER_ASSUMED")).toBe(false);
    expect(run.provenance?.qtdStart?.count).toBe(65);
  });

  it("June derives carry-in from uploaded April+May invoice lines when present", () => {
    // graft two fake Heartland May lines onto history so June sees in-quarter coverage
    const hfLine = data.invoices.find((i) => i.carrier === "heartland")!;
    const mayLines: InvoiceLine[] = [1, 2].map((n) => ({
      ...hfLine,
      invoiceId: `INV-MAY-${n}`,
      serviceMonth: "May 2026",
    }));
    const aprLines: InvoiceLine[] = [1, 2, 3].map((n) => ({
      ...hfLine,
      invoiceId: `INV-APR-${n}`,
      serviceMonth: "April 2026",
    }));
    const { shipments, duplicateIds } = mayShipments();
    const run = runClose({
      periodKey: "2026-06",
      shipments: shipments.map((s) => ({ ...s, date: s.date.replace("2026-05", "2026-06") })),
      duplicateShipmentIds: duplicateIds,
      invoices: [...data.invoices, ...aprLines, ...mayLines],
      denise: data.denise,
    });
    expect(run.provenance?.qtdStart?.count).toBe(5);
    expect(run.exceptions.some((e) => e.code === "QTD_CARRYOVER_ASSUMED")).toBe(false);
  });
});

describe("printed_override rate source", () => {
  it("prices the carrier at index 1.0 on the period card and flags the divergence", () => {
    const run = runClose({
      periodKey: "2026-04",
      shipments: data.shipments,
      duplicateShipmentIds: data.duplicateShipmentIds,
      invoices: data.invoices,
      denise: data.denise,
      rateSource: { peak: "printed_override", heartland: "calibrated", coastal: "calibrated" },
    });
    const base = aprilClose();
    const peakNew = run.carrierSummaries.find((c) => c.carrier === "peak")!;
    const peakBase = base.carrierSummaries.find((c) => c.carrier === "peak")!;
    // April calibrated Peak index ~0.806 < 1.0, so the printed card prices higher
    expect(peakNew.base).toBeGreaterThan(peakBase.base);
    expect(
      run.exceptions.some(
        (e) => e.code === "RATE_DIVERGENCE" && e.carrier === "peak" && /printed_override/.test(e.message)
      )
    ).toBe(true);
    // estimates carry the override provenance
    expect(run.shipmentEstimates.find((e) => e.carrier === "peak")!.rateSource).toBe("printed_override");
    // untouched carriers identical
    expect(run.carrierSummaries.find((c) => c.carrier === "coastal")!.subtotal).toBe(
      base.carrierSummaries.find((c) => c.carrier === "coastal")!.subtotal
    );
    expect(run.allTieOutsPassed).toBe(true);
  });
});

describe("multi-period JE", () => {
  it("May JE carries its own period, end date, and external id", () => {
    const { shipments, duplicateIds } = mayShipments();
    const run = runClose({
      periodKey: "2026-05",
      shipments,
      duplicateShipmentIds: duplicateIds,
      invoices: data.invoices,
      denise: data.denise,
    });
    expect(run.journalEntry.period).toBe("May 2026");
    expect(run.journalEntry.date).toBe("2026-05-31");
    expect(run.journalEntry.balanced).toBe(true);
    expect(journalEntryToCsv(run.journalEntry)).toContain("FREIGHTCLOSE-2026-05");
    expect(run.journalEntry.totalDebits).toBe(run.totalAccrual);
  });
});
