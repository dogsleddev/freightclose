"use client";

// Exception register + controls. Risk level and "ready to close" status are
// derived from the engine's severity roll-up (no new engine field). Each flag
// tied to a shipment opens the shared right-pane with that shipment's full calc
// trace — the controls↔backup loop closed in one click.

import { useState } from "react";
import { accrualRun } from "@/app/lib/accrual";
import { Card, Stat, Badge, PageHeader } from "@/components/ui";
import { severityStyle, carrierName } from "@/app/lib/format";
import { DrillPane } from "@/components/DrillPane";
import type { ExceptionSeverity, ExceptionRecord } from "@/engine/types";

const SEV_ORDER: ExceptionSeverity[] = ["error", "warn", "info"];
const RISK: Record<ExceptionSeverity, string> = { error: "High · blocking", warn: "Medium · review", info: "Low · informational" };

const shipmentIds = new Set(accrualRun.shipmentEstimates.map((s) => s.shipmentId));

export function ExceptionsView() {
  const r = accrualRun;
  const [selected, setSelected] = useState<string | null>(null);
  const ready = r.exceptionsBySeverity.error === 0;

  const byCode = new Map<string, ExceptionRecord[]>();
  for (const e of r.exceptions) {
    const arr = byCode.get(e.code) ?? [];
    arr.push(e);
    byCode.set(e.code, arr);
  }
  const groups = [...byCode.entries()].sort((a, b) => {
    const sa = SEV_ORDER.indexOf(a[1][0].severity);
    const sb = SEV_ORDER.indexOf(b[1][0].severity);
    return sa - sb || b[1].length - a[1].length;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exceptions & controls"
        lead="Every fallback and assumption raises a flag — no silent defaults. An accountant who automates without controls is just automating errors faster. Click any shipment-level flag to open its full calc trace."
      />

      {/* ready-to-close control banner */}
      <div
        className={`rounded-xl border px-4 py-3 text-sm ${
          ready ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"
        }`}
      >
        <b>{ready ? "✓ Ready to close" : "✗ Not ready to close"}</b> — {r.exceptionsBySeverity.error} error
        {r.exceptionsBySeverity.error === 1 ? "" : "s"} (blocking), {r.exceptionsBySeverity.warn} warning
        {r.exceptionsBySeverity.warn === 1 ? "" : "s"} to review, {r.exceptionsBySeverity.info} informational.
        {ready ? " No blocking exceptions — the period can be signed off on Approval." : " Resolve the errors before sign-off."}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card>
          <Stat label="Total flags" value={r.exceptions.length} />
        </Card>
        <Card>
          <Stat label="Errors" value={r.exceptionsBySeverity.error} accent={r.exceptionsBySeverity.error ? "text-red-700" : "text-emerald-700"} sub="High · blocking" />
        </Card>
        <Card>
          <Stat label="Warnings" value={r.exceptionsBySeverity.warn} accent="text-amber-700" sub="Medium · review" />
        </Card>
        <Card>
          <Stat label="Info" value={r.exceptionsBySeverity.info} accent="text-slate-700" sub="Low · informational" />
        </Card>
      </div>

      {groups.map(([code, items]) => (
        <Card
          key={code}
          title={code}
          subtitle={`${items.length} occurrence${items.length > 1 ? "s" : ""} · risk ${RISK[items[0].severity]}`}
          right={<Badge className={severityStyle[items[0].severity]}>{items[0].severity}</Badge>}
        >
          <ul className="divide-y divide-slate-100 text-sm">
            {items.map((e) => {
              const linkable = !!e.shipmentId && shipmentIds.has(e.shipmentId);
              return (
                <li
                  key={e.id}
                  onClick={() => linkable && setSelected(e.shipmentId!)}
                  className={`flex items-start gap-3 py-2 ${linkable ? "cursor-pointer rounded-md hover:bg-slate-50" : ""}`}
                >
                  <span className="mt-0.5 font-mono text-xs text-slate-400">{e.id}</span>
                  <div>
                    <div className="text-slate-800">{e.message}</div>
                    <div className="mt-0.5 text-xs text-slate-400">
                      {e.shipmentId && <span className="font-mono">{e.shipmentId}</span>}
                      {e.shipmentId && e.carrier ? " · " : ""}
                      {e.carrier && <span>{carrierName[e.carrier]}</span>}
                      {linkable && <span className="ml-1 text-slate-500">· view calc trace →</span>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      ))}

      <DrillPane shipmentId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
