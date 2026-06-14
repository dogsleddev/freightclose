// Recreate prior months from the data we already have: each historical month's
// journal entry built directly from its actual invoice lines — recorded at
// invoiced amounts (net of adjustments), per carrier, balanced. These are
// actuals, not estimates: no calibration, no index, no assumptions — they tie
// line-for-line to the invoice register, which is exactly why any auditor can
// reproduce them.

import { buildJournalEntry } from "./je";
import { endOfMonthIso, parseMonth, round2 } from "./lookups";
import {
  CARRIERS,
  type Carrier,
  type CarrierSummary,
  type InvoiceLine,
  type JournalEntry,
} from "./types";

export interface HistoricalPeriodJournal {
  periodKey: string; // "2025-10"
  periodLabel: string; // "October 2025"
  basis: "actuals";
  journalEntry: JournalEntry;
  byCarrier: {
    carrier: Carrier;
    invoiceLines: number;
    base: number;
    fuel: number;
    accessorials: number;
    adjustments: number;
    total: number; // Σ totalCharge (net of adjustments)
  }[];
  invoiceLines: number;
}

/** One recreated journal entry per month present in the invoice history. */
export function buildHistoricalJournals(invoices: InvoiceLine[]): HistoricalPeriodJournal[] {
  const byMonth = new Map<string, { label: string; lines: InvoiceLine[] }>();
  for (const line of invoices) {
    const m = parseMonth(line.serviceMonth);
    if (!m) continue;
    const e = byMonth.get(m.key) ?? { label: m.raw, lines: [] };
    e.lines.push(line);
    byMonth.set(m.key, e);
  }

  return [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([periodKey, { label, lines }]) => {
      const byCarrier = CARRIERS.map((carrier) => {
        const cl = lines.filter((l) => l.carrier === carrier);
        const sum = (f: (l: InvoiceLine) => number) => round2(cl.reduce((a, l) => a + f(l), 0));
        return {
          carrier,
          invoiceLines: cl.length,
          base: sum((l) => l.baseCharge),
          fuel: sum((l) => l.fuelSurcharge),
          accessorials: sum((l) => l.accessorialFees),
          adjustments: sum((l) => l.adjustments),
          total: sum((l) => l.totalCharge),
        };
      }).filter((c) => c.invoiceLines > 0);

      const summaries: CarrierSummary[] = byCarrier.map((c) => ({
        carrier: c.carrier,
        shipmentCount: c.invoiceLines,
        base: c.base,
        fuel: c.fuel,
        accessorials: c.accessorials,
        residential: 0, // billed inside accessorial_fees on invoices
        subtotal: c.total,
        creditReserve: 0, // actuals already include adjustments — nothing to reserve
        accrual: c.total,
        backtestMape: null,
        exceptionCount: 0,
      }));
      const total = round2(byCarrier.reduce((a, c) => a + c.total, 0));

      const journalEntry = buildJournalEntry(summaries, total, {
        periodLabel: label,
        periodEndDate: endOfMonthIso(periodKey),
        basis: "actuals",
      });

      return {
        periodKey,
        periodLabel: label,
        basis: "actuals" as const,
        journalEntry,
        byCarrier,
        invoiceLines: lines.length,
      };
    });
}
