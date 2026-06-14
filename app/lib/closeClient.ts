// Client-side close pipeline: CSV text -> validated, parsed inputs -> runClose.
// Runs the same deterministic engine the build runs — in the browser. Nothing
// here invents data: validation refuses unknown schemas, merges are
// dedup-by-id with counts reported, and every assumption surfaces as an
// engine exception.

import { parseCsvObjects } from "@/engine/csv";
import { parseShipments, parseInvoices } from "@/engine/parse";
import { runClose } from "@/engine/close";
import { parseMonth, monthMetaFromKey, priorMonthsInQuarter } from "@/engine/lookups";
import type { RateConfigVersion } from "@/engine/configSet";
import type { AccrualRun, Carrier, DeniseBaseline, InvoiceLine, RateSource } from "@/engine/types";
import type { StoredClose } from "./closeStore";

// --- schema validation ---------------------------------------------------------

export const SHIPMENT_COLUMNS = [
  "shipment_id", "date", "origin_city", "origin_state", "destination_city",
  "destination_state", "destination_zip", "carrier", "service_level",
  "weight_lbs", "units", "special_handling", "residential",
];

export const INVOICE_COLUMNS = [
  "invoice_id", "carrier", "service_month", "invoice_date", "shipment_ref",
  "destination_city", "destination_state", "destination_zip", "weight_lbs",
  "base_charge", "fuel_surcharge", "accessorial_fees", "accessorial_detail",
  "adjustments", "total_charge",
];

export interface CsvValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
  rowCount: number;
  monthsFound: string[]; // "YYYY-MM"
}

function headerCheck(rows: Record<string, string>[], required: string[], kind: string): string[] {
  if (!rows.length) return [`${kind}: no data rows found.`];
  const present = new Set(Object.keys(rows[0]));
  const missing = required.filter((c) => !present.has(c));
  return missing.length
    ? [`${kind}: missing required column${missing.length > 1 ? "s" : ""} ${missing.join(", ")}. Expected the challenge schema (see data/PUT_CSVS_HERE.md).`]
    : [];
}

export function validateShipmentsCsv(text: string): CsvValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  let rows: Record<string, string>[] = [];
  try {
    rows = parseCsvObjects(text);
  } catch (e) {
    return { ok: false, errors: [`Could not parse CSV: ${(e as Error).message}`], warnings, rowCount: 0, monthsFound: [] };
  }
  errors.push(...headerCheck(rows, SHIPMENT_COLUMNS, "Shipments"));
  const months = new Set<string>();
  if (!errors.length) {
    rows.forEach((r, i) => {
      if (!r["shipment_id"]?.trim()) errors.push(`Row ${i + 2}: empty shipment_id.`);
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((r["date"] ?? "").trim());
      if (!m) warnings.push(`Row ${i + 2}: date '${r["date"]}' is not YYYY-MM-DD.`);
      else months.add(`${m[1]}-${m[2]}`);
    });
    if (errors.length > 8) errors.splice(8, errors.length, "…more rows with the same problem.");
  }
  return { ok: errors.length === 0, errors, warnings: warnings.slice(0, 8), rowCount: rows.length, monthsFound: [...months].sort() };
}

export function validateInvoicesCsv(text: string): CsvValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  let rows: Record<string, string>[] = [];
  try {
    rows = parseCsvObjects(text);
  } catch (e) {
    return { ok: false, errors: [`Could not parse CSV: ${(e as Error).message}`], warnings, rowCount: 0, monthsFound: [] };
  }
  errors.push(...headerCheck(rows, INVOICE_COLUMNS, "Invoices"));
  const months = new Set<string>();
  if (!errors.length) {
    rows.forEach((r, i) => {
      if (!r["invoice_id"]?.trim()) errors.push(`Row ${i + 2}: empty invoice_id.`);
      const mk = parseMonth(r["service_month"] ?? "");
      if (!mk) warnings.push(`Row ${i + 2}: service_month '${r["service_month"]}' not recognized (expected e.g. "April 2026").`);
      else months.add(mk.key);
    });
    if (errors.length > 8) errors.splice(8, errors.length, "…more rows with the same problem.");
  }
  return { ok: errors.length === 0, errors, warnings: warnings.slice(0, 8), rowCount: rows.length, monthsFound: [...months].sort() };
}

// --- merging -------------------------------------------------------------------

export interface InvoiceMerge {
  merged: InvoiceLine[];
  added: number;
  duplicatesDropped: number;
  monthsAdded: string[];
}

