// Peak Logistics: per-mile by weight tier x calibrated monthly index, + 14% FSC.
// Mileage fallback chain: calibrated -> printed table -> geo estimate, each
// non-calibrated rung flagged.

import { peakConfig, type PeakConfig } from "../config";
import { peakTier } from "../lookups";
import type { CalibratedRates } from "../calibrate";
import type { AccessorialCharge, CalcStep } from "../types";
import { accessorialLabel, round2, type LocalException, type PricedResult, type PricingInput } from "./shared";

function haversineMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function resolveMiles(
  input: PricingInput,
  rates: CalibratedRates,
  cfg: PeakConfig
): { miles: number; source: "calibrated" | "printed" | "geo"; exceptions: LocalException[] } {
  const exceptions: LocalException[] = [];
  const zip = input.destination.zip;

  const cal = rates.peakStructuralMiles[zip];
  if (cal) return { miles: cal.miles, source: "calibrated", exceptions };

  // printed mileage table (by zip, then city)
  const printed =
    cfg.printedMileageTable.find((r) => r.zip === zip) ??
    cfg.printedMileageTable.find(
      (r) => r.city.toLowerCase() === input.destination.city.toLowerCase()
    );
  if (printed) {
    exceptions.push({
      code: "MILEAGE_FALLBACK_PRINTED",
      severity: "warn",
      message: `No invoice history for ${input.destination.city} ${zip}; used printed-table mileage (${printed.miles} mi).`,
      detail: { zip, miles: printed.miles },
    });
    return { miles: printed.miles, source: "printed", exceptions };
  }

  // geo estimate: great-circle x road circuity factor
  const g = cfg.geoFallback;
  const originKey = (input.origin?.city ?? "denver").toLowerCase();
  const oc = g.centroids[originKey] ?? g.centroids["denver"];
  const dc = g.centroids[zip];
  if (oc && dc) {
    const miles = round2(haversineMiles(oc, dc) * g.circuityFactor);
    exceptions.push({
      code: "MILEAGE_FALLBACK_GEO",
      severity: "warn",
      message: `No invoice or printed mileage for ${input.destination.city} ${zip}; estimated ${miles} mi from ZIP centroids x ${g.circuityFactor} circuity.`,
      detail: { zip, miles, method: "haversine_x_circuity" },
    });
    return { miles, source: "geo", exceptions };
  }

  exceptions.push({
    code: "MILEAGE_FALLBACK_GEO",
    severity: "error",
    message: `No mileage available for ${input.destination.city} ${zip} (no invoice history, printed entry, or centroid). Priced at 0 — needs a rate-rep quote.`,
    detail: { zip },
  });
  return { miles: 0, source: "geo", exceptions };
}

export function pricePeak(
  input: PricingInput,
  rates: CalibratedRates,
  cfg: PeakConfig = peakConfig
): PricedResult {
  const exceptions: LocalException[] = [];
  const trace: CalcStep[] = [];
  const tier = peakTier(input.weightLbs, cfg);
  const { miles, source, exceptions: mileEx } = resolveMiles(input, rates, cfg);
  exceptions.push(...mileEx);

  // territory + origin assumptions
  if (!cfg.territoryStates.includes(input.destination.state)) {
    exceptions.push({
      code: "OUT_OF_TERRITORY",
      severity: "warn",
      message: `${input.destination.city}, ${input.destination.state} is outside Peak's stated territory (${cfg.territoryStates.join("/")}).`,
      detail: { state: input.destination.state },
    });
  }
  if (input.origin && input.origin.city.toLowerCase() !== cfg.originAssumption.primaryOrigin.toLowerCase()) {
    exceptions.push({
      code: "ORIGIN_ASSUMPTION",
      severity: "info",
      message: `Origin ${input.origin.city} priced at ${cfg.originAssumption.primaryOrigin}-calibrated mileage (invoice history does not separate origin).`,
      detail: { origin: input.origin.city },
    });
  }

  const structuralBase = miles * tier.ratePerMile;
  const minBase = cfg.minChargePerShipment;
  const minChargeApplied = structuralBase < minBase;
  const effBase = Math.max(structuralBase, minBase) * rates.peakIndex;
  const baseCharge = round2(effBase);
  const fuelSurcharge = round2(baseCharge * rates.peakFuelPct);

  trace.push({
    label: `Structural miles (${source})`,
    formula: `${input.destination.city} ${input.destination.zip}`,
    value: miles,
  });
  trace.push({
    label: `Base = miles x $${tier.ratePerMile}/mi (${tier.label})${minChargeApplied ? " [min charge floor]" : ""} x index ${rates.peakIndex}`,
    formula: `max(${round2(structuralBase)}, ${minBase}) x ${rates.peakIndex}`,
    value: baseCharge,
  });
  trace.push({ label: `Fuel surcharge ${(rates.peakFuelPct * 100).toFixed(1)}% of base`, formula: `${baseCharge} x ${rates.peakFuelPct}`, value: fuelSurcharge });

  const accessorials: AccessorialCharge[] = [];
  for (const code of input.accessorials) {
    const fee = cfg.accessorials[code];
    if (fee === undefined) {
      exceptions.push({ code: "RESIDENTIAL_NO_FEE", severity: "warn", message: `Accessorial '${code}' not in Peak schedule.`, detail: { code } });
      continue;
    }
    accessorials.push({ code, label: accessorialLabel(code), amount: fee });
  }
  if (input.residential) {
    const fee = cfg.accessorials["residential"] ?? 0;
    accessorials.push({ code: "residential", label: "Residential Delivery", amount: fee });
  }
  const accessorialTotal = round2(accessorials.reduce((a, x) => a + x.amount, 0));
  if (accessorialTotal > 0)
    trace.push({ label: "Accessorials (face value)", formula: accessorials.map((a) => `${a.label} $${a.amount}`).join(" + "), value: accessorialTotal });

  const total = round2(baseCharge + fuelSurcharge + accessorialTotal);
  trace.push({ label: "Shipment total", formula: `${baseCharge} + ${fuelSurcharge} + ${accessorialTotal}`, value: total });

  return {
    baseCharge,
    fuelSurcharge,
    accessorials,
    accessorialTotal,
    residentialSurcharge: 0,
    minChargeApplied,
    total,
    classification: { peakTier: tier.key, peakMiles: miles, peakMileageSource: source },
    calcTrace: trace,
    exceptions,
    rateSource: "calibrated",
  };
}
