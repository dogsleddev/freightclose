import { describe, it, expect } from "vitest";
import { loadAll } from "./load";
import { calibrateForApril } from "./calibrate";
import { engineConfig } from "./config";
import { buildAccrual } from "./accrue";
import { buildJournalEntry, journalEntryToCsv, buildTrueUpJournalEntry } from "./je";

const { shipments, invoices } = loadAll();
const { rates } = calibrateForApril(invoices, engineConfig.calibration.recentWindowMonths);
const accrual = buildAccrual(shipments, rates);
const je = buildJournalEntry(accrual.carrierSummaries, accrual.totalAccrual);

describe("journal entry (accrued freight liability)", () => {
  it("balances and ties to the total accrual", () => {
    expect(je.balanced).toBe(true);
    expect(je.totalDebits).toBeCloseTo(je.totalCredits, 2);
    expect(je.totalDebits).toBeCloseTo(accrual.totalAccrual, 2);
  });

  it("is a single entry: Dr Freight Expense (per carrier) / Cr Accrued Freight Liability", () => {
    const debits = je.lines.filter((l) => l.type === "debit");
    const credits = je.lines.filter((l) => l.type === "credit");
    expect(debits.length).toBe(3); // one per carrier
    expect(credits.length).toBe(1);
    expect(debits.every((l) => l.account === engineConfig.accounting.expenseAccount.number)).toBe(true);
    expect(credits[0].account).toBe(engineConfig.accounting.liabilityAccount.number);
  });

  it("exports NetSuite-importable CSV with a row per line", () => {
    const csv = journalEntryToCsv(je);
    const lines = csv.trim().split("\n");
    expect(lines[0]).toContain("Debit");
    expect(lines[0]).toContain("Credit");
    expect(lines.length).toBe(je.lines.length + 1); // header + lines
  });
});

describe("true-up journal entry", () => {
  const opts = { periodLabel: "October 2025", periodEndDate: "2025-10-31" };

  it("books an under-accrual: Dr Freight Expense / Cr Accrued Liability, balanced", () => {
    const tu = buildTrueUpJournalEntry(
      [
        { carrier: "peak", engine: 1000, actual: 1200 },
        { carrier: "heartland", engine: 2000, actual: 2100 },
        { carrier: "coastal", engine: 1500, actual: 1500 }, // no delta → no line
      ],
      opts
    );
    expect(tu.balanced).toBe(true);
    expect(tu.totalDebits).toBeCloseTo(tu.totalCredits, 2);
    // net under-accrual = 300 → expense debits 300, liability credit 300
    const expenseNet = tu.lines.filter((l) => l.account === "6200").reduce((a, l) => a + (l.type === "debit" ? l.amount : -l.amount), 0);
    expect(expenseNet).toBeCloseTo(300, 2);
    const liability = tu.lines.find((l) => l.account === "21500")!;
    expect(liability.type).toBe("credit");
    expect(liability.amount).toBeCloseTo(300, 2);
    expect(tu.framework).not.toBe("ASC 450");
  });

  it("books an over-accrual (reverses): net expense credit / Dr liability, balanced", () => {
    const tu = buildTrueUpJournalEntry(
      [
        { carrier: "peak", engine: 1500, actual: 1000 },
        { carrier: "heartland", engine: 2000, actual: 1900 },
      ],
      opts
    );
    expect(tu.balanced).toBe(true);
    const expenseNet = tu.lines.filter((l) => l.account === "6200").reduce((a, l) => a + (l.type === "debit" ? l.amount : -l.amount), 0);
    expect(expenseNet).toBeCloseTo(-600, 2); // over-accrued → expense reduced
    const liability = tu.lines.find((l) => l.account === "21500")!;
    expect(liability.type).toBe("debit");
    expect(liability.amount).toBeCloseTo(600, 2);
  });

  it("is an empty, balanced entry when actuals equal the estimate", () => {
    const tu = buildTrueUpJournalEntry([{ carrier: "peak", engine: 1000, actual: 1000 }], opts);
    expect(tu.lines.length).toBe(0);
    expect(tu.balanced).toBe(true);
    expect(journalEntryToCsv(tu).trim().split("\n").length).toBe(1); // header only
  });
});
