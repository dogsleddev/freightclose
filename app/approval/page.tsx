"use client";

// Approval — the sign-off that closes a period. Auto-evaluated control gates
// (tie-outs, JE balance, exception register, reconstruction) must all pass; the
// approver then attests the manual reviews and signs. On approval the period
// LOCKS and its run is archived (recomputable from the stored inputs) with
// downloadable JE / shipment backup / portable HTML. Every approve and reopen is
// recorded, timestamped, in an append-only audit log — re-opening loses nothing.
// Client-side (IndexedDB) — no server.

import { useCallback, useEffect, useMemo, useState } from "react";
import { accrualRun } from "@/app/lib/accrual";
import { Card, Badge, Stat, PageHeader } from "@/components/ui";
import { fmtUsd, fmtUsd2 } from "@/app/lib/format";
import { downloadText } from "@/app/lib/closeClient";
import { GuideLink } from "@/components/GuideLink";
import {
  listCloses,
  listApprovals,
  listApprovalEvents,
  saveApprovalWithEvent,
  reopenWithEvent,
  type StoredClose,
  type PeriodApproval,
  type ApprovalEvent,
} from "@/app/lib/closeStore";
import { journalEntryToCsv } from "@/engine/je";
import { shipmentBackupCsv } from "@/engine/close";
import type { AccrualRun } from "@/engine/types";

interface Gate {
  label: string;
  ok: boolean;
  detail: string;
}

function autoGates(run: AccrualRun): Gate[] {
  const failed = run.tieOuts.filter((t) => !t.passed).length;
  const sev = run.exceptionsBySeverity;
  return [
    {
      label: `All ${run.tieOuts.length} control tie-outs pass`,
      ok: run.allTieOutsPassed,
      detail: failed ? `${failed} failing` : "JE balances · carrier sums tie · reconstruction ties",
    },
    {
      label: "Journal entry balances (Σ debits = Σ credits)",
      ok: run.journalEntry.balanced,
      detail: `${fmtUsd2(run.journalEntry.totalDebits)} = ${fmtUsd2(run.journalEntry.totalCredits)}`,
    },
    {
      label: "No unresolved errors in the exception register",
      ok: sev.error === 0,
      detail: `${sev.error} error · ${sev.warn} warn · ${sev.info} info`,
    },
    {
      label: "Back-test reconstruction ties to actual invoices",
      ok: run.backtest.reconstruction.tiedToActual,
      detail: `max ±${fmtUsd2(run.backtest.reconstruction.byCarrierMonthMaxErrorDollars)} across ${run.inputs.invoiceLines} invoices`,
    },
  ];
}

const ATTESTATIONS = [
  { key: "exceptions", label: "I have reviewed every exception flag and accept the imputations/assumptions as booked." },
  { key: "carriers", label: "I have reviewed the per-carrier accrual and the ±1σ confidence band." },
  { key: "backup", label: "Shipment-level backup ties to the booked journal entry; the estimate is supportable." },
] as const;

