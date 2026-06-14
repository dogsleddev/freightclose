// Coastal Express: per-lb by region x calibrated monthly index (min charge also
// scales with the index), + 9.5% FSC on base only, + tiered residential
// surcharge (by weight, when residential), + accessorials at face value.
// Calc order: base (w/ min) -> fuel on base -> residential -> accessorials.

import { coastalConfig, type CoastalConfig } from "../config";
import { coastalRegion } from "../lookups";
import type { CalibratedRates } from "../calibrate";
import type { AccessorialCharge, CalcStep } from "../types";
import { accessorialLabel, round2, type LocalException, type PricedResult, type PricingInput } from "./shared";

export function priceCoastal(
  input: PricingInput,
  rates: CalibratedRates,
  cfg: CoastalConfig = coastalConfig
): PricedResult {
  const exceptions: LocalException[] = [];
  const trace: CalcStep[] = [];

  const regionKey = coastalRegion(input.destination.zip, cfg);
  const region = cfg.regions.find((r) => r.key === regionKey);

  let baseCharge = 0;
  let minChargeApplied = false;
  if (!region) {
    exceptions.push({
      code: "OUT_OF_TERRITORY",
      severity: "error",
      message: `ZIP ${input.destination.zip} (${input.destination.city}, ${input.destination.state}) is outside Coastal's service ranges; not served under this contract.`,
      detail: { zip: input.destination.zip },
    });
  } else {
    const structuralBase = input.weightLbs * region.printedPerLb;
    minChargeApplied = structuralBase < cfg.minChargePerShipment;
    const effBase = Math.max(structuralBase, cfg.minChargePerShipment) * rates.coastalIndex;
    baseCharge = round2(effBase);
    trace.push({
      label: `Base = ${input.weightLbs} lb x $${region.printedPerLb}/lb (${region.key})${minChargeApplied ? ` [min $${cfg.minChargePerShipment} floor]` : ""} x index ${rates.coastalIndex}`,
      formula: `max(${round2(structuralBase)}, ${cfg.minChargePerShipment}) x ${rates.coastalIndex}`,
      value: baseCharge,
    });
  }

  const fuelSurcharge = round2(baseCharge * rates.coastalFuelPct);
  trace.push({ label: `Fuel surcharge ${(rates.coastalFuelPct * 100).toFixed(1)}% of base`, formula: `${baseCharge} x ${rates.coastalFuelPct}`, value: fuelSurcharge });

  // residential surcharge (tiered by weight)
  let residentialSurcharge = 0;
  if (input.residential) {
    const tier =
      rates.coastalResidentialTiers.find((t) => t.maxLbs === null || input.weightLbs <= t.maxLbs) ??
      rates.coastalResidentialTiers[rates.coastalResidentialTiers.length - 1];
    residentialSurcharge = tier.fee;
    trace.push({ label: `Residential surcharge (${tier.label})`, formula: `weight ${input.weightLbs} lb`, value: residentialSurcharge });
  }

  const accessorials: AccessorialCharge[] = [];
  for (const code of input.accessorials) {
    const fee = cfg.accessorials[code];
    if (fee === undefined) {
      exceptions.push({ code: "RESIDENTIAL_NO_FEE", severity: "warn", message: `Accessorial '${code}' not in Coastal schedule.`, detail: { code } });
      continue;
    }
    accessorials.push({ code, label: accessorialLabel(code), amount: fee });
  }
  const accessorialTotal = round2(accessorials.reduce((a, x) => a + x.amount, 0));
  if (accessorialTotal > 0)
    trace.push({ label: "Accessorials (face value, no FSC)", formula: accessorials.map((a) => `${a.label} $${a.amount}`).join(" + "), value: accessorialTotal });

  const total = round2(baseCharge + fuelSurcharge + residentialSurcharge + accessorialTotal);
  trace.push({
    label: "Shipment total",
    formula: `${baseCharge} + ${fuelSurcharge} + ${residentialSurcharge} + ${accessorialTotal}`,
    value: total,
  });

  return {
    baseCharge,
    fuelSurcharge,
    accessorials,
    accessorialTotal,
    residentialSurcharge,
    minChargeApplied,
    total,
    classification: { coastalRegion: regionKey ?? null },
    calcTrace: trace,
    exceptions,
    rateSource: "calibrated",
  };
}
