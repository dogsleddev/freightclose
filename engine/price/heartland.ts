// Heartland Freight: flat zone rate (fuel included) x calibrated monthly index
// x quarterly QTD volume discount. Discount applies to base only, never
// accessorials. The QTD index (cumulative shipment count this quarter) is
// assigned by the caller, which sequences shipments by date.

import { heartlandConfig, type HeartlandConfig } from "../config";
import { heartlandZone, heartlandTierForQtd } from "../lookups";
import type { CalibratedRates } from "../calibrate";
import type { AccessorialCharge, CalcStep } from "../types";
import { accessorialLabel, round2, type LocalException, type PricedResult, type PricingInput } from "./shared";

export function priceHeartland(
  input: PricingInput,
  rates: CalibratedRates,
  opts: { qtdIndex: number },
  cfg: HeartlandConfig = heartlandConfig
): PricedResult {
  const exceptions: LocalException[] = [];
  const trace: CalcStep[] = [];

  const zone = heartlandZone(input.destination.zip, cfg);
  const { tier, discount } = heartlandTierForQtd(opts.qtdIndex, cfg);

  let baseCharge = 0;
  if (!zone) {
    exceptions.push({
      code: "UNMAPPED_ZONE",
      severity: "error",
      message: `ZIP ${input.destination.zip} (${input.destination.city}) maps to no Heartland zone prefix; cannot price base.`,
      detail: { zip: input.destination.zip },
    });
  } else {
    const printedZone = cfg.printedZoneRates[zone];
    baseCharge = round2(printedZone * rates.heartlandIndex * (1 - discount));
    trace.push({
      label: `Zone ${zone} flat rate x index ${rates.heartlandIndex} x (1 - ${(discount * 100).toFixed(0)}% QTD tier ${tier})`,
      formula: `${printedZone} x ${rates.heartlandIndex} x ${round2(1 - discount)}`,
      value: baseCharge,
    });
  }

  const accessorials: AccessorialCharge[] = [];
  for (const code of input.accessorials) {
    const fee = cfg.accessorials[code];
    if (fee === undefined) {
      exceptions.push({ code: "RESIDENTIAL_NO_FEE", severity: "warn", message: `Accessorial '${code}' not in Heartland schedule.`, detail: { code } });
      continue;
    }
    accessorials.push({ code, label: accessorialLabel(code), amount: fee });
  }
  if (input.residential) {
    exceptions.push({
      code: "RESIDENTIAL_NO_FEE",
      severity: "info",
      message: "Shipment flagged residential, but Heartland's card has no residential surcharge — no fee assessed.",
    });
  }
  const accessorialTotal = round2(accessorials.reduce((a, x) => a + x.amount, 0));
  if (accessorialTotal > 0)
    trace.push({ label: "Accessorials (no volume discount)", formula: accessorials.map((a) => `${a.label} $${a.amount}`).join(" + "), value: accessorialTotal });

  const total = round2(baseCharge + accessorialTotal);
  trace.push({ label: "Shipment total (fuel included in zone rate)", formula: `${baseCharge} + ${accessorialTotal}`, value: total });

  return {
    baseCharge,
    fuelSurcharge: 0,
    accessorials,
    accessorialTotal,
    residentialSurcharge: 0,
    minChargeApplied: false,
    total,
    classification: {
      heartlandZone: zone ?? null,
      heartlandTier: tier,
      heartlandQtdIndex: opts.qtdIndex,
      heartlandDiscountPct: discount,
    },
    calcTrace: trace,
    exceptions,
    rateSource: "calibrated",
  };
}
