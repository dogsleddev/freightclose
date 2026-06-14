// Build-time data loader. Reads the canonical period data from /data, indexed
// by /data/periods.json, normalizes serialization on ingest (Finding 0), and
// returns parsed records plus the ingest control exceptions. Used by the engine
// runner and unit tests only — never by the app (the app renders emitted JSON).
//
// For any close period, the calibration/back-test "invoice history available at
// close" = the invoices + Denise rows from every CLOSED period that precedes it.
// The period's own shipments are priced; its own invoices stay null until the
// carrier bills (April never fabricates actuals — periods.json keeps it null).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseCsvObjects } from "./csv";
import { shipmentsFromRows, invoicesFromRows, deniseFromRows } from "./parse";
import {
  newNormalizationReport,
  normalizeShipmentRows,
  normalizeInvoiceRows,
  normalizeDeniseRows,
  type NormalizationReport,
} from "./normalize";
import type { RawException } from "./accrue";
import type { ParsedShipment, InvoiceLine, DeniseBaseline } from "./types";

const DATA_DIR = join(process.cwd(), "data");

export function readData(file: string): string {
  return readFileSync(join(DATA_DIR, file), "utf8");
}

// --- periods index ---------------------------------------------------------

export interface PeriodFiles {
  shipments: string;
  invoices: string | null;
  denise: string | null;
  actuals?: string[];
  rateCards: string;
  rateCardsFuelSpike?: string;
}

export interface PeriodDef {
  id: string; // "2604"
  label: string; // "April 2026"
  period: string; // "2026-04"
  status: "closed" | "open" | "simulated";
  source: "real" | "synthetic";
  badge: string;
  files: PeriodFiles;
}

export interface PeriodsIndex {
  periods: PeriodDef[];
}

export function loadPeriodsIndex(): PeriodsIndex {
  return JSON.parse(readData("periods.json")) as PeriodsIndex;
}

// --- per-period load -------------------------------------------------------

export interface LoadedData {
  shipments: ParsedShipment[];
  duplicateShipmentIds: string[];
  invoices: InvoiceLine[];
  denise: DeniseBaseline[];
}

export interface LoadedPeriod extends LoadedData {
  periodId: string;
  periodKey: string; // "2026-04"
  periodDef: PeriodDef;
  normalization: NormalizationReport;
  ingestExceptions: RawException[];
}

function readRows(file: string): Record<string, string>[] {
  return parseCsvObjects(readData(file));
}

/**
 * Build the Finding-0 control exceptions from the normalization report. Two
 * informational records document what was rewritten on ingest; an ERROR is
 * raised if any month/date still failed to parse (calibration cannot join) —
 * the failure mode that silently sank three of the six prototype engines.
 */
export function ingestExceptionsFromReport(report: NormalizationReport): RawException[] {
  const out: RawException[] = [];

  if (report.monthsNormalized > 0 || report.datesNormalized > 0) {
    const parts: string[] = [];
    if (report.monthsNormalized > 0)
      parts.push(`${report.monthsNormalized} service-month label(s) from short form (e.g. "Oct-25") to "Month YYYY"`);
    if (report.datesNormalized > 0)
      parts.push(`${report.datesNormalized} date(s) from M/D/YYYY to ISO (so quarter-to-date ordering sequences correctly)`);
    out.push({
      code: "INGEST_SERIALIZATION_NORMALIZED",
      severity: "info",
      message:
        `Ingest normalized ${parts.join(" and ")}. Source data arrives in mixed serialization; ` +
        `normalizing on ingest lets calibration join the invoice history instead of silently defaulting the rate index to 1.0.`,
      detail: { monthsNormalized: report.monthsNormalized, datesNormalized: report.datesNormalized },
    });
  }

  if (report.unparseableMonths.length > 0) {
    const sample = report.unparseableMonths.slice(0, 5).map((u) => `${u.value} (${u.file})`);
    out.push({
      code: "CALIBRATION_JOIN_FAILED",
      severity: "error",
      message:
        `${report.unparseableMonths.length} invoice/Denise row(s) have a service month that did not parse after ` +
        `normalization (e.g. ${sample.join(", ")}). These cannot join the calibration window; rather than degrade ` +
        `silently, they are flagged for correction. Review the source file's month serialization.`,
      detail: { count: report.unparseableMonths.length, samples: report.unparseableMonths.slice(0, 10) },
    });
  }

  if (report.unparseableDates.length > 0) {
    const sample = report.unparseableDates.slice(0, 5).map((u) => `${u.value} (${u.file})`);
    out.push({
      code: "INGEST_SERIALIZATION_NORMALIZED",
      severity: "warn",
      message:
        `${report.unparseableDates.length} row(s) have a date that did not parse to ISO (e.g. ${sample.join(", ")}). ` +
        `Quarter-to-date ordering for those rows falls back to lexical order; review the source date format.`,
      detail: { count: report.unparseableDates.length, samples: report.unparseableDates.slice(0, 10) },
    });
  }

  return out;
}

