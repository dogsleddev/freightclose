// Parse + normalize the messy transactional CSVs into typed records.
// All normalization tables come from /config (engine.json), not hardcoded here.

import { parseCsvObjects } from "./csv";
import { engineConfig } from "./config";
import {
  type Carrier,
  CARRIERS,
  type ParsedShipment,
  type InvoiceLine,
  type DeniseBaseline,
} from "./types";

const norm = engineConfig.normalization;

// --- carrier ---------------------------------------------------------------

const aliasToCarrier: Record<string, Carrier> = (() => {
  const m: Record<string, Carrier> = {};
  for (const carrier of CARRIERS) {
    for (const alias of norm.carrierAliases[carrier]) {
      m[alias.trim().toLowerCase()] = carrier;
    }
  }
  return m;
})();

export function normalizeCarrier(raw: string): Carrier | null {
  const key = raw.trim().toLowerCase();
  if (aliasToCarrier[key]) return aliasToCarrier[key];
  // fuzzy fallback on the canonical token
  for (const carrier of CARRIERS) {
    if (key.includes(carrier)) return carrier;
  }
  return null;
}

// --- service level ---------------------------------------------------------

export function normalizeService(raw: string): { service: string; known: boolean } {
  const map = norm.serviceLevelMap as Record<string, string>;
  const hit = map[raw.trim()];
  if (hit) return { service: hit, known: true };
  return { service: raw.trim() || "Unknown", known: false };
}

// --- special handling → accessorial codes ----------------------------------

const SEP = /[,/+]+/;

export function mapSpecialHandling(raw: string): {
  codes: string[];
  hasResidential: boolean;
  unmapped: string[];
} {
  const map = norm.specialHandlingMap as Record<string, string>;
  const codes: string[] = [];
  const unmapped: string[] = [];
  let hasResidential = false;
  if (!raw || !raw.trim()) return { codes, hasResidential, unmapped };
  for (const token of raw.split(SEP)) {
    const t = token.trim();
    if (!t) continue;
    const code = map[t];
    if (!code) {
      unmapped.push(t);
      continue;
    }
    if (code === "residential") {
      hasResidential = true; // residential is driven by the boolean flag, not an accessorial
      continue;
    }
    if (!codes.includes(code)) codes.push(code);
  }
  return { codes, hasResidential, unmapped };
}

// --- numeric helpers -------------------------------------------------------

export function parseNum(s: string | undefined): number {
  if (s === undefined) return 0;
  const cleaned = s.replace(/[$,\s]/g, "");
  if (cleaned === "") return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function parseWeight(s: string | undefined): number | null {
  if (s === undefined || s.trim() === "") return null;
  const n = parseNum(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function parseBool(s: string | undefined): boolean {
  return (s ?? "").trim().toUpperCase() === "TRUE";
}

// --- shipments -------------------------------------------------------------

export function parseShipments(text: string): {
  shipments: ParsedShipment[];
  duplicateIds: string[];
} {
  return shipmentsFromRows(parseCsvObjects(text));
}

/** Same as parseShipments but takes already-parsed (and ingest-normalized) rows. */
export function shipmentsFromRows(rows: Record<string, string>[]): {
  shipments: ParsedShipment[];
  duplicateIds: string[];
} {
  const seen = new Set<string>();
  const duplicateIds: string[] = [];
  const shipments: ParsedShipment[] = [];

  for (const r of rows) {
    const id = r["shipment_id"];
    const isDuplicate = seen.has(id);
    if (isDuplicate) duplicateIds.push(id);
    else seen.add(id);

    const carrier = normalizeCarrier(r["carrier"] ?? "");
    const svc = normalizeService(r["service_level"] ?? "");
    const sh = mapSpecialHandling(r["special_handling"] ?? "");

    shipments.push({
      shipmentId: id,
      date: (r["date"] ?? "").trim(),
      origin: { city: (r["origin_city"] ?? "").trim(), state: (r["origin_state"] ?? "").trim() },
      destination: {
        city: (r["destination_city"] ?? "").trim(),
        state: (r["destination_state"] ?? "").trim(),
        zip: (r["destination_zip"] ?? "").trim(),
      },
      // carrier may be null for an unknown value; we keep the row but the
      // accrual stage will flag it. Cast retains the union for downstream code.
      carrier: (carrier ?? ("peak" as Carrier)),
      carrierRaw: (r["carrier"] ?? "").trim(),
      serviceLevel: svc.service,
      serviceLevelRaw: (r["service_level"] ?? "").trim(),
      weightLbs: parseWeight(r["weight_lbs"]),
      weightImputed: false,
      units: parseNum(r["units"]),
      residential: parseBool(r["residential"]),
      accessorials: sh.codes,
      specialHandlingRaw: (r["special_handling"] ?? "").trim(),
      isDuplicate,
      _raw: r,
    });
  }

  return { shipments, duplicateIds };
}

// --- invoices --------------------------------------------------------------

export function parseInvoices(text: string): InvoiceLine[] {
  return invoicesFromRows(parseCsvObjects(text));
}

/** Same as parseInvoices but takes already-parsed (and ingest-normalized) rows. */
export function invoicesFromRows(rows: Record<string, string>[]): InvoiceLine[] {
  const out: InvoiceLine[] = [];
  for (const r of rows) {
    const carrier = normalizeCarrier(r["carrier"] ?? "");
    const detail = mapSpecialHandling(r["accessorial_detail"] ?? "");
    // For invoices, residential is billed as an accessorial line, so keep it.
    const codes = [...detail.codes];
    if (detail.hasResidential) codes.push("residential");
    out.push({
      invoiceId: (r["invoice_id"] ?? "").trim(),
      carrier: (carrier ?? ("peak" as Carrier)),
      serviceMonth: (r["service_month"] ?? "").trim(),
      invoiceDate: (r["invoice_date"] ?? "").trim(),
      shipmentRef: (r["shipment_ref"] ?? "").trim(),
      destination: {
        city: (r["destination_city"] ?? "").trim(),
        state: (r["destination_state"] ?? "").trim(),
        zip: (r["destination_zip"] ?? "").trim(),
      },
      weightLbs: parseNum(r["weight_lbs"]),
      baseCharge: parseNum(r["base_charge"]),
      fuelSurcharge: parseNum(r["fuel_surcharge"]),
      accessorialFees: parseNum(r["accessorial_fees"]),
      accessorialDetail: codes,
      accessorialDetailRaw: (r["accessorial_detail"] ?? "").trim(),
      adjustments: parseNum(r["adjustments"]),
      totalCharge: parseNum(r["total_charge"]),
    });
  }
  return out;
}

// --- denise baseline -------------------------------------------------------

export function parseDenise(text: string): DeniseBaseline[] {
  return deniseFromRows(parseCsvObjects(text));
}

/** Same as parseDenise but takes already-parsed (and ingest-normalized) rows. */
export function deniseFromRows(rows: Record<string, string>[]): DeniseBaseline[] {
  const out: DeniseBaseline[] = [];
  for (const r of rows) {
    const carrier = normalizeCarrier(r["carrier"] ?? "");
    if (!carrier) continue;
    out.push({
      month: (r["month"] ?? "").trim(),
      carrier,
      accrualEstimate: parseNum(r["accrual_estimate"]),
      actualInvoiced: parseNum(r["actual_invoiced"]),
      varianceDollars: parseNum(r["variance_dollars"]),
      variancePct: parseNum(r["variance_pct"]),
      notes: (r["notes"] ?? "").trim(),
    });
  }
  return out;
}