/** Bundled history + uploaded lines, dedup by invoice_id (bundled wins). */
export function mergeInvoices(base: InvoiceLine[], uploaded: InvoiceLine[]): InvoiceMerge {
  const seen = new Set(base.map((i) => i.invoiceId));
  const baseMonths = new Set(base.map((i) => parseMonth(i.serviceMonth)?.key).filter(Boolean));
  const merged = [...base];
  let added = 0;
  let duplicatesDropped = 0;
  const monthsAdded = new Set<string>();
  for (const line of uploaded) {
    if (seen.has(line.invoiceId)) {
      duplicatesDropped++;
      continue;
    }
    seen.add(line.invoiceId);
    merged.push(line);
    added++;
    const mk = parseMonth(line.serviceMonth)?.key;
    if (mk && !baseMonths.has(mk)) monthsAdded.add(mk);
  }
  return { merged, added, duplicatesDropped, monthsAdded: [...monthsAdded].sort() };
}

// --- period inference ------------------------------------------------------------

export function inferPeriod(monthsFound: string[]): string | null {
  if (!monthsFound.length) return null;
  return monthsFound[monthsFound.length - 1]; // latest month in the file
}

// --- QTD carry-in from prior closes ----------------------------------------------

export interface QtdSeed {
  override?: { count: number; basis: string };
  note: string;
}

/**
 * Explicit carry-in when every prior in-quarter month has a saved close
 * (bundled April counts as a close). Otherwise the engine derives it from
 * invoice history and flags any gap.
 */
export function qtdSeedFromCloses(
  periodKey: string,
  closes: { periodKey: string; heartlandShipments: number }[]
): QtdSeed {
  const meta = monthMetaFromKey(periodKey);
  if (!meta) return { note: "invalid period" };
  if ((meta.month - 1) % 3 === 0) return { note: "quarter start — contractual reset to tier 1" };
  const prior = priorMonthsInQuarter(periodKey);
  const found = prior.map((mk) => closes.find((c) => c.periodKey === mk));
  if (found.every((c) => c !== undefined)) {
    const count = found.reduce((a, c) => a + (c?.heartlandShipments ?? 0), 0);
    const basis = prior
      .map((mk, i) => `${mk}: ${found[i]!.heartlandShipments} Heartland shipments (saved close)`)
      .join("; ");
    return { override: { count, basis }, note: `carry-in ${count} from saved close${prior.length > 1 ? "s" : ""}` };
  }
  return {
    note: `prior in-quarter month${prior.length > 1 ? "s" : ""} ${prior.join(", ")} not all closed here — engine derives carry-in from invoice history and flags gaps`,
  };
}

// --- the close itself --------------------------------------------------------------

export interface CloseRequest {
  periodKey: string;
  shipmentsCsv: string;
  invoicesCsv: string | null;
  baseInvoices: InvoiceLine[];
  denise: DeniseBaseline[];
  configVersions: RateConfigVersion[];
  rateSource?: Record<Carrier, RateSource>;
  priorCloses: { periodKey: string; heartlandShipments: number }[];
}

export interface CloseResult {
  run: AccrualRun;
  invoiceMerge: InvoiceMerge | null;
  qtdNote: string;
}

export function buildClose(req: CloseRequest): CloseResult {
  const { shipments, duplicateIds } = parseShipments(req.shipmentsCsv);
  // Only the close period's shipments are priced; refuse silent cross-month mixes.
  const inPeriod = shipments.filter((s) => s.date.startsWith(req.periodKey));
  if (!inPeriod.length) {
    throw new Error(`No shipment rows dated in ${req.periodKey} — check the period or the file.`);
  }

  let invoiceMerge: InvoiceMerge | null = null;
  let invoices = req.baseInvoices;
  if (req.invoicesCsv) {
    const uploaded = parseInvoices(req.invoicesCsv);
    invoiceMerge = mergeInvoices(req.baseInvoices, uploaded);
    invoices = invoiceMerge.merged;
  }

  const qtd = qtdSeedFromCloses(
    req.periodKey,
    req.priorCloses
  );

  const run = runClose({
    periodKey: req.periodKey,
    shipments: inPeriod,
    duplicateShipmentIds: duplicateIds.filter((id) => inPeriod.some((s) => s.shipmentId === id)),
    invoices,
    denise: req.denise,
    configVersions: req.configVersions,
    rateSource: req.rateSource,
    qtdStartOverride: qtd.override,
  });

  return { run, invoiceMerge, qtdNote: qtd.note };
}

/** Recompute a stored close from its stored inputs and compare — the audit "re-run" proof. */
export function reproduceClose(
  stored: StoredClose,
  baseInvoices: InvoiceLine[],
  denise: DeniseBaseline[],
  configVersions: RateConfigVersion[],
  priorCloses: { periodKey: string; heartlandShipments: number }[]
): { identical: boolean; recomputed: AccrualRun } {
  const { run } = buildClose({
    periodKey: stored.periodKey,
    shipmentsCsv: stored.inputs.shipmentsCsv,
    invoicesCsv: stored.inputs.invoicesCsv,
    baseInvoices,
    denise,
    configVersions,
    rateSource: stored.run.provenance?.rateSource,
    priorCloses,
  });
  return { identical: JSON.stringify(run) === JSON.stringify(stored.run), recomputed: run };
}

// --- downloads ----------------------------------------------------------------------

export function downloadText(filename: string, text: string, mime = "text/csv"): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
