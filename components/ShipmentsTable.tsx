"use client";

import { useMemo, useState } from "react";
import { accrualRun } from "@/app/lib/accrual";
import { fmtUsd2, carrierName, carrierAccent, severityStyle } from "@/app/lib/format";
import { Badge } from "@/components/ui";
import { DrillPane, maxSeverity } from "@/components/DrillPane";
import type { Carrier, ShipmentEstimate } from "@/engine/types";

function classify(e: ShipmentEstimate): string {
  const c = e.classification;
  if (e.carrier === "peak") return `${c.peakTier} · ${c.peakMiles} mi (${c.peakMileageSource})`;
  if (e.carrier === "heartland") return `${c.heartlandZone} · tier ${c.heartlandTier} (${((c.heartlandDiscountPct ?? 0) * 100).toFixed(0)}% off)`;
  return `${c.coastalRegion}${e.minChargeApplied ? " · min" : ""}`;
}

export function ShipmentsTable() {
  const [carrier, setCarrier] = useState<Carrier | "all">("all");
  const [query, setQuery] = useState("");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return accrualRun.shipmentEstimates.filter(
      (e) =>
        (carrier === "all" || e.carrier === carrier) &&
        (!flaggedOnly || e.exceptionIds.length > 0) &&
        (q === "" ||
          e.shipmentId.toLowerCase().includes(q) ||
          e.destination.city.toLowerCase().includes(q) ||
          e.destination.zip.includes(q))
    );
  }, [carrier, query, flaggedOnly]);

  const flaggedCount = accrualRun.shipmentEstimates.filter((e) => e.exceptionIds.length > 0).length;
  const tabs: (Carrier | "all")[] = ["all", "peak", "heartland", "coastal"];
  // Sticky column headers freeze just below the sticky filter row. The 106px
  // offset = header 56px + the single-line filter row (~50px), so it assumes the
  // desktop layout where the filter doesn't wrap (mobile is out of scope). bg +
  // bottom shadow because border-collapse drops a sticky cell's own border.
  const stickTh = "sticky top-[106px] z-20 bg-slate-50 shadow-[0_1px_0_0_rgb(var(--slate-200))]";

  return (
    <div>
      <div className="sticky top-14 z-30 mb-4 flex flex-wrap items-center justify-between gap-3 bg-[rgb(var(--app-bg))] py-2">
        <div className="flex flex-wrap gap-1">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setCarrier(t)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                carrier === t ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {t === "all" ? "All" : carrierName[t]}
            </button>
          ))}
          <button
            onClick={() => setFlaggedOnly((f) => !f)}
            className={`ml-1 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              flaggedOnly ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Flagged only ({flaggedCount})
          </button>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search id, city, ZIP…"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-400 focus:outline-none"
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className={`py-2 pl-4 pr-2 font-medium ${stickTh}`}>Shipment</th>
              <th className={`py-2 pr-3 font-medium ${stickTh}`}>Carrier</th>
              <th className={`py-2 pr-3 font-medium ${stickTh}`}>Destination</th>
              <th className={`py-2 pr-3 text-right font-medium ${stickTh}`}>Wt</th>
              <th className={`py-2 pr-3 font-medium ${stickTh}`}>Basis</th>
              <th className={`py-2 pr-3 text-right font-medium ${stickTh}`}>Base</th>
              <th className={`py-2 pr-3 text-right font-medium ${stickTh}`}>Fuel</th>
              <th className={`py-2 pr-3 text-right font-medium ${stickTh}`}>Acc</th>
              <th className={`py-2 pr-3 text-right font-medium ${stickTh}`}>Total</th>
              <th className={`py-2 pr-4 text-center font-medium ${stickTh}`}>Flags</th>
            </tr>
          </thead>
          <tbody className="tnum">
            {rows.map((e) => {
              const sev = maxSeverity(e.exceptionIds);
              return (
                <tr
                  key={e.shipmentId}
                  onClick={() => setSelected(e.shipmentId)}
                  className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                >
                  <td className="py-1.5 pl-4 pr-2 font-mono text-xs">{e.shipmentId}</td>
                  <td className="py-1.5 pr-3">
                    <Badge className={carrierAccent[e.carrier]}>{carrierName[e.carrier].split(" ")[0]}</Badge>
                  </td>
                  <td className="py-1.5 pr-3 text-slate-600">
                    {e.destination.city}, {e.destination.state} {e.destination.zip}
                  </td>
                  <td className="py-1.5 pr-3 text-right text-slate-500">{e.weightLbs ?? "—"}</td>
                  <td className="py-1.5 pr-3 text-xs text-slate-500">{classify(e)}</td>
                  <td className="py-1.5 pr-3 text-right">{fmtUsd2(e.baseCharge)}</td>
                  <td className="py-1.5 pr-3 text-right text-slate-500">{fmtUsd2(e.fuelSurcharge)}</td>
                  <td className="py-1.5 pr-3 text-right text-slate-500">{fmtUsd2(e.accessorialTotal + e.residentialSurcharge)}</td>
                  <td className="py-1.5 pr-3 text-right font-semibold">{fmtUsd2(e.total)}</td>
                  <td className="py-1.5 pr-4 text-center">
                    {sev ? (
                      <Badge className={severityStyle[sev]}>{e.exceptionIds.length}</Badge>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        {rows.length} shipments · click any row to open its full calc trace and flags in the drill-down pane.
      </p>

      <DrillPane shipmentId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