/**
 * Load one period for a close: its shipments, plus the concatenated invoice +
 * Denise history from every closed period that precedes it. All serialization
 * is normalized on ingest and the transforms/failures are returned as control
 * exceptions.
 */
export function loadPeriod(periodId: string): LoadedPeriod {
  const index = loadPeriodsIndex();
  const periodDef = index.periods.find((p) => p.id === periodId);
  if (!periodDef) throw new Error(`Unknown period id '${periodId}' (not in periods.json).`);

  const report = newNormalizationReport();

  // 1) the period's own shipments (priced this close)
  const shipRows = normalizeShipmentRows(
    readRows(periodDef.files.shipments),
    periodDef.files.shipments,
    report
  );
  const { shipments, duplicateIds } = shipmentsFromRows(shipRows);

  // 2) invoice + Denise history = every CLOSED period strictly before this one
  const history = index.periods.filter(
    (p) => p.status === "closed" && p.period < periodDef.period && p.files.invoices && p.files.denise
  );

  const invoices: InvoiceLine[] = [];
  const denise: DeniseBaseline[] = [];
  for (const p of history) {
    const invRows = normalizeInvoiceRows(readRows(p.files.invoices as string), p.files.invoices as string, report);
    invoices.push(...invoicesFromRows(invRows));
    const denRows = normalizeDeniseRows(readRows(p.files.denise as string), p.files.denise as string, report);
    denise.push(...deniseFromRows(denRows));
  }

  return {
    periodId,
    periodKey: periodDef.period,
    periodDef,
    shipments,
    duplicateShipmentIds: duplicateIds,
    invoices,
    denise,
    normalization: report,
    ingestExceptions: ingestExceptionsFromReport(report),
  };
}

/**
 * Read a period's OWN invoices + Denise baseline (normalized). loadPeriod()
 * deliberately returns only the PRIOR history (for leave-one-out calibration);
 * the closed-period reconciliation needs this period's actual invoice register
 * and Denise's recorded estimate, so they are read separately here.
 */
export function loadPeriodOwn(periodId: string): { invoices: InvoiceLine[]; denise: DeniseBaseline[] } {
  const index = loadPeriodsIndex();
  const def = index.periods.find((p) => p.id === periodId);
  if (!def) throw new Error(`Unknown period id '${periodId}' (not in periods.json).`);
  const report = newNormalizationReport(); // reconciliation read; serialization already validated on the main load
  const invoices = def.files.invoices
    ? invoicesFromRows(normalizeInvoiceRows(readRows(def.files.invoices), def.files.invoices, report))
    : [];
  const denise = def.files.denise
    ? deniseFromRows(normalizeDeniseRows(readRows(def.files.denise), def.files.denise, report))
    : [];
  return { invoices, denise };
}

/** Read an actuals/invoice CSV (e.g. the May synthetic actuals), normalized. */
export function loadActualsFile(relPath: string): InvoiceLine[] {
  const report = newNormalizationReport();
  return invoicesFromRows(normalizeInvoiceRows(readRows(relPath), relPath, report));
}

/** Backwards-compatible default: the April 2026 open hero period. */
export function loadAll(): LoadedData {
  const p = loadPeriod("2604");
  return {
    shipments: p.shipments,
    duplicateShipmentIds: p.duplicateShipmentIds,
    invoices: p.invoices,
    denise: p.denise,
  };
}
