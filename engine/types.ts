// FreightClose — engine type system.
// These types are the contract between the deterministic engine and the UI.
// The UI renders AccrualRun and nothing else.

export type Carrier = "peak" | "heartland" | "coastal";

export const CARRIERS: Carrier[] = ["peak", "heartland", "coastal"];

export type RateSource = "calibrated" | "printed_override";

export type ExceptionSeverity = "info" | "warn" | "error";

export type ExceptionCode =
  | "MILEAGE_FALLBACK_PRINTED"
  | "MILEAGE_FALLBACK_GEO"
  | "OUT_OF_TERRITORY"
  | "UNMAPPED_ZONE"
  | "UNMAPPED_REGION"
  | "UNKNOWN_CARRIER"
  | "UNKNOWN_SERVICE"
  | "SERVICE_PRICE_ASSUMPTION"
  | "RATE_DIVERGENCE"
  | "MIN_CHARGE_FLOOR"
  | "MISSING_WEIGHT"
  | "IMPUTED_WEIGHT"
  | "DUPLICATE_SHIPMENT"
  | "RESIDENTIAL_NO_FEE"
  | "ORIGIN_ASSUMPTION"
  | "COST_OUTLIER"
  | "BACKTEST_MAPE_HIGH"
  | "ADJUSTMENT_RESIDUAL"
  | "QTD_CARRYOVER"
  | "QTD_CARRYOVER_ASSUMED"
  | "INGEST_SERIALIZATION_NORMALIZED"
  | "CALIBRATION_JOIN_FAILED";

// ---------------------------------------------------------------------------
// Inputs (parsed + normalized from the messy CSVs)
// ---------------------------------------------------------------------------

export interface ParsedShipment {
  shipmentId: string;
  date: string; // ISO yyyy-mm-dd
  origin: { city: string; state: string };
  destination: { city: string; state: string; zip: string };
  carrier: Carrier;
  carrierRaw: string;
  serviceLevel: string; // normalized
  serviceLevelRaw: string;
  weightLbs: number | null; // null => imputed downstream + flagged
  weightImputed: boolean;
  units: number;
  residential: boolean;
  accessorials: string[]; // canonical codes, e.g. ["liftgate"]
  specialHandlingRaw: string;
  isDuplicate: boolean; // true for the dropped dupe row
  _raw: Record<string, string>;
}

export interface InvoiceLine {
  invoiceId: string;
  carrier: Carrier;
  serviceMonth: string; // e.g. "October 2025"
  invoiceDate: string;
  shipmentRef: string;
  destination: { city: string; state: string; zip: string };
  weightLbs: number;
  baseCharge: number;
  fuelSurcharge: number;
  accessorialFees: number;
  accessorialDetail: string[]; // canonical codes
  accessorialDetailRaw: string;
  adjustments: number;
  totalCharge: number;
}

export interface DeniseBaseline {
  month: string;
  carrier: Carrier;
  accrualEstimate: number;
  actualInvoiced: number;
  varianceDollars: number;
  variancePct: number;
  notes: string;
}

// ---------------------------------------------------------------------------
// Calibration
// ---------------------------------------------------------------------------

export interface PeakCalibratedMileage {
  zip: string;
  city: string;
  state: string;
  miles: number; // implied billing miles, calibrated from invoices
  source: "calibrated" | "printed" | "geo";
  lineCount: number; // invoice lines supporting it
}

export interface HeartlandZoneRate {
  zone: string;
  period: string; // service month or "calibrated"
  fullRate: number; // de-discounted Tier-1 rate
  lineCount: number;
}

export interface CoastalRegionRate {
  region: string;
  perLb: number; // calibrated effective $/lb
  lineCount: number;
}

export interface CarrierDivergence {
  carrier: Carrier;
  metric: string; // human label
  calibrated: number;
  printed: number;
  divergencePct: number; // (printed - calibrated) / calibrated
  direction: "printed_high" | "printed_low" | "match";
}

export interface RateIndexReport {
  note: string;
  byCarrierMonth: { carrier: Carrier; month: string; index: number }[];
  aprilByCarrier: Record<Carrier, number>; // index applied to the April accrual
  statsByCarrier: Record<Carrier, { mean: number; min: number; max: number }>;
}

export interface CalibrationReport {
  windowMonths: string[]; // months used to calibrate the April rates
  rateIndex: RateIndexReport;
  peak: {
    fuelSurchargePct: number;
    mileage: PeakCalibratedMileage[];
    divergence: CarrierDivergence;
  };
  heartland: {
    zoneRates: HeartlandZoneRate[]; // calibrated (recent window) full rate per zone
    perPeriodZoneRates: HeartlandZoneRate[]; // every (zone, month) for the back-test
    divergence: CarrierDivergence;
  };
  coastal: {
    fuelSurchargePct: number;
    regionRates: CoastalRegionRate[];
    residentialTiers: { label: string; fee: number }[];
    divergence: CarrierDivergence;
  };
}

// ---------------------------------------------------------------------------
// Pricing output
// ---------------------------------------------------------------------------

