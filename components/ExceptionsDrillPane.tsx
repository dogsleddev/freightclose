"use client";

// Right-expanding pane that lists a set of exception flags (the Overview "Flags"
// drill-down). Mirrors DrillPane's slide-over behaviour — backdrop, focus trap,
// Esc-to-close — but renders a list of ExceptionRecords rather than one
// shipment's calc trace, and links out to the full Exceptions register.

import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui";
import { severityStyle, carrierName } from "@/app/lib/format";
import type { ExceptionRecord, ExceptionSeverity } from "@/engine/types";

const RISK: Record<ExceptionSeverity, string> = {
  error: "High · blocking",
  warn: "Medium · review",
  info: "Low · informational",
};

export function ExceptionsDrillPane({
  title,
  exceptions,
  onClose,
}: {
  title: string;
  exceptions: ExceptionRecord[] | null;
  onClose: () => void;
}) {
  const open = exceptions !== null;
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus(); // move focus into the dialog on open
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden
        className={`fixed inset-0 z-40 bg-ink/30 transition-opacity duration-200 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <aside
        role="dialog"
        aria-modal={open}
        aria-label={open ? `${title} flags` : undefined}
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!open}
      >
        {open && (
          <div className="flex flex-col gap-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Flags</div>
                <div className="mt-0.5 text-lg font-semibold text-slate-900">{title}</div>
                <div className="mt-0.5 text-sm text-slate-600">
                  {exceptions.length} flag{exceptions.length === 1 ? "" : "s"}
                </div>
              </div>
              <button
                ref={closeRef}
                onClick={onClose}
                className="rounded-md border border-slate-200 px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-50"
              >
                Close ✕
              </button>
            </div>

            {exceptions.length === 0 ? (
              <p className="text-sm text-emerald-700">No exceptions in scope — priced on clean inputs.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {exceptions.map((ex) => (
                  <li key={ex.id} className="rounded-md border border-slate-100 p-2">
                    <div className="mb-0.5 flex flex-wrap items-center gap-2">
                      <Badge className={severityStyle[ex.severity]}>{RISK[ex.severity]}</Badge>
                      <span className="font-mono text-xs text-slate-500">{ex.code}</span>
                    </div>
                    <div className="text-slate-700">{ex.message}</div>
                    {(ex.shipmentId || ex.carrier) && (
                      <div className="mt-0.5 text-xs text-slate-400">
                        {ex.shipmentId && <span className="font-mono">{ex.shipmentId}</span>}
                        {ex.shipmentId && ex.carrier ? " · " : ""}
                        {ex.carrier && <span>{carrierName[ex.carrier]}</span>}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <a
              href="/exceptions"
              className="mt-1 text-center text-xs text-slate-500 underline hover:text-slate-700"
            >
              Open Exceptions register ↗
            </a>
          </div>
        )}
      </aside>
    </>
  );
}
