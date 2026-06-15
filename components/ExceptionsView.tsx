"use client";

// Exception register + controls. Risk level and "ready to close" status are
// derived from the engine's severity roll-up (no new engine field). Each flag
// tied to a shipment opens the shared right-pane with that shipment's full calc
// trace. Reviewers can pin a NOTE to any flag (its disposition) — persisted to
// the browser store and carried into the approval audit trail.

import { useEffect, useState, type ReactNode } from "react";
import { accrualRun } from "@/app/lib/accrual";
import { Card, Stat, Badge, PageHeader } from "@/components/ui";
import { severityStyle, carrierName } from "@/app/lib/format";
import { DrillPane } from "@/components/DrillPane";
import { GuideLink } from "@/components/GuideLink";
import { listNotes, saveNote, deleteNote, noteKey } from "@/app/lib/closeStore";
import type { ExceptionSeverity, ExceptionRecord } from "@/engine/types";

const SEV_ORDER: ExceptionSeverity[] = ["error", "warn", "info"];
const RISK: Record<ExceptionSeverity, string> = { error: "High · blocking", warn: "Medium · review", info: "Low · informational" };

const shipmentIds = new Set(accrualRun.shipmentEstimates.map((s) => s.shipmentId));
// Notes key on (periodKey, exceptionId). Today exceptionId is the bundled run's
// positional id (EXC-####), which is stable for this static April run. If a
// recompute path is added later, key notes on a content-stable id (e.g. a hash of
// code+shipmentId+message) so a pinned note can't re-bind to a different flag.
const PERIOD_KEY = accrualRun.periodKey ?? "2026-04";

