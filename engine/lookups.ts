// Shared, config-driven classification used by both calibration and pricing:
// Peak weight tier, Heartland ZIP-prefix zone, Coastal ZIP region, and period
// (month/quarter) helpers. Keeping these in one place guarantees calibration
// and pricing classify identically.
//
// Every classifier takes an optional config argument (defaulting to the bundled
// card) so calibration can classify each historical month against the rate
// card in force THAT month when effective-dated config versions exist.

import { peakConfig, heartlandConfig, coastalConfig } from "./config";
import type { PeakConfig, HeartlandConfig, CoastalConfig } from "./config";

// --- Peak weight tier ------------------------------------------------------

export function peakTier(
  weightLbs: number,
  cfg: PeakConfig = peakConfig
): { key: string; ratePerMile: number; label: string } {
  for (const t of cfg.weightTiers) {
    if (t.maxLbs === null || weightLbs <= t.maxLbs) {
      return { key: t.key, ratePerMile: t.printedRatePerMile, label: t.label };
    }
  }
  const last = cfg.weightTiers[cfg.weightTiers.length - 1];
  return { key: last.key, ratePerMile: last.printedRatePerMile, label: last.label };
}

// --- Heartland zone (by ZIP prefix, never state) ---------------------------

export function heartlandZone(zip: string, cfg: HeartlandConfig = heartlandConfig): string | null {
  const prefix = parseInt(zip.slice(0, 3), 10);
  if (!Number.isFinite(prefix)) return null;
  for (const row of cfg.zonePrefixTable) {
    if (prefix >= row.min && prefix <= row.max) return row.zone;
  }
  return null;
}

// --- Heartland volume tier (cumulative QTD shipment index) -----------------

export function heartlandTierForQtd(
  qtdIndex: number,
  cfg: HeartlandConfig = heartlandConfig
): { tier: number; discount: number } {
  for (const t of cfg.volumeTiers) {
    if (qtdIndex >= t.minQtd && (t.maxQtd === null || qtdIndex <= t.maxQtd)) {
      return { tier: t.tier, discount: t.discount };
    }
  }
  const last = cfg.volumeTiers[cfg.volumeTiers.length - 1];
  return { tier: last.tier, discount: last.discount };
}

// --- Coastal region (by destination ZIP range) -----------------------------

export function coastalRegion(zip: string, cfg: CoastalConfig = coastalConfig): string | null {
  const z = parseInt(zip, 10);
  if (!Number.isFinite(z)) return null;
  for (const r of cfg.regions) {
    if (z >= r.zipMin && z <= r.zipMax) return r.key;
  }
  return null;
}

export function coastalResidentialFee(
  weightLbs: number,
  cfg: CoastalConfig = coastalConfig
): { fee: number; label: string } {
  for (const t of cfg.residentialSurchargeTiers) {
    if (t.maxLbs === null || weightLbs <= t.maxLbs) return { fee: t.fee, label: t.label };
  }
  const last = cfg.residentialSurchargeTiers[cfg.residentialSurchargeTiers.length - 1];
  return { fee: last.fee, label: last.label };
}

// --- period helpers --------------------------------------------------------

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface MonthMeta {
  raw: string;
  year: number;
  month: number; // 1-12
  quarter: number; // 1-4
  key: string; // "2025-10"
  quarterKey: string; // "2025-Q4"
  ordinal: number; // year*12 + month, for ordering
}

export function parseMonth(serviceMonth: string): MonthMeta | null {
  const parts = serviceMonth.trim().split(/\s+/);
  if (parts.length < 2) return null;
  const month = MONTHS.indexOf(parts[0].toLowerCase()) + 1;
  const year = parseInt(parts[1], 10);
  if (month === 0 || !Number.isFinite(year)) return null;
  const quarter = Math.floor((month - 1) / 3) + 1;
  return {
    raw: serviceMonth.trim(),
    year,
    month,
    quarter,
    key: `${year}-${String(month).padStart(2, "0")}`,
    quarterKey: `${year}-Q${quarter}`,
    ordinal: year * 12 + month,
  };
}

/** Inverse of parseMonth: "2026-05" -> MonthMeta with raw label "May 2026". */
export function monthMetaFromKey(key: string): MonthMeta | null {
  const m = /^(\d{4})-(\d{2})$/.exec(key.trim());
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  if (month < 1 || month > 12) return null;
  const quarter = Math.floor((month - 1) / 3) + 1;
  return {
    raw: `${MONTH_LABELS[month - 1]} ${year}`,
    year,
    month,
    quarter,
    key: `${year}-${String(month).padStart(2, "0")}`,
    quarterKey: `${year}-Q${quarter}`,
    ordinal: year * 12 + month,
  };
}

export function monthShortLabel(monthOneBased: number): string {
  return MONTH_SHORT[monthOneBased - 1] ?? "";
}

/** Deterministic last calendar day of a month key, ISO "YYYY-MM-DD". */
export function endOfMonthIso(key: string): string {
  const meta = monthMetaFromKey(key);
  if (!meta) return key;
  const lastDay = new Date(Date.UTC(meta.year, meta.month, 0)).getUTCDate();
  return `${meta.year}-${String(meta.month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

/** Month keys earlier in the same quarter (e.g. "2026-06" -> ["2026-04","2026-05"]). */
export function priorMonthsInQuarter(key: string): string[] {
  const meta = monthMetaFromKey(key);
  if (!meta) return [];
  const quarterStartMonth = (meta.quarter - 1) * 3 + 1;
  const out: string[] = [];
  for (let m = quarterStartMonth; m < meta.month; m++) {
    out.push(`${meta.year}-${String(m).padStart(2, "0")}`);
  }
  return out;
}

export function median(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function mean(xs: number[]): number {
  if (xs.length === 0) return NaN;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function round2(x: number): number {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}
