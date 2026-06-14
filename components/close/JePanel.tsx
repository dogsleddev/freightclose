"use client";

// Journal entries by period: the selected month's entry next to the prior
// month's, with the month-over-month move.
//
// Three period sources, clearly labeled:
//   · Oct 2025–Mar 2026 — recreated from ACTUAL invoices (basis: actuals; not
//     an estimate — ties line-for-line to the bundled invoice register)
//   · April 2026 — the bundled close-time accrual estimate (accrued freight liability)
//   · later months — closes you run on the Monthly Close tab (this browser)

import { useEffect, useMemo, useState } from "react";
import { accrualRun } from "@/app/lib/accrual";
import historicalJournal from "@/app/_generated/historicalJournal.json";
import { Card, Badge, Stat } from "@/components/ui";
import { fmtUsd, fmtUsd2, fmtSignedPct, carrierName } from "@/app/lib/format";
import { downloadText } from "@/app/lib/closeClient";
import { listCloses, type StoredClose } from "@/app/lib/closeStore";
import { journalEntryToCsv } from "@/engine/je";
import { parseMonth } from "@/engine/lookups";
import type { HistoricalPeriodJournal } from "@/engine/history";
import type { JournalEntry } from "@/engine/types";

const HISTORY = historicalJournal as unknown as HistoricalPeriodJournal[];

interface PeriodJe {
  periodKey: string;
  label: string;
  je: JournalEntry;
  basis: "actuals" | "estimate";
  source: "history" | "bundled" | "close";
  total: number;
}

