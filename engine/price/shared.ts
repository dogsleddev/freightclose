// Shared pricing contract. Both the April accrual and the historical back-test
// feed PricingInput into the carrier modules and get back a PricedResult with a
// full, human-readable calc trace and any local exceptions.

import type {
  AccessorialCharge,
  CalcStep,
  Classification,
  ExceptionCode,
  ExceptionSeverity,
  RateSource,
} from "../types";

export interface PricingInput {
  id: string;
  date?: string;
  origin?: { city: string; state: string };
  destination: { city: string; state: string; zip: string };
  weightLbs: number; // imputed upstream if the source was blank
  residential: boolean;
  accessorials: string[]; // canonical non-residential codes
}

export interface LocalException {
  code: ExceptionCode;
  severity: ExceptionSeverity;
  message: string;
  detail?: Record<string, unknown>;
}

export interface PricedResult {
  baseCharge: number;
  fuelSurcharge: number;
  accessorials: AccessorialCharge[];
  accessorialTotal: number;
  residentialSurcharge: number;
  minChargeApplied: boolean;
  total: number;
  classification: Classification;
  calcTrace: CalcStep[];
  exceptions: LocalException[];
  rateSource: RateSource;
}

const ACCESSORIAL_LABELS: Record<string, string> = {
  liftgate: "Liftgate",
  inside: "Inside Delivery",
  appointment: "Appointment Delivery",
  saturday: "Saturday Delivery",
  residential: "Residential Delivery",
  detention: "Detention",
};

export function accessorialLabel(code: string): string {
  return ACCESSORIAL_LABELS[code] ?? code;
}

export function round2(x: number): number {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}
