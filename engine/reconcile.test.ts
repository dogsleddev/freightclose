import { describe, it, expect } from "vitest";
import { buildClosedPeriods, buildPeriodsIndex } from "./reconcile";
import { loadPeriod } from "./load";
import { runClose } from "./close";

const closed = buildClosedPeriods();
const byId = Object.fromEntries(closed.map((c) => [c.periodId, c]));

describe("closed-period reconciliation", () => {
  it("reconciles the six closed months in chronological order", () => {
    expect(closed.map((c) => c.periodId)).toEqual(["2510", "2511", "2512", "2601", "2602", "2603"]);
    expect(closed.every((c) => c.status === "closed" && c.source === "real")).toBe(true);
    expect(closed.every((c) => c.badge === "Reconstructed from invoices")).toBe(true);
  });

  it("only the first closed month is cold-start", () => {
    expect(byId["2510"].isColdStart).toBe(true);
    expect(closed.filter((c) => c.isColdStart).length).toBe(1);
  });

  it("actual leg ties to the invoice register (Oct = $88,638.22) and reconciles to Denise", () => {
    expect(byId["2510"].actualTotal).toBeCloseTo(88638.22, 2);
    expect(byId["2601"].actualTotal).toBeCloseTo(97996.49, 2);
    expect(closed.every((c) => c.actualsReconcileToDenise)).toBe(true);
  });

  it("engine leg is the leave-one-out runClose total (history strictly precedes the period)", () => {
    const mar = runClose({
      periodKey: loadPeriod("2603").periodKey,
      shipments: loadPeriod("2603").shipments,
      duplicateShipmentIds: loadPeriod("2603").duplicateShipmentIds,
      invoices: loadPeriod("2603").invoices,
      denise: loadPeriod("2603").denise,
    });
    expect(byId["2603"].engineTotal).toBeCloseTo(mar.totalAccrual, 2);
    // engineTotal == Σ byCarrier engine; actualTotal == Σ byCarrier actual
    for (const c of closed) {
      expect(c.engineTotal).toBeCloseTo(c.byCarrier.reduce((a, x) => a + x.engine, 0), 2);
      expect(c.actualTotal).toBeCloseTo(c.byCarrier.reduce((a, x) => a + x.actual, 0), 2);
      expect(c.varianceDollars).toBeCloseTo(c.actualTotal - c.engineTotal, 2);
    }
  });

  it("every true-up JE balances, and its net equals the period variance", () => {
    for (const c of closed) {
      expect(c.trueUpJournal.balanced).toBe(true);
      expect(c.actualsJournal.balanced).toBe(true);
      const net = c.trueUpJournal.totalDebits - c.trueUpJournal.totalCredits;
      expect(net).toBeCloseTo(0, 2);
      // signed net adjustment (Σ debit expense − Σ credit expense on 6200) == variance
      const expenseNet = c.trueUpJournal.lines
        .filter((l) => l.account === "6200")
        .reduce((a, l) => a + (l.type === "debit" ? l.amount : -l.amount), 0);
      expect(expenseNet).toBeCloseTo(c.varianceDollars, 2);
    }
  });

  it("keeps Denise quarantined: the default record carries no Denise totals, only the .denise leg does", () => {
    for (const c of closed) {
      // byCarrier (the neutral reconciliation) must not leak a denise field
      for (const row of c.byCarrier) expect("denise" in row).toBe(false);
      // the quarantined leg carries the three-way
      expect(c.denise.byCarrier.length).toBe(3);
      expect(c.denise.totalDenise).toBeGreaterThan(0);
    }
  });

  it("never reintroduces ASC 450 in any emitted framework", () => {
    for (const c of closed) {
      expect(c.trueUpJournal.framework).not.toBe("ASC 450");
      expect(c.actualsJournal.framework).not.toBe("ASC 450");
    }
  });
});

describe("periods index", () => {
  it("lists all eight periods with statuses and badges", () => {
    const idx = buildPeriodsIndex();
    expect(idx.map((p) => p.id)).toEqual(["2510", "2511", "2512", "2601", "2602", "2603", "2604", "2605"]);
    expect(idx.find((p) => p.id === "2604")?.status).toBe("open");
    expect(idx.find((p) => p.id === "2605")?.status).toBe("simulated");
    expect(idx.find((p) => p.id === "2605")?.source).toBe("synthetic");
  });
});
