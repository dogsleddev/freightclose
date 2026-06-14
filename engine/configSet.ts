// Effective-dated rate configuration.
//
// A ConfigSet is the full set of carrier rate tables the engine prices with.
// Rate tables change in the real world (carrier reprices a card mid-year), so
// the engine supports *versions*: each version carries an effectiveFrom month
// and the set in force for a month is the latest version at or before it.
//
// Two properties this design guarantees:
//   1. Calibration anchors each historical month to the card in force THAT
//      month, so a new card effective May never moves October's index or its
//      reconstruction — prior months stay reproducible forever.
//   2. The forward accrual prices on the target month's card x the index
//      forecast from history, so a card change moves next month's accrual the
//      way it should (numerator changes; historical indices don't).
//
// Version 0 is always the bundled /config JSON and is immutable.

import { peakConfig, heartlandConfig, coastalConfig } from "./config";
import type { PeakConfig, HeartlandConfig, CoastalConfig } from "./config";

export interface ConfigSet {
  peak: PeakConfig;
  heartland: HeartlandConfig;
  coastal: CoastalConfig;
}

export interface RateConfigVersion {
  id: string; // "v0" bundled; "v<n>-<slug>" for user versions
  effectiveFrom: string; // month key "YYYY-MM"; in force from this month onward
  note: string; // why the version exists (audit trail)
  set: ConfigSet;
}

export const bundledConfigSet: ConfigSet = {
  peak: peakConfig,
  heartland: heartlandConfig,
  coastal: coastalConfig,
};

export const BUNDLED_VERSION: RateConfigVersion = {
  id: "v0-bundled",
  effectiveFrom: "0000-01", // before everything
  note: "Bundled /config rate cards (challenge data). Immutable.",
  set: bundledConfigSet,
};

/** Latest version with effectiveFrom <= monthKey. Falls back to bundled. */
export function resolveConfigFor(
  versions: RateConfigVersion[],
  monthKey: string
): RateConfigVersion {
  const all = [BUNDLED_VERSION, ...versions.filter((v) => v.id !== BUNDLED_VERSION.id)];
  let best = BUNDLED_VERSION;
  for (const v of all) {
    if (v.effectiveFrom <= monthKey && v.effectiveFrom >= best.effectiveFrom) best = v;
  }
  return best;
}

/** Resolver closure used by calibration: month -> ConfigSet in force. */
export function configResolver(versions: RateConfigVersion[]): (monthKey: string) => ConfigSet {
  return (monthKey: string) => resolveConfigFor(versions, monthKey).set;
}

// --- validation (for user-edited / imported versions) ------------------------

export interface ConfigValidationIssue {
  path: string;
  message: string;
}

function num(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

/**
 * Structural validation of an edited ConfigSet. Not exhaustive — it checks the
 * fields pricing actually reads, so a bad edit fails loudly at save time
 * instead of silently pricing nonsense.
 */
export function validateConfigSet(set: ConfigSet): ConfigValidationIssue[] {
  const issues: ConfigValidationIssue[] = [];
  const bad = (path: string, message: string) => issues.push({ path, message });

  // Peak
  if (!set.peak?.weightTiers?.length) bad("peak.weightTiers", "at least one weight tier required");
  set.peak?.weightTiers?.forEach((t, i) => {
    if (!num(t.printedRatePerMile) || t.printedRatePerMile <= 0)
      bad(`peak.weightTiers[${i}].printedRatePerMile`, "must be a positive number");
  });
  if (!num(set.peak?.fuelSurchargePct) || set.peak.fuelSurchargePct < 0)
    bad("peak.fuelSurchargePct", "must be a non-negative number");
  if (!num(set.peak?.minChargePerShipment) || set.peak.minChargePerShipment < 0)
    bad("peak.minChargePerShipment", "must be a non-negative number");
  for (const [k, v] of Object.entries(set.peak?.accessorials ?? {}))
    if (!num(v) || v < 0) bad(`peak.accessorials.${k}`, "must be a non-negative number");

  // Heartland
  const zoneRates = set.heartland?.printedZoneRates ?? {};
  if (!Object.keys(zoneRates).length) bad("heartland.printedZoneRates", "zone rates required");
  for (const [z, v] of Object.entries(zoneRates))
    if (!num(v) || v <= 0) bad(`heartland.printedZoneRates.${z}`, "must be a positive number");
  if (!set.heartland?.zonePrefixTable?.length)
    bad("heartland.zonePrefixTable", "zone prefix table required");
  set.heartland?.volumeTiers?.forEach((t, i) => {
    if (!num(t.discount) || t.discount < 0 || t.discount >= 1)
      bad(`heartland.volumeTiers[${i}].discount`, "must be in [0, 1)");
  });
  for (const [k, v] of Object.entries(set.heartland?.accessorials ?? {}))
    if (!num(v) || v < 0) bad(`heartland.accessorials.${k}`, "must be a non-negative number");

  // Coastal
  if (!set.coastal?.regions?.length) bad("coastal.regions", "at least one region required");
  set.coastal?.regions?.forEach((r, i) => {
    if (!num(r.printedPerLb) || r.printedPerLb <= 0)
      bad(`coastal.regions[${i}].printedPerLb`, "must be a positive number");
  });
  if (!num(set.coastal?.minChargePerShipment) || set.coastal.minChargePerShipment < 0)
    bad("coastal.minChargePerShipment", "must be a non-negative number");
  if (!num(set.coastal?.fuelSurchargePct) || set.coastal.fuelSurchargePct < 0)
    bad("coastal.fuelSurchargePct", "must be a non-negative number");
  set.coastal?.residentialSurchargeTiers?.forEach((t, i) => {
    if (!num(t.fee) || t.fee < 0)
      bad(`coastal.residentialSurchargeTiers[${i}].fee`, "must be a non-negative number");
  });
  for (const [k, v] of Object.entries(set.coastal?.accessorials ?? {}))
    if (!num(v) || v < 0) bad(`coastal.accessorials.${k}`, "must be a non-negative number");

  return issues;
}