export interface CalcStep {
  label: string;
  formula: string;
  value: number;
}

export interface AccessorialCharge {
  code: string;
  label: string;
  amount: number;
}

export interface Classification {
  peakTier?: string;
  peakMiles?: number;
  peakMileageSource?: "calibrated" | "printed" | "geo";
  heartlandZone?: string | null;
  heartlandTier?: number;
  heartlandQtdIndex?: number;
  heartlandDiscountPct?: number;
  coastalRegion?: string | null;
  weightImputed?: boolean;
}

export interface ShipmentEstimate {
  shipmentId: string;
  carrier: Carrier;
  date: string;
  origin: { city: string; state: string };
  destination: { city: string; state: string; zip: string };
  serviceLevel: string;
  weightLbs: number | null;
  units: number;
  residential: boolean;

  classification: Classification;

  baseCharge: number;
  fuelSurcharge: number;
  accessorials: AccessorialCharge[];
  accessorialTotal: number;
  residentialSurcharge: number;
  minChargeApplied: boolean;
  total: number;

  rateSource: RateSource;
  calcTrace: CalcStep[];
  exceptionIds: string[];
}

export interface CarrierSummary {
  carrier: Carrier;
  shipmentCount: number;
  base: number;
  fuel: number;
  accessorials: number;
  residential: number;
  subtotal: number; // == sum of shipment totals
  creditReserve: number; // <= 0 (credit)
  accrual: number; // subtotal + creditReserve
  backtestMape: number | null;
  exceptionCount: number;
}

// ---------------------------------------------------------------------------
// Journal entry (accrued freight liability)
// ---------------------------------------------------------------------------

export interface JournalEntryLine {
  account: string;
  accountName: string;
  type: "debit" | "credit";
  amount: number;
  memo: string;
  carrier?: Carrier;
}

export interface JournalEntry {
  period: string;
  date: string;
  framework: string;
  description: string;
  lines: JournalEntryLine[];
  totalDebits: number;
  totalCredits: number;
  balanced: boolean;
}

// ---------------------------------------------------------------------------
// Back-test
// ---------------------------------------------------------------------------

export interface BackTestCell {
  carrier: Carrier;
  month: string;
  engineEstimate: number;
  actual: number;
  engineErrorDollars: number;
  engineErrorPct: number; // signed
  deniseEstimate: number;
  deniseErrorDollars: number;
  deniseErrorPct: number; // signed
  winner: "engine" | "denise" | "tie";
}

export interface BackTestReport {
  mode: "expanding" | "loo" | "full";
  modeNote: string;
  cells: BackTestCell[];
  byCarrier: Record<
    Carrier,
    {
      engineMape: number;
      deniseMape: number;
      engineBias: number; // signed mean error (accrual bias)
      deniseBias: number;
      engineWins: number;
      months: number;
    }
  >;
  overall: {
    engineMape: number;
    deniseMape: number;
    engineBias: number;
    deniseBias: number;
    engineWins: number;
    months: number;
  };
  reconstruction: {
    // full-sample tie-to-the-cent proof (pricing-mechanics validation)
    note: string;
    byCarrierMonthMaxErrorDollars: number;
    tiedToActual: boolean;
  };
}

// ---------------------------------------------------------------------------
// Exceptions + tie-outs
// ---------------------------------------------------------------------------

export interface ExceptionRecord {
  id: string;
  code: ExceptionCode;
  severity: ExceptionSeverity;
  carrier?: Carrier;
  shipmentId?: string;
  message: string;
  detail?: Record<string, unknown>;
}

export interface TieOutResult {
  name: string;
  expected: number;
  actual: number;
  passed: boolean;
  toleranceUsd: number;
}

// ---------------------------------------------------------------------------
// Top-level emitted artifact
// ---------------------------------------------------------------------------

export interface AccrualRun {
  generatedAtNote: string; // deterministic; no wall-clock baked into figures
  period: string;
  periodKey?: string; // "YYYY-MM" (absent on pre-multi-period artifacts)
  periodEndDate: string;
  framework: string;
  /** Reproducibility provenance: which config version + inputs produced this run. */
  provenance?: {
    engineVersion: string;
    configVersionId: string;
    configEffectiveFrom: string;
    rateSource: Record<Carrier, RateSource>;
    qtdStart?: { count: number; basis: string };
  };
  inputs: {
    shipmentRows: number;
    uniqueShipments: number;
    invoiceLines: number;
    invoicesThrough: string;
  };
  rateSource: Record<Carrier, RateSource>;
  calibration: CalibrationReport;
  shipmentEstimates: ShipmentEstimate[];
  carrierSummaries: CarrierSummary[];
  totalSubtotal: number;
  totalCreditReserve: number;
  totalAccrual: number;
  confidence: {
    note: string;
    byCarrier: { carrier: Carrier; accrual: number; cvPct: number; low: number; high: number }[];
    total: { low: number; high: number };
  };
  deniseApril: {
    note: string;
    byCarrier: { carrier: Carrier; freightClose: number; denise: number; delta: number }[];
    totalFreightClose: number;
    totalDenise: number;
  };
  journalEntry: JournalEntry;
  exceptions: ExceptionRecord[];
  exceptionsBySeverity: Record<ExceptionSeverity, number>;
  backtest: BackTestReport;
  tieOuts: TieOutResult[];
  allTieOutsPassed: boolean;
}