export default function ApprovalPage() {
  const aprilKey = accrualRun.periodKey ?? "2026-04";
  const [closes, setCloses] = useState<StoredClose[]>([]);
  const [approvals, setApprovals] = useState<PeriodApproval[]>([]);
  const [events, setEvents] = useState<ApprovalEvent[]>([]);
  const [sel, setSel] = useState(aprilKey);
  const [cfo, setCfo] = useState("");
  const [att, setAtt] = useState<Record<string, boolean>>({});
  const [writeErr, setWriteErr] = useState<string | null>(null);

  const refresh = useCallback(() => {
    listCloses().then(setCloses).catch(() => setCloses([]));
    listApprovals().then(setApprovals).catch(() => setApprovals([]));
    listApprovalEvents().then(setEvents).catch(() => setEvents([]));
  }, []);
  useEffect(refresh, [refresh]);

  // periods available to approve: the bundled April hero + any saved closes
  const periods = useMemo(() => {
    const april = { periodKey: aprilKey, run: accrualRun as AccrualRun };
    const rest = closes.filter((c) => c.periodKey !== aprilKey).map((c) => ({ periodKey: c.periodKey, run: c.run }));
    return [april, ...rest].sort((a, b) => a.periodKey.localeCompare(b.periodKey));
  }, [closes, aprilKey]);

  const current = periods.find((p) => p.periodKey === sel) ?? periods[0];
  const run = current.run;
  const slug = run.period.toLowerCase().replace(/\s+/g, "-");
  const approval = approvals.find((a) => a.periodKey === current.periodKey);
  const periodEvents = events.filter((e) => e.periodKey === current.periodKey).sort((a, b) => b.at - a.at);
  const gates = autoGates(run);
  const gatesPass = gates.every((g) => g.ok);
  const attestOk = ATTESTATIONS.every((a) => att[a.key]);
  const canApprove = !approval && gatesPass && attestOk && cfo.trim().length > 1;
  const hasPortable = current.periodKey === aprilKey; // portable archive emitted for the April hero

  // reset the form when switching periods
  useEffect(() => {
    setCfo("");
    setAtt({});
  }, [sel]);

  // Collision-proof event id: millisecond timestamp + a random suffix, so two
  // events in the same period never share a key (add() would otherwise throw).
  const eventId = (now: number) => `${current.periodKey}:${now}:${Math.random().toString(36).slice(2, 10)}`;

  const approve = () => {
    const now = Date.now();
    const who = cfo.trim();
    const record: PeriodApproval = {
      periodKey: current.periodKey,
      period: run.period,
      approvedBy: who,
      approvedAt: now,
      totalAccrual: run.totalAccrual,
      checklist: [
        ...gates.map((g) => ({ label: g.label, ok: g.ok, auto: true })),
        ...ATTESTATIONS.map((a) => ({ label: a.label, ok: true, auto: false })),
      ],
      runSnapshot: run,
    };
    const ev: ApprovalEvent = {
      id: eventId(now),
      periodKey: current.periodKey,
      period: run.period,
      action: "approved",
      actor: who,
      at: now,
      totalAccrual: run.totalAccrual,
    };
    setWriteErr(null);
    saveApprovalWithEvent(record, ev)
      .then(refresh)
      .catch((e) => setWriteErr(`Could not save the approval — nothing was locked. ${String(e)}`));
  };

  const unlock = () => {
    const who = window.prompt(
      `Re-open ${run.period}? The lock is removed, but the approval stays in the audit log (nothing is lost).\n\nEnter your name/initials for the audit trail:`
    );
    if (who === null) return; // cancelled
    const now = Date.now();
    const ev: ApprovalEvent = {
      id: eventId(now),
      periodKey: current.periodKey,
      period: run.period,
      action: "reopened",
      actor: who.trim() || "—",
      at: now,
      totalAccrual: run.totalAccrual,
    };
    setWriteErr(null);
    reopenWithEvent(current.periodKey, ev)
      .then(refresh)
      .catch((e) => setWriteErr(`Could not re-open the period. ${String(e)}`));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approval & period lock"
        lead="The controlled close-out: every automated control gate must pass, the approver attests the manual reviews, and on sign-off the period locks and its run is archived — recomputable to the cent from the stored inputs, with a NetSuite JE, shipment-level backup, and a portable HTML snapshot. Approvals and re-opens are logged with a timestamp; nothing is lost."
      />

      <div><GuideLink anchor="step-7" label="Step 7 · Approve & lock the period" /></div>

      {writeErr && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {writeErr}
        </div>
      )}

      {/* period selector */}
      <div className="flex flex-wrap items-center gap-1.5">
        {periods.map((p) => {
          const locked = approvals.some((a) => a.periodKey === p.periodKey);
          return (
            <button
              key={p.periodKey}
              onClick={() => setSel(p.periodKey)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                p.periodKey === sel ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {p.run.period}
              {locked && <span className="ml-1.5" role="img" aria-label="locked">🔒</span>}
            </button>
          );
        })}
      </div>

      {/* status */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <Stat label={`${run.period} accrual`} value={fmtUsd(run.totalAccrual)} sub={`net of ${fmtUsd2(run.totalCreditReserve)} credit reserve`} />
        </Card>
        <Card>
          <Stat
            label="Control gates"
            value={`${gates.filter((g) => g.ok).length} / ${gates.length} pass`}
            accent={gatesPass ? "text-emerald-700" : "text-red-700"}
            sub={gatesPass ? "all automated checks green" : "resolve failing gates before sign-off"}
          />
        </Card>
        <Card>
          <Stat
            label="Status"
            value={approval ? "Locked" : "Open — awaiting approval"}
            accent={approval ? "text-emerald-700" : "text-amber-700"}
            sub={approval ? `${approval.approvedBy} · ${new Date(approval.approvedAt).toLocaleString()}` : "not yet signed off"}
          />
        </Card>
      </div>

      {approval ? (
        <Card
          title={`🔒 ${run.period} — locked`}
          subtitle={`Approved by ${approval.approvedBy} on ${new Date(approval.approvedAt).toLocaleString()} · accrual ${fmtUsd2(approval.totalAccrual)}`}
          right={<Badge className="bg-emerald-100 text-emerald-800 ring-emerald-200">approved &amp; locked</Badge>}
        >
          <p className="text-sm leading-relaxed text-slate-600">
            The period is closed. Its run is archived and reproduces to the cent from the stored inputs (see the
            re-run audit on Run a close). The full archive is available below.
          </p>
          <ul className="mt-3 space-y-1 text-sm text-slate-700">
            {approval.checklist.map((c, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-emerald-600">✓</span>
                <span>
                  {c.label} <span className="text-xs text-slate-400">{c.auto ? "(automated control)" : "(attestation)"}</span>
                </span>
              </li>
            ))}
          </ul>
          <ArchiveDownloads run={run} slug={slug} hasPortable={hasPortable} approval={approval} />
          <div className="mt-4 border-t border-slate-100 pt-3 text-right">
            <button onClick={unlock} className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50">
              Re-open period (unlock)
            </button>
          </div>
        </Card>
      ) : (
        <>
          <Card title="Sign-off checklist" subtitle="Automated control gates — all must pass before the period can be approved.">
            <ul className="space-y-2">
              {gates.map((g, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <Badge className={g.ok ? "bg-emerald-100 text-emerald-800 ring-emerald-200" : "bg-red-100 text-red-800 ring-red-200"}>
                    {g.ok ? "PASS" : "FAIL"}
                  </Badge>
                  <span className="text-slate-800">
                    {g.label}
                    <span className="ml-2 text-xs text-slate-500">{g.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Attestation & sign-off" subtitle="Confirm the manual reviews and sign to lock the period.">
            <ul className="space-y-2">
              {ATTESTATIONS.map((a) => (
                <li key={a.key} className="flex items-start gap-2 text-sm">
                  <input
                    id={a.key}
                    type="checkbox"
                    checked={!!att[a.key]}
                    onChange={(e) => setAtt((s) => ({ ...s, [a.key]: e.target.checked }))}
                    className="mt-0.5 h-4 w-4"
                  />
                  <label htmlFor={a.key} className="text-slate-700">{a.label}</label>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap items-end gap-4 border-t border-slate-100 pt-4">
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Approver</span>
                <input
                  type="text"
                  value={cfo}
                  onChange={(e) => setCfo(e.target.value)}
                  placeholder="Name / initials"
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
              </label>
              {!gatesPass && <p className="text-xs text-red-700">A control gate is failing — resolve it before sign-off.</p>}
              <button
                disabled={!canApprove}
                onClick={approve}
                className="ml-auto rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-parchment transition enabled:hover:bg-ink/85 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Approve &amp; lock {run.period}
              </button>
            </div>
          </Card>
        </>
      )}

      {periodEvents.length > 0 && (
        <Card
          title="Approval audit trail"
          subtitle="Every approval and re-open for this period — append-only and timestamped. Re-opening removes the lock but never the history."
        >
          <ul className="space-y-2 text-sm">
            {periodEvents.map((ev) => (
              <li key={ev.id} className="flex items-start gap-3">
                <Badge
                  className={
                    ev.action === "approved"
                      ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
                      : "bg-amber-100 text-amber-800 ring-amber-200"
                  }
                >
                  {ev.action === "approved" ? "approved" : "re-opened"}
                </Badge>
                <span className="text-slate-700">
                  {ev.action === "approved" ? "Signed off by " : "Re-opened by "}
                  <span className="font-medium">{ev.actor || "—"}</span>
                  {ev.action === "approved" && (
                    <span className="text-slate-500"> · accrual {fmtUsd2(ev.totalAccrual)}</span>
                  )}
                </span>
                <span className="ml-auto whitespace-nowrap text-xs text-slate-400">
                  {new Date(ev.at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function ArchiveDownloads({
  run,
  slug,
  hasPortable,
  approval,
}: {
  run: AccrualRun;
  slug: string;
  hasPortable: boolean;
  approval: PeriodApproval;
}) {
  return (
    <div className="mt-4 border-t border-slate-100 pt-3">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Archive</div>
      <div className="flex flex-wrap gap-2">
        <button
          className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          onClick={() => downloadText(`freightclose-je-${slug}.csv`, journalEntryToCsv(run.journalEntry))}
        >
          JE (NetSuite CSV)
        </button>
        <button
          className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          onClick={() => downloadText(`freightclose-shipment-backup-${slug}.csv`, shipmentBackupCsv(run))}
        >
          Shipment backup CSV
        </button>
        {hasPortable && (
          <a
            href={`/freightclose-archive-${slug}.html`}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Portable HTML archive ↗
          </a>
        )}
        <button
          className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          onClick={() => downloadText(`freightclose-approval-${slug}.json`, JSON.stringify(approval, null, 2), "application/json")}
        >
          Approval record (JSON)
        </button>
      </div>
    </div>
  );
}