function NoteEditor({ value, onSave, onClear }: { value: string; onSave: (t: string) => void; onClear: () => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);

  if (!open && !value) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-1 text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
      >
        + Add note
      </button>
    );
  }

  if (!open && value) {
    return (
      <div className="mt-1.5 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
        <span className="mt-px font-medium">Note:</span>
        <span className="flex-1">{value}</span>
        <button onClick={() => setOpen(true)} className="font-medium text-amber-800 hover:underline">
          edit
        </button>
      </div>
    );
  }

  return (
    <div className="mt-1.5">
      <textarea
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Reviewer note — e.g. reviewed, within materiality, accept"
        rows={2}
        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs"
      />
      <div className="mt-1 flex gap-2">
        <button
          onClick={() => {
            onSave(draft.trim());
            setOpen(false);
          }}
          disabled={!draft.trim()}
          className="rounded-md bg-ink px-2.5 py-1 text-xs font-medium text-parchment hover:bg-ink/85 disabled:opacity-40"
        >
          Save note
        </button>
        <button
          onClick={() => {
            setDraft(value);
            setOpen(false);
          }}
          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
        {value && (
          <button
            onClick={() => {
              onClear();
              setOpen(false);
            }}
            className="ml-auto rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

// Stat card that, when its severity has flags, becomes a button that jumps to
// that section of the register below. Cards with a zero count stay inert. The
// enabled card mirrors Card's styling directly on the <button> (rather than
// nesting Card's <section> inside it) so the markup stays valid; aria-label
// gives screen readers an explicit "Jump to …" action name.
function StatNavCard({ enabled, label, onClick, children }: { enabled: boolean; label: string; onClick: () => void; children: ReactNode }) {
  if (!enabled) return <Card className="h-full">{children}</Card>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Jump to ${label}`}
      title={`Jump to ${label}`}
      className="block h-full w-full cursor-pointer rounded-xl border border-slate-200 bg-white text-left shadow-sm transition hover:border-slate-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
    >
      <div className="px-5 py-4">{children}</div>
    </button>
  );
}

export function ExceptionsView() {
  const r = accrualRun;
  const [selected, setSelected] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const ready = r.exceptionsBySeverity.error === 0;

  useEffect(() => {
    listNotes()
      .then((all) => {
        const map: Record<string, string> = {};
        for (const n of all) if (n.periodKey === PERIOD_KEY) map[n.exceptionId] = n.text;
        setNotes(map);
      })
      .catch(() => setNotes({}));
  }, []);

  const setNote = (exceptionId: string, text: string) => {
    saveNote({ key: noteKey(PERIOD_KEY, exceptionId), periodKey: PERIOD_KEY, exceptionId, text, updatedAt: Date.now() })
      .then(() => setNotes((m) => ({ ...m, [exceptionId]: text })))
      .catch(() => {});
  };
  const clearNote = (exceptionId: string) => {
    deleteNote(noteKey(PERIOD_KEY, exceptionId))
      .then(() =>
        setNotes((m) => {
          const next = { ...m };
          delete next[exceptionId];
          return next;
        })
      )
      .catch(() => {});
  };

  const notedCount = Object.values(notes).filter(Boolean).length;

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

  // First group of each severity gets an anchor id so the stat cards can jump to it.
  const firstGroupCodeBySev: Partial<Record<ExceptionSeverity, string>> = {};
  for (const [code, items] of groups) {
    const sev = items[0].severity;
    if (!(sev in firstGroupCodeBySev)) firstGroupCodeBySev[sev] = code;
  }
  const firstGroupSev = groups[0]?.[1][0].severity;
  const scrollToGroup = (id?: string) => {
    const target = id ? document.getElementById(id) : null;
    const fallback = firstGroupSev ? document.getElementById(`exc-${firstGroupSev}`) : null;
    (target ?? fallback)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exceptions & controls"
        lead="Every fallback and assumption raises a flag — no silent defaults. An accountant who automates without controls is just automating errors faster. Click any shipment-level flag to open its full calc trace, and pin a review note to record its disposition."
      />

      <div><GuideLink anchor="step-3" label="Step 3 · Review exceptions & controls" /></div>

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
        {notedCount > 0 && <span className="ml-1">· {notedCount} flag{notedCount === 1 ? "" : "s"} annotated.</span>}
      </div>

      {/* Summary cards freeze below the header; the title + banner above scroll away. */}
      <div className="sticky top-14 z-30 bg-[rgb(var(--app-bg))] py-3">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <StatNavCard enabled={r.exceptions.length > 0} label="Total flags" onClick={() => scrollToGroup()}>
            <Stat label="Total flags" value={r.exceptions.length} />
          </StatNavCard>
          <StatNavCard enabled={r.exceptionsBySeverity.error > 0} label="Errors" onClick={() => scrollToGroup("exc-error")}>
            <Stat label="Errors" value={r.exceptionsBySeverity.error} accent={r.exceptionsBySeverity.error ? "text-red-700" : "text-emerald-700"} sub="High · blocking" />
          </StatNavCard>
          <StatNavCard enabled={r.exceptionsBySeverity.warn > 0} label="Warnings" onClick={() => scrollToGroup("exc-warn")}>
            <Stat label="Warnings" value={r.exceptionsBySeverity.warn} accent="text-amber-700" sub="Medium · review" />
          </StatNavCard>
          <StatNavCard enabled={r.exceptionsBySeverity.info > 0} label="Info" onClick={() => scrollToGroup("exc-info")}>
            <Stat label="Info" value={r.exceptionsBySeverity.info} accent="text-slate-700" sub="Low · informational" />
          </StatNavCard>
        </div>
      </div>

      {groups.map(([code, items]) => {
        const isAnchor = firstGroupCodeBySev[items[0].severity] === code;
        return (
        <div key={code} id={isAnchor ? `exc-${items[0].severity}` : undefined} className={isAnchor ? "scroll-mt-48" : undefined}>
        <Card
          title={code}
          subtitle={`${items.length} occurrence${items.length > 1 ? "s" : ""} · risk ${RISK[items[0].severity]}`}
          right={<Badge className={severityStyle[items[0].severity]}>{items[0].severity}</Badge>}
        >
          <ul className="divide-y divide-slate-100 text-sm">
            {items.map((e) => {
              const linkable = !!e.shipmentId && shipmentIds.has(e.shipmentId);
              return (
                <li key={e.id} className="py-2">
                  <div
                    onClick={() => linkable && setSelected(e.shipmentId!)}
                    className={`flex items-start gap-3 ${linkable ? "cursor-pointer rounded-md hover:bg-slate-50" : ""}`}
                  >
                    <span className="mt-0.5 font-mono text-xs text-slate-400">{e.id}</span>
                    <div className="min-w-0">
                      <div className="text-slate-800">{e.message}</div>
                      <div className="mt-0.5 text-xs text-slate-400">
                        {e.shipmentId && <span className="font-mono">{e.shipmentId}</span>}
                        {e.shipmentId && e.carrier ? " · " : ""}
                        {e.carrier && <span>{carrierName[e.carrier]}</span>}
                        {linkable && <span className="ml-1 text-slate-500">· view calc trace →</span>}
                      </div>
                    </div>
                  </div>
                  <div className="pl-[3.25rem]">
                    <NoteEditor
                      value={notes[e.id] ?? ""}
                      onSave={(t) => setNote(e.id, t)}
                      onClear={() => clearNote(e.id)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
        </div>
        );
      })}

      <DrillPane shipmentId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
