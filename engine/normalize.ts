// Ingest-time serialization normalization (Finding 0).
//
// The canonical Ridgeline data arrives in MIXED serialization: invoice/Denise
// service months as "Oct-25" and dates as "M/D/YYYY", while the engine's month
// parser (lookups.parseMonth) and Heartland's QTD ordering both require the
// long-form "October 2025" + ISO "YYYY-MM-DD". Three of the six prototype
// engines silently collapsed their calibration on the literal "Oct-25" bytes
// (rate index → 1.0 → a materially wrong accrual booked with no warning).
//
// Freight Close refuses to degrade silently: it normalizes serialization on
// ingest AND records every transform, then raises a CONTROL EXCEPTION when any
// month/date still fails to parse so calibration can never join wrong without a
// flag. This module is pure (no FS, no clock); load.ts feeds it parsed rows.

const MONTH_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MONTH_INDEX: Record<string, number> = (() => {
  const m: Record<string, number> = {};
  MONTH_LONG.forEach((name, i) => {
    m[name.toLowerCase()] = i + 1; // full name
    m[name.slice(0, 3).toLowerCase()] = i + 1; // 3-letter abbreviation
  });
  m["sept"] = 9; // common 4-letter variant
  return m;
})();

export interface FieldNorm {
  value: string; // normalized value (or the original if it could not be normalized)
  changed: boolean; // true when the serialization was rewritten
  ok: boolean; // true when the value parses to a valid month / date
}

function expandYear(yy: number): number {
  return yy < 100 ? 2000 + yy : yy;
}

/** "Oct-25" | "Oct 2025" | "October 2025" -> canonical "October 2025". */
export function normalizeServiceMonth(raw: string | undefined): FieldNorm {
  const s = (raw ?? "").trim();
  if (!s) return { value: "", changed: false, ok: false };

  // long form already: "October 2025" (also re-canonicalizes casing)
  const long = /^([A-Za-z]+)\s+(\d{4})$/.exec(s);
  if (long) {
    const m = MONTH_INDEX[long[1].toLowerCase()];
    if (m) {
      const canonical = `${MONTH_LONG[m - 1]} ${long[2]}`;
      return { value: canonical, changed: canonical !== s, ok: true };
    }
    return { value: s, changed: false, ok: false };
  }

  // short form: "Oct-25", "Oct-2025", "Oct/25", "Oct 25"
  const short = /^([A-Za-z]{3,9})[-\s/](\d{2,4})$/.exec(s);
  if (short) {
    const m = MONTH_INDEX[short[1].toLowerCase()];
    if (m) {
      const year = expandYear(parseInt(short[2], 10));
      return { value: `${MONTH_LONG[m - 1]} ${year}`, changed: true, ok: true };
    }
  }

  return { value: s, changed: false, ok: false };
}

/** "4/19/2026" | "4/9/26" | "2026-04-19" -> canonical ISO "2026-04-19". */
export function normalizeDate(raw: string | undefined): FieldNorm {
  const s = (raw ?? "").trim();
  if (!s) return { value: "", changed: false, ok: false };

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { value: s, changed: false, ok: true };

  const mdy = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(s);
  if (mdy) {
    const month = parseInt(mdy[1], 10);
    const day = parseInt(mdy[2], 10);
    const year = expandYear(parseInt(mdy[3], 10));
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return { value: iso, changed: true, ok: true };
    }
  }

  return { value: s, changed: false, ok: false };
}

// ---------------------------------------------------------------------------
// Row-level normalization with a control report
// ---------------------------------------------------------------------------

export interface NormalizationReport {
  datesNormalized: number; // M/D/YYYY -> ISO transforms applied
  monthsNormalized: number; // "Oct-25" -> "October 2025" transforms applied
  unparseableDates: { file: string; field: string; value: string }[];
  unparseableMonths: { file: string; field: string; value: string }[];
}

export function newNormalizationReport(): NormalizationReport {
  return { datesNormalized: 0, monthsNormalized: 0, unparseableDates: [], unparseableMonths: [] };
}

function applyDate(
  rows: Record<string, string>[],
  field: string,
  file: string,
  report: NormalizationReport
) {
  for (const r of rows) {
    const before = r[field];
    if (before === undefined || before.trim() === "") continue;
    const n = normalizeDate(before);
    if (n.changed) report.datesNormalized++;
    if (!n.ok) report.unparseableDates.push({ file, field, value: before.trim() });
    r[field] = n.value;
  }
}

function applyMonth(
  rows: Record<string, string>[],
  field: string,
  file: string,
  report: NormalizationReport
) {
  for (const r of rows) {
    const before = r[field];
    if (before === undefined || before.trim() === "") continue;
    const n = normalizeServiceMonth(before);
    if (n.changed) report.monthsNormalized++;
    if (!n.ok) report.unparseableMonths.push({ file, field, value: before.trim() });
    r[field] = n.value;
  }
}

/** Normalize shipment rows in place (date -> ISO). */
export function normalizeShipmentRows(
  rows: Record<string, string>[],
  file: string,
  report: NormalizationReport
): Record<string, string>[] {
  applyDate(rows, "date", file, report);
  return rows;
}

/** Normalize invoice rows in place (service_month -> long form, invoice_date -> ISO). */
export function normalizeInvoiceRows(
  rows: Record<string, string>[],
  file: string,
  report: NormalizationReport
): Record<string, string>[] {
  applyMonth(rows, "service_month", file, report);
  applyDate(rows, "invoice_date", file, report);
  return rows;
}

/** Normalize Denise rows in place (month -> long form). */
export function normalizeDeniseRows(
  rows: Record<string, string>[],
  file: string,
  report: NormalizationReport
): Record<string, string>[] {
  applyMonth(rows, "month", file, report);
  return rows;
}
