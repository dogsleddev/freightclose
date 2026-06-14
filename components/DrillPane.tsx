"use client";

// Right-expanding drill-down pane (the CLAUDE.md #9 UX). Shared by Shipment
// Backup and Exceptions: select a shipment anywhere and its full calc trace +
// flags + method summary slide in from the right. Renders emitted JSON only.

import { useEffect } from "react";
import { accrualRun } from "@/app/lib/accrual";
import { fmtUsd, fmtUsd2, carrierName, carrierAccent, severityStyle } from "@/app/lib/format";
import { Badge } from "@/components/ui";
import type { ExceptionSeverity, ShipmentEstimate } from "@/engine/types";

const exById = new Map(accrualRun.exceptions.map((e) => [e.id, e]));

const RISK: Record<ExceptionSeverity, string> = { error: "High · blocking", warn: "Medium · review", info: "Low · informational" };

function methodSummary(e: ShipmentEstimate): string {
  const c = e.classification;
  if (e.carrier === "peak") return `Per-mile · ${c.peakTier} weight tier · ${c.peakMiles} mi (${c.peakMileageSource} mileage)`;
  if (e.carrier === "heartland") return `Flat zone rate · ${c.heartlandZone} · QTD tier ${c.heartlandTier} (${((c.heartlandDiscountPct ?? 0) * 100).toFixed(0)}% volume discount)`;
  return `Per-lb · ${c.coastalRegion} region${e.minChargeApplied ? " · minimum charge applied" : ""}`;
}

export function DrillPane({ shipmentId, onClose }: { shipmentId: string | null; onClose: () => void }) {
  const e = shipmentId ? accrualRun.shipmentEstimates.find((s) => s.shipmentId === shipmentId) ?? null : null;

  useEffect(() => {
    if (!e) return;
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [e, onClose]);

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden
        className={`fixed inset-0 z-40 bg-ink/30 transition-opacity duration-200 ${e ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl transition-transform duration-200 ${
          e ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!e}
      >
        {e && (
          <div className="flex flex-col gap-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-mono text-xs text-slate-500">{e.shipmentId}</div>
                <div className="mt-0.5 text-lg font-semibold text-slate-900">{fmtUsd2(e.total)}</div>
                <div className="mt-0.5 text-sm text-slate-600">
                  {e.destination.city}, {e.destination.state} {e.destination.zip}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <Badge className={carrierAccent[e.carrier]}>{carrierName[e.carrier]}</Badge>
                <button onClick={onClose} className="rounded-md border border-slate-200 px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-50">
                  Close ✕
                </button>
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 ring-1 ring-inset ring-slate-200">
              <span className="font-medium text-slate-700">Method:</span> {methodSummary(e)}
            </div>

            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Calc trace</div>
              <ol className="space-y-1 text-sm">
                {e.calcTrace.map((s, i) => (
                  <li key={i} className="flex justify-between gap-3 border-b border-slate-100 pb-1">
                    <span className="text-slate-600">
                      {s.label} <span className="font-mono text-xs text-slate-400">{s.formula}</span>
                    </span>
                    <span className="tnum shrink-0 font-medium">{s.value.toLocaleString()}</span>
                  </li>
                ))}
                <li className="flex justify-between gap-3 pt-1 font-semibold text-slate-900">
                  <span>Shipment total</span>
                  <span className="tnum">{fmtUsd2(e.total)}</span>
                </li>
              </ol>
            </div>

            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Flags {e.exceptionIds.length > 0 && `(${e.exceptionIds.length})`}
              </div>
              {e.exceptionIds.length === 0 ? (
                <p className="text-sm text-emerald-700">No exceptions — priced on clean inputs.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {e.exceptionIds.map((id) => {
                    const ex = exById.get(id);
                    if (!ex) return null;
                    return (
                      <li key={id} className="rounded-md border border-slate-100 p-2">
                        <div className="mb-0.5 flex items-center gap-2">
                          <Badge className={severityStyle[ex.severity]}>{RISK[ex.severity]}</Badge>
                          <span className="font-mono text-xs text-slate-500">{ex.code}</span>
                        </div>
                        <span className="text-slate-700">{ex.message}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="border-t border-slate-100 pt-3 text-xs text-slate-400">
              {e.date} · {e.serviceLevel} · {e.units} units · weight {e.weightLbs ?? "imputed"} ·
              rate source {e.rateSource}
              {e.residential ? " · residential" : ""} · fuel {fmtUsd2(e.fuelSurcharge)} · accessorials{" "}
              {fmtUsd2(e.accessorialTotal + e.residentialSurcharge)}
            </div>

            <a
              href="/shipments"
              className="text-center text-xs text-slate-500 underline hover:text-slate-700"
            >
              Open in Shipment Backup ↗
            </a>
          </div>
        )}
      </aside>
    </>
  );
}

/** Max severity across a shipment's exceptions (for the row badge). */
export function maxSeverity(exceptionIds: string[]): ExceptionSeverity | null {
  let worst: ExceptionSeverity | null = null;
  const rank: Record<ExceptionSeverity, number> = { info: 1, warn: 2, error: 3 };
  for (const id of exceptionIds) {
    const ex = exById.get(id);
    if (!ex) continue;
    if (!worst || rank[ex.severity] > rank[worst]) worst = ex.severity;
  }
  return worst;
}