// ---------------------------------------------------------------------------
// Multi-period: period index + closed-period three-way reconciliation
// ---------------------------------------------------------------------------

/** One row of the emitted period index (drives the UI period navigation/badges). */
export interface PeriodsIndexEntry {
  id: string; // "2510"
  label: string; // "October 2025"
  periodKey: string; // "2025-10"
  status: "closed" | "open" | "simulated";
  source: "real" | "synthetic";
  badge: string; // "Reconstructed from invoices" | "Simulated period" | ""
}

/** Per-carrier reconciliation of the engine's (leave-one-out) estimate to actual. */
export interface ClosedPeriodCarrierRecon {
  carrier: Carrier;
  engine: number; // engine accrual estimate (calibrated from prior months only)
  actual: number; // actual invoiced (this period's own invoice register, net of adjustments)
  varianceDollars: number; // actual - engine
  variancePct: number; // signed, vs actual
}

/**
 * A closed month's three-way reconciliation: the engine's honest (leave-one-out)
 * estimate vs the actual invoiced, the variance, and a balanced TRUE-UP journal
 * entry that books the delta. The Denise leg is isolated under `denise` so the
 * neutral reconciliation surface can render the engine-vs-actual view without any
 * vs-Denise content (Denise stays quarantined to the Denise Comparison tab).
 */
export interface ClosedPeriodReconciliation {
  periodId: string; // "2510"
  periodKey: string; // "2025-10"
  label: string; // "October 2025"
  status: "closed";
  source: "real";
  badge: string; // "Reconstructed from invoices"
  isColdStart: boolean; // true for the first closed month (no prior history → printed-card index)
  engineTotal: number; // Σ engine accrual estimate
  actualTotal: number; // Σ actual invoiced (own register, net of adjustments)
  varianceDollars: number; // actualTotal - engineTotal
  variancePct: number; // signed, vs actualTotal
  byCarrier: ClosedPeriodCarrierRecon[]; // Denise-free engine-vs-actual
  trueUpJournal: JournalEntry; // signed delta entry (under/over-accrual), balanced
  actualsJournal: JournalEntry; // the recreated actuals entry for this month
  actualsReconcileToDenise: boolean; // CONTROL: invoice register ties to Denise's recorded actual_invoiced (to the cent)
  /**
   * QUARANTINED — engine-vs-Denise-vs-actual three-way, consumed ONLY by the
   * Denise Comparison tab. Never rendered on the neutral reconciliation surface.
   */
  denise: {
    totalDenise: number;
    byCarrier: {
      carrier: Carrier;
      engine: number;
      denise: number;
      actual: number;
      engineErrPct: number; // signed engine error vs actual
      deniseErrPct: number; // signed Denise error vs actual
    }[];
  };
}

// ---------------------------------------------------------------------------
// May 2026 — synthetic adaptability scenario (two rate environments)
// ---------------------------------------------------------------------------

export interface MayVariantCarrier {
  carrier: Carrier;
  engine: number; // engine accrual estimate
  actual: number; // simulated actual invoiced
  varianceDollars: number; // actual - engine
  variancePct: number; // signed, vs actual
}

export interface MayVariant {
  key: "nochange" | "fuelspike";
  title: string;
  isScenarioOverride: boolean; // true for the fuel-spike variant (forward rate-change override applied)
  peakFuelPct: number; // the Peak fuel % used (calibrated ~14% or overridden 19%)
  engineTotal: number;
  actualTotal: number;
  varianceDollars: number;
  variancePct: number;
  byCarrier: MayVariantCarrier[];
  trueUpJournal: JournalEntry;
  divergenceNote: string | null; // the rate-override flag message (fuel-spike only)
}

/**
 * The May adaptability demo: the SAME 160 synthetic shipments priced under two
 * rate environments — a no-change baseline (Peak fuel calibrated ~14%) and an
 * announced Peak fuel-surcharge spike (→19%) applied via the scenario override.
 * Synthetic + badged; never mixed with the real periods.
 */
export interface MayScenario {
  periodId: string; // "2605"
  periodKey: string; // "2026-05"
  label: string; // "May 2026"
  status: "simulated";
  source: "synthetic";
  badge: string; // "Simulated period"
  shipmentCount: number;
  calibratedPeakFuelPct: number; // calibrated from invoice history
  scenarioPeakFuelPct: number; // the announced spike (0.19)
  variants: MayVariant[]; // [nochange, fuelspike]
  engineSpikeUplift: number; // fuelspike.engineTotal − nochange.engineTotal (what the override books)
  actualSpikeDelta: number; // fuelspike.actualTotal − nochange.actualTotal (≈ $2,971, all Peak fuel)
  blindUnderAccrual: number; // fuelspike.actualTotal − nochange.engineTotal (what a spike-blind estimate misses)
}