export function JePanel() {
  const [closes, setCloses] = useState<StoredClose[]>([]);
  useEffect(() => {
    listCloses().then(setCloses).catch(() => setCloses([]));
  }, []);

  const periods = useMemo<PeriodJe[]>(() => {
    const hist: PeriodJe[] = HISTORY.map((h) => ({
      periodKey: h.periodKey,
      label: h.periodLabel,
      je: h.journalEntry,
      basis: "actuals",
      source: "history",
      total: h.journalEntry.totalDebits,
    }));
    const aprilKey = accrualRun.periodKey ?? "2026-04";
    const april: PeriodJe = {
      periodKey: aprilKey,
      label: accrualRun.period,
      je: accrualRun.journalEntry,
      basis: "estimate",
      source: "bundled",
      total: accrualRun.totalAccrual,
    };
    const stored: PeriodJe[] = closes
      .filter((c) => c.periodKey !== aprilKey)
      .map((c) => ({
        periodKey: c.periodKey,
        label: c.run.period,
        je: c.run.journalEntry,
        basis: "estimate" as const,
        source: "close" as const,
        total: c.run.totalAccrual,
      }));
    return [...hist, april, ...stored].sort((a, b) => a.periodKey.localeCompare(b.periodKey));
  }, [closes]);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const current = periods.find(
    (p) => p.periodKey === (selectedKey ?? periods.filter((x) => x.basis === "estimate").slice(-1)[0]?.periodKey)
  );
  const prior = useMemo(() => {
    if (!current) return undefined;
    const earlier = periods.filter((p) => p.periodKey < current.periodKey);
    return earlier[earlier.length - 1];
  }, [periods, current]);

  if (!current) return null;

  const delta = prior ? current.total - prior.total : null;

  return (
    <div className="space-y-6">
      <Card
        title="Period"
        subtitle="October–March are recreated from actual carrier invoices (not estimates — they tie to the invoice register). April 2026 is the close-time accrual; months you close on the Run a close tab join the list."
        right={
          <select
            value={current.periodKey}
            onChange={(e) => setSelectedKey(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            {periods.map((p) => (
              <option key={p.periodKey} value={p.periodKey}>
                {p.label}
                {p.basis === "actuals" ? " · actuals" : " · accrual"}
              </option>
            ))}
          </select>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat
            label={`${current.label} (${current.basis})`}
            value={fmtUsd(current.total)}
            sub="current selection"
          />
          <Stat
            label={prior ? `${prior.label} (${prior.basis})` : "Prior period"}
            value={prior ? fmtUsd(prior.total) : "—"}
            sub={prior ? "prior period" : "earliest month in the data"}
          />
          <Stat
            label="Month over month"
            value={delta === null ? "—" : `${delta >= 0 ? "+" : "−"}${fmtUsd(Math.abs(delta))}`}
            sub={delta === null || !prior ? "no earlier period" : fmtSignedPct(delta / prior.total)}
            accent={delta === null ? "text-slate-400" : delta >= 0 ? "text-slate-900" : "text-emerald-700"}
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <JeCard title={`Current — ${current.label}`} period={current} />
        {prior ? (
          <JeCard title={`Prior — ${prior.label}`} period={prior} />
        ) : (
          <Card title="Prior period">
            <p className="text-sm leading-relaxed text-slate-600">
              {current.label} is the earliest month in the bundled data — there is nothing before it to recreate.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

/** What was known at that close: the engine's expanding-window estimate vs the actual. */
function AtTheTime({ period }: { period: PeriodJe }) {
  const cells = accrualRun.backtest.cells.filter((c) => c.month === period.label);
  if (!cells.length) return null;
  const actual = period.total;
  const engineTotal = cells.reduce((a, c) => a + c.engineEstimate, 0);
  const firstMonth = HISTORY[0]?.periodLabel === period.label;
  return (
    <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600 ring-1 ring-inset ring-slate-200">
      <b>At that close (before these invoices arrived):</b>{" "}
      {engineTotal > 0 ? (
        <>
          the engine&apos;s expanding-window estimate would have been {fmtUsd(engineTotal)} (
          {fmtSignedPct((engineTotal - actual) / actual)} vs the {fmtUsd(actual)} actual)
          {firstMonth ? " — cold-start month, printed card only" : ""}
        </>
      ) : (
        <>no engine estimate (no prior invoice history); this recreated entry is the actual at {fmtUsd(actual)}</>
      )}
      . See <b>Closed Periods</b> for the full estimate-vs-actual reconciliation and true-up entry.
    </div>
  );
}

function JeCard({ title, period }: { title: string; period: PeriodJe }) {
  const je = period.je;
  const isActuals = period.basis === "actuals";
  const externalId = `FREIGHTCLOSE-${parseMonth(je.period)?.key ?? ""}${isActuals ? "-ACTUALS" : ""}`;
  return (
    <Card
      title={title}
      subtitle={`${je.framework} · entry date ${je.date} · ${externalId}`}
      right={
        <div className="flex items-center gap-2">
          {isActuals ? (
            <Badge className="bg-sky-100 text-sky-800 ring-sky-200">actuals (recreated)</Badge>
          ) : period.source === "bundled" ? (
            <Badge className="bg-slate-100 text-slate-600 ring-slate-200">accrual · bundled</Badge>
          ) : (
            <Badge className="bg-slate-100 text-slate-600 ring-slate-200">accrual · this browser</Badge>
          )}
          <Badge
            className={
              je.balanced
                ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
                : "bg-red-100 text-red-800 ring-red-200"
            }
          >
            {je.balanced ? "balanced" : "OUT OF BALANCE"}
          </Badge>
        </div>
      }
    >
      <p className="mb-3 text-xs leading-relaxed text-slate-500">{je.description}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-3">Account</th>
              <th className="py-2 pr-3">Memo</th>
              <th className="py-2 pr-3 text-right">Debit</th>
              <th className="py-2 pl-3 text-right">Credit</th>
            </tr>
          </thead>
          <tbody>
            {je.lines.map((l, i) => (
              <tr key={i} className="border-b border-slate-100 align-top">
                <td className="py-2 pr-3">
                  <div className="font-mono text-xs text-slate-500">{l.account}</div>
                  <div className="text-slate-800">{l.accountName}</div>
                  {l.carrier && <div className="text-xs text-slate-400">{carrierName[l.carrier]}</div>}
                </td>
                <td className="py-2 pr-3 text-xs leading-relaxed text-slate-600">{l.memo}</td>
                <td className="tnum py-2 pr-3 text-right">{l.type === "debit" ? fmtUsd2(l.amount) : ""}</td>
                <td className="tnum py-2 pl-3 text-right">{l.type === "credit" ? fmtUsd2(l.amount) : ""}</td>
              </tr>
            ))}
            <tr className="font-semibold text-slate-900">
              <td className="py-2 pr-3">Totals</td>
              <td />
              <td className="tnum py-2 pr-3 text-right">{fmtUsd2(je.totalDebits)}</td>
              <td className="tnum py-2 pl-3 text-right">{fmtUsd2(je.totalCredits)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {isActuals && <AtTheTime period={period} />}
      <div className="mt-3 text-right">
        <button
          className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          onClick={() =>
            downloadText(
              `freightclose-je-${je.period.toLowerCase().replace(/\s+/g, "-")}${isActuals ? "-actuals" : ""}.csv`,
              journalEntryToCsv(je, isActuals ? { externalIdSuffix: "-ACTUALS" } : {})
            )
          }
        >
          Download NetSuite CSV
        </button>
      </div>
    </Card>
  );
}
