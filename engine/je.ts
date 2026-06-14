// Journal entry (accrued freight liability) + NetSuite-importable CSV export.
// One clean accrual: Dr Freight Expense (per carrier) / Cr Accrued Freight
// Liability (total). Debits tie to the carrier accruals; the entry balances.

import { engineConfig, carrierConfig } from "./config";
import { parseMonth, round2 } from "./lookups";
import type { Carrier, CarrierSummary, JournalEntry, JournalEntryLine } from "./types";

export interface JournalEntryOptions {
  periodLabel?: string; // e.g. "May 2026"; default = bundled April period
  periodEndDate?: string; // ISO date of the period end
  /**
   * "estimate" (default): the close-time accrual. "actuals": a period
   * recreated from its actual carrier invoices after the fact — recorded at
   * invoiced amounts, explicitly NOT an estimate.
   */
  basis?: "estimate" | "actuals";
}

export function buildJournalEntry(
  carrierSummaries: CarrierSummary[],
  totalAccrual: number,
  opts: JournalEntryOptions = {}
): JournalEntry {
  const acct = engineConfig.accounting;
  const period = opts.periodLabel ?? engineConfig.period.label;
  const date = opts.periodEndDate ?? engineConfig.period.periodEndDate;
  const actuals = opts.basis === "actuals";

  const lines: JournalEntryLine[] = [];
  // Debit Freight Expense, one line per carrier (carrier dimension), so the
  // entry ties to the carrier summaries and to shipment-level backup.
  for (const cs of carrierSummaries) {
    lines.push({
      account: acct.expenseAccount.number,
      accountName: acct.expenseAccount.name,
      type: "debit",
      amount: cs.accrual,
      memo: actuals
        ? `${period} outbound freight (actuals) — ${carrierConfig[cs.carrier].displayName} (${cs.shipmentCount} invoice lines, net of adjustments)`
        : `${period} outbound freight accrual — ${carrierConfig[cs.carrier].displayName} (${cs.shipmentCount} shipments${cs.creditReserve ? ", net of credit reserve" : ""})`,
      carrier: cs.carrier,
    });
  }
  // Credit Accrued Freight Liability for the total.
  lines.push({
    account: acct.liabilityAccount.number,
    accountName: acct.liabilityAccount.name,
    type: "credit",
    amount: totalAccrual,
    memo: actuals ? `${period} freight payable per carrier invoice register` : acct.entryMemo,
  });

  const totalDebits = round2(lines.filter((l) => l.type === "debit").reduce((a, l) => a + l.amount, 0));
  const totalCredits = round2(lines.filter((l) => l.type === "credit").reduce((a, l) => a + l.amount, 0));

  return {
    period,
    date,
    framework: acct.framework,
    description: actuals
      ? `Recreate ${period} outbound freight expense from actual carrier invoices (recorded at invoiced amounts net of adjustments — actuals, not an estimate). Ties line-for-line to the bundled invoice register.`
      : `Accrue ${period} outbound freight expense (FreightClose calibrated estimate). ${acct.rationale} Reverses on receipt of carrier invoices.`,
    lines,
    totalDebits,
    totalCredits,
    balanced: Math.abs(totalDebits - totalCredits) < 0.01,
  };
}

/**
 * TRUE-UP journal entry: books the signed delta between the actual invoiced and
 * the accrued estimate, once a closed period's carrier invoices arrive. Per
 * carrier the variance hits Freight Expense (Dr if under-accrued, Cr if over),
 * and the net offsets Accrued Freight Liability so the entry balances in either
 * direction. This is what makes the accrual self-correct against actuals — a
 * trailing average has nothing to true up to a shipment-level booking. NOT a
 * loss contingency; framework comes from config (matching principle).
 */
export function buildTrueUpJournalEntry(
  byCarrier: { carrier: Carrier; engine: number; actual: number }[],
  opts: { periodLabel: string; periodEndDate: string }
): JournalEntry {
  const acct = engineConfig.accounting;
  const lines: JournalEntryLine[] = [];

  let net = 0; // Σ (actual - engine); + means under-accrued
  for (const c of byCarrier) {
    const v = round2(c.actual - c.engine);
    if (Math.abs(v) < 0.005) continue;
    net = round2(net + v);
    const under = v >= 0;
    lines.push({
      account: acct.expenseAccount.number,
      accountName: acct.expenseAccount.name,
      type: under ? "debit" : "credit",
      amount: round2(Math.abs(v)),
      memo: `${opts.periodLabel} freight true-up — ${carrierConfig[c.carrier].displayName} actual vs accrued estimate (${under ? "under" : "over"}-accrued $${Math.abs(v).toFixed(2)})`,
      carrier: c.carrier,
    });
  }

  // Net offsets the accrued liability: under-accrued → Cr (raise the liability),
  // over-accrued → Dr (release it). When net == 0 the entry is empty + balanced.
  if (Math.abs(net) >= 0.005) {
    const under = net >= 0;
    lines.push({
      account: acct.liabilityAccount.number,
      accountName: acct.liabilityAccount.name,
      type: under ? "credit" : "debit",
      amount: round2(Math.abs(net)),
      memo: `${opts.periodLabel} freight accrual true-up to actual invoiced (net ${under ? "under" : "over"}-accrual $${Math.abs(net).toFixed(2)})`,
    });
  }

  const totalDebits = round2(lines.filter((l) => l.type === "debit").reduce((a, l) => a + l.amount, 0));
  const totalCredits = round2(lines.filter((l) => l.type === "credit").reduce((a, l) => a + l.amount, 0));

  return {
    period: opts.periodLabel,
    date: opts.periodEndDate,
    framework: acct.framework,
    description: `True-up of the ${opts.periodLabel} freight accrual to actual invoiced (records the estimate-to-actual variance per carrier; net adjusts Accrued Freight Liability).`,
    lines,
    totalDebits,
    totalCredits,
    balanced: Math.abs(totalDebits - totalCredits) < 0.01,
  };
}

function csvCell(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** NetSuite-importable JE CSV: one row per line, debit/credit columns. */
export function journalEntryToCsv(je: JournalEntry, opts: { externalIdSuffix?: string } = {}): string {
  const header = ["ExternalID", "Date", "JournalMemo", "Line", "Account", "AccountName", "Department", "LineMemo", "Debit", "Credit"];
  const externalId = `FREIGHTCLOSE-${parseMonth(je.period)?.key ?? je.period.replace(/\s+/g, "-").toUpperCase()}${opts.externalIdSuffix ?? ""}`;
  const rows: string[] = [header.join(",")];
  je.lines.forEach((l, i) => {
    rows.push(
      [
        externalId,
        je.date,
        je.description,
        String(i + 1),
        l.account,
        l.accountName,
        l.carrier ? carrierConfig[l.carrier].displayName : "",
        l.memo,
        l.type === "debit" ? l.amount.toFixed(2) : "",
        l.type === "credit" ? l.amount.toFixed(2) : "",
      ]
        .map((c) => csvCell(String(c)))
        .join(",")
    );
  });
  return rows.join("\n") + "\n";
}
