// Typed access to the externalized configuration in /config.
// Nothing in the pricing logic hardcodes a rate or threshold; it all comes
// from here, so a non-engineer can edit the JSON and re-run.

import peakJson from "../config/peak.json";
import heartlandJson from "../config/heartland.json";
import coastalJson from "../config/coastal.json";
import engineJson from "../config/engine.json";
import type { Carrier, RateSource } from "./types";

export interface PeakConfig {
  carrier: "peak";
  displayName: string;
  weightTiers: { key: string; label: string; minLbs: number; maxLbs: number | null; printedRatePerMile: number }[];
  fuelSurchargePct: number;
  minChargePerShipment: number;
  accessorials: Record<string, number>;
  accessorialsCumulative: boolean;
  territoryStates: string[];
  printedMileageTable: { city: string; state: string; zip: string; miles: number }[];
  geoFallback: {
    circuityFactor: number;
    centroids: Record<string, { lat: number; lng: number }>;
  };
  originAssumption: { primaryOrigin: string };
}

export interface HeartlandConfig {
  carrier: "heartland";
  displayName: string;
  fuelSurchargePct: number;
  zonePrefixTable: { min: number; max: number; zone: string; note?: string }[];
  printedZoneRates: Record<string, number>;
  volumeTiers: { tier: number; minQtd: number; maxQtd: number | null; discount: number }[];
  volumeDiscount: {
    basis: string;
    appliesTo: string;
    appliesToAccessorials: boolean;
    prospective: boolean;
    resetDates: string[];
  };
  accessorials: Record<string, number>;
  residentialFee: number | null;
}

export interface CoastalConfig {
  carrier: "coastal";
  displayName: string;
  regions: { key: string; label: string; zipMin: number; zipMax: number; printedPerLb: number }[];
  minChargePerShipment: number;
  fuelSurchargePct: number;
  fuelSurchargeBasis: string;
  residentialSurchargeTiers: { label: string; minLbs: number; maxLbs: number | null; fee: number }[];
  accessorials: Record<string, number>;
  calcOrder: string[];
}

export interface EngineConfig {
  period: { label: string; year: number; month: number; periodEndDate: string; quarterStart: string };
  rateSource: Record<Carrier, RateSource>;
  calibration: {
    mode: "expanding" | "loo" | "full";
    modeOptions: string[];
    recentWindowMonths: number;
    creditReserve: { enabled: boolean; basis: string; note: string };
  };
  thresholds: { divergencePct: number; backtestMapeAlarmPct: number; costOutlierZ: number; materialityUsd: number };
  accounting: {
    framework: string;
    rationale: string;
    expenseAccount: { number: string; name: string };
    liabilityAccount: { number: string; name: string };
    entryMemo: string;
    reversing: boolean;
    outOfScope: string;
  };
  normalization: {
    carrierAliases: Record<Carrier, string[]>;
    serviceLevelMap: Record<string, string>;
    serviceAffectsPrice: boolean;
    specialHandlingMap: Record<string, string>;
  };
}

export const peakConfig = peakJson as unknown as PeakConfig;
export const heartlandConfig = heartlandJson as unknown as HeartlandConfig;
export const coastalConfig = coastalJson as unknown as CoastalConfig;
export const engineConfig = engineJson as unknown as EngineConfig;

export const carrierConfig = {
  peak: peakConfig,
  heartland: heartlandConfig,
  coastal: coastalConfig,
} as const;
