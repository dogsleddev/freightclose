"use client";

// Overview "Accrual by carrier" table + credit-reserve note. The Flags counts
// (per carrier and the total) open the shared exceptions pane as a right
// slide-over scoped to that carrier — or all carriers — instead of navigating
// away to the register. The pane carries a link to the full register. Renders
// the emitted run only; no recompute.

import { useState } from "react";
import Link from "next/link";
import { accrualRun } from "@/app/lib/accrual";
import { Badge } from "@/components/ui";
import { fmtUsd, fmtUsd2, fmtSignedPct, carrierName, carrierAccent } from "@/app/lib/format";
import { ExceptionsDrillPane } from "@/components/ExceptionsDrillPane";
import type { Carrier, ExceptionRecord } from "@/engine/types";

// Per-carrier Flags = exceptions attached to that carrier's shipments — the
// same roll-up the engine uses for cs.exceptionCount (engine/close.ts), so the
// pane list length matches the count shown in the cell.
const carrierOfShipment = new Map(accrualRun.shipmentEstimates.map((s) => [s.shipmentId, s.carrier]));
function flagsForCarrier(carrier: Carrier): ExceptionRecord[] {
  return accrualRun.exceptions.filter((e) => e.shipmentId && carrierOfShipment.get(e.shipmentId) === carrier);
}

type Scope = { title: string; list: ExceptionRecord[] } | null;

function FlagsButton({ count, onOpen }: { count: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="text-slate-700 underline-offset-2 hover:text-ink hover:underline"
    >
      {count}
    </button>
  );
}

export function CarrierAccrualTable() {
  const r = accrualRun;
  const [scope, setScope] = useState<Scope>(null);
  const openAll = () => setScope({ title: "All carriers", list: r.exceptions });

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-4 font-medium">Carrier</th>
              <th className="py-2 pr-4 text-right font-medium">Shipments</th>
              <th className="py-2 pr-4 text-right font-medium">Base</th>
              <th className="py-2 pr-4 text-right font-medium">Fuel</th>
              <th className="py-2 pr-4 text-right font-medium">Accessorials</th>
              <th className="py-2 pr-4 text-right font-medium">Reserve</th>
              <th className="py-2 pr-4 text-right font-medium">Accrual</th>
              <th className="py-2 pr-4 text-right font-medium">±1σ band</th>
              <th className="py-2 pr-4 text-right font-medium">Flags</th>
            </tr>
          </thead>
          <tbody className="tnum">
            {r.carrierSummaries.map((cs) => {
              const band = r.confidence.byCarrier.find((b) => b.carrier === cs.carrier)!;
              return (
                <tr key={cs.carrier} className="border-b border-slate-100">
                  <td className="py-2 pr-4">
                    <Badge className={carrierAccent[cs.carrier]}>{carrierName[cs.carrier]}</Badge>
                  </td>
                  <td className="py-2 pr-4 text-right">{cs.shipmentCount}</td>
                  <td className="py-2 pr-4 text-right">{fmtUsd(cs.base)}</td>
                  <td className="py-2 pr-4 text-right">{fmtUsd(cs.fuel)}</td>
                  <td className="py-2 pr-4 text-right">{fmtUsd(cs.accessorials + cs.residential)}</td>
                  <td className="py-2 pr-4 text-right text-slate-500">{fmtUsd2(cs.creditReserve)}</td>
                  <td className="py-2 pr-4 text-right font-semibold">{fmtUsd(cs.accrual)}</td>
                  <td className="py-2 pr-4 text-right text-xs text-slate-500">
                    {fmtUsd(band.low)}–{fmtUsd(band.high)}
                  </td>
                  <td className="py-2 pr-4 text-right">
                    <FlagsButton
                      count={cs.exceptionCount}
                      onOpen={() => setScope({ title: carrierName[cs.carrier], list: flagsForCarrier(cs.carrier) })}
                    />
                  </td>
                </tr>
              );
            })}
            <tr className="font-semibold">
              <td className="py-2 pr-4">Total</td>
              <td className="py-2 pr-4 text-right">{r.inputs.uniqueShipments}</td>
              <td className="py-2 pr-4 text-right" colSpan={3}></td>
              <td className="py-2 pr-4 text-right text-slate-500">{fmtUsd2(r.totalCreditReserve)}</td>
              <td className="py-2 pr-4 text-right">{fmtUsd(r.totalAccrual)}</td>
              <td className="py-2 pr-4 text-right text-xs text-slate-500">
                {fmtUsd(r.confidence.total.low)}–{fmtUsd(r.confidence.total.high)}
              </td>
              <td className="py-2 pr-4 text-right">
                <FlagsButton count={r.exceptions.length} onOpen={openAll} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-slate-500">
        <b>Credit reserve</b> is a small credit (≈ {fmtSignedPct(r.totalCreditReserve / (r.totalAccrual - r.totalCreditReserve))}{" "}
        of invoiced) booked every month from the carriers&apos; historical net-adjustment run-rate (post-billing
        credits and corrections), so the accrual is not systematically higher than what the carriers eventually
        invoice.{" "}
        <button type="button" onClick={openAll} className="underline-offset-2 hover:text-ink hover:underline">
          Flags
        </button>{" "}
        open the exception register in a side panel — or see the full{" "}
        <Link href="/exceptions" className="underline-offset-2 hover:text-ink hover:underline">
          Exceptions
        </Link>{" "}
        tab.
      </p>

      <ExceptionsDrillPane
        title={scope?.title ?? ""}
        exceptions={scope?.list ?? null}
        onClose={() => setScope(null)}
      />
    </>
  );
}
