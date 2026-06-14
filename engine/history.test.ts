// Prior months recreated from actual invoices: one balanced JE per historical
// month, tying exactly to the invoice register — and the default (estimate)
// JE wording stays byte-stable for the April close.

import { describe, expect, it } from "vitest";
import { loadAll } from "./load";
import { buildHistoricalJournals } from "./history";
import { journalEntryToCsv } from "./je";
import { runClose } from "./close";
import { parseMonth, round2 } from "./lookups";

const { invoices, shipments, duplicateShipmentIds, denise } = loadAll();
const journals = buildHistoricalJournals(invoices);

describe("historical journals (recreated from actuals)", () => {
  it("produces one entry per invoice month, in order", () => {
    expect(journals.map((j) => j.periodKey)).toEqual([
      "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03",
    ]);
    expect(journals[0].periodLabel).toBe("October 2025");
    expect(journals[0].journalEntry.date).toBe("2025-10-31");
  });

  it("every entry balances and ties exactly to the invoice register", () => {
    for (const j of journals) {
      expect(j.journalEntry.balanced).toBe(true);
      const registerTotal = round2(
        invoices
          .filter((i) => parseMonth(i.serviceMonth)?.key === j.periodKey)
          .reduce((a, l) => a + l.totalCharge, 0)
      );
      expect(j.journalEntry.totalDebits).toBe(registerTotal);
      expect(j.journalEntry.totalCredits).toBe(registerTotal);
      // one debit line per carrier + one credit
      expect(j.byCarrier.length).toBe(3);
      expect(j.journalEntry.lines.length).toBe(4);
    }
  });

  it("labels itself as actuals, not an estimate, with a distinct external id", () => {
    const je = journals[0].journalEntry;
    expect(je.description).toMatch(/actual carrier invoices/);
    expect(je.description).toMatch(/not an estimate/);
    expect(journalEntryToCsv(je, { externalIdSuffix: "-ACTUALS" })).toContain(
      "FREIGHTCLOSE-2025-10-ACTUALS"
    );
  });

  it("does not change the close-time accrual JE wording (default basis)", () => {
    const april = runClose({
      periodKey: "2026-04",
      shipments,
      duplicateShipmentIds,
      invoices,
      denise,
    });
    expect(april.journalEntry.description).toMatch(
      /^Accrue April 2026 outbound freight expense \(FreightClose calibrated estimate\)\./
    );
    expect(april.journalEntry.lines[0].memo).toContain("shipments");
    expect(april.journalEntry.lines[0].memo).not.toContain("invoice lines");
  });
});
