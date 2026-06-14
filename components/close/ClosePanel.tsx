"use client";

// Monthly close workspace. Upload (or paste) next month's shipments CSV and —
// once they arrive — the newly invoiced months, validate against the challenge
// schema, and run the SAME deterministic engine the build runs, right here in
// the browser. Each close is saved with its inputs + rate-config version, so
// any prior month re-runs bit-for-bit ("Re-run & verify").

import { useCallback, useEffect, useMemo, useState } from "react";
import { accrualRun } from "@/app/lib/accrual";
import baseInputs from "@/app/_generated/baseInputs.json";
import { Card, Badge, Stat } from "@/components/ui";
import { fmtUsd, fmtUsd2, carrierName, carrierAccent, severityStyle } from "@/app/lib/format";
import {
  buildClose,
  reproduceClose,
  validateShipmentsCsv,
  validateInvoicesCsv,
  inferPeriod,
  downloadText,
  type CsvValidation,
} from "@/app/lib/closeClient";
import {
  listCloses,
  saveClose,
  deleteClose,
  listVersions,
  getSettings,
  type StoredClose,
} from "@/app/lib/closeStore";
import { journalEntryToCsv } from "@/engine/je";
import { shipmentBackupCsv } from "@/engine/close";
import { monthMetaFromKey } from "@/engine/lookups";
import { UploadBlock, readFile, type FilePick } from "./UploadBlock";
import type { AccrualRun, DeniseBaseline, InvoiceLine } from "@/engine/types";
import type { RateConfigVersion } from "@/engine/configSet";

const BASE_INVOICES = (baseInputs as { invoices: InvoiceLine[] }).invoices;
const BASE_DENISE = (baseInputs as { denise: DeniseBaseline[] }).denise;

function PeriodBadge({ run }: { run: AccrualRun }) {
  return run.allTieOutsPassed ? (
    <Badge className="bg-emerald-100 text-emerald-800 ring-emerald-200">tie-outs pass</Badge>
  ) : (
    <Badge className="bg-red-100 text-red-800 ring-red-200">tie-outs FAIL</Badge>
  );
}

export function ClosePanel() {
  const [closes, setCloses] = useState<StoredClose[]>([]);
  const [versions, setVersions] = useState<RateConfigVersion[]>([]);
  const [rateSource, setRateSource] = useState(accrualRun.rateSource);

  const [shipFile, setShipFile] = useState<FilePick>(null);
  const [invFile, setInvFile] = useState<FilePick>(null);
  const [shipVal, setShipVal] = useState<CsvValidation | null>(null);
  const [invVal, setInvVal] = useState<CsvValidation | null>(null);
  const [periodKey, setPeriodKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ run: AccrualRun; qtdNote: string; mergeNote: string } | null>(null);
  const [verify, setVerify] = useState<Record<string, "identical" | "diverged">>({});

  const refresh = useCallback(() => {
    listCloses().then(setCloses).catch(() => setCloses([]));
    listVersions().then(setVersions).catch(() => setVersions([]));
    getSettings().then((s) => s && setRateSource(s.rateSource)).catch(() => {});
  }, []);
  useEffect(refresh, [refresh]);

  // bundled April acts as the seed close
  const allPeriods = useMemo(() => {
    const fromStore = closes.map((c) => ({
      periodKey: c.periodKey,
      label: c.run.period,
      run: c.run,
      bundled: false,
    }));
    const april = {
      periodKey: accrualRun.periodKey ?? "2026-04",
      label: accrualRun.period,
      run: accrualRun,
      bundled: true,
    };
    return [april, ...fromStore.filter((c) => c.periodKey !== april.periodKey)].sort((a, b) =>
      a.periodKey.localeCompare(b.periodKey)
    );
  }, [closes]);

  const priorCloseCounts = useMemo(
    () =>
      allPeriods.map((p) => ({
        periodKey: p.periodKey,
        heartlandShipments:
          p.run.carrierSummaries.find((c) => c.carrier === "heartland")?.shipmentCount ?? 0,
      })),
    [allPeriods]
  );

  const onShipPick = async (f: File | undefined, pasted?: string) => {
    setError(null);
    setResult(null);
    const pick = pasted !== undefined ? { name: "(pasted)", text: pasted } : f ? await readFile(f) : null;
    setShipFile(pick);
    if (!pick) return setShipVal(null);
    const v = validateShipmentsCsv(pick.text);
    setShipVal(v);
    const inferred = inferPeriod(v.monthsFound);
    if (inferred) setPeriodKey(inferred);
  };

  const onInvPick = async (f: File | undefined, pasted?: string) => {
    setError(null);
    setResult(null);
    const pick = pasted !== undefined ? { name: "(pasted)", text: pasted } : f ? await readFile(f) : null;
    setInvFile(pick);
    setInvVal(pick ? validateInvoicesCsv(pick.text) : null);
  };

  const canRun = !!shipFile && !!shipVal?.ok && (!invFile || !!invVal?.ok) && !!monthMetaFromKey(periodKey);

  const run = () => {
    if (!shipFile) return;
    setError(null);
    try {
      const { run, invoiceMerge, qtdNote } = buildClose({
        periodKey,
        shipmentsCsv: shipFile.text,
        invoicesCsv: invFile?.text ?? null,
        baseInvoices: BASE_INVOICES,
        denise: BASE_DENISE,
        configVersions: versions,
        rateSource,
        priorCloses: priorCloseCounts,
      });
      const stored: StoredClose = {
        periodKey,
        run,
        inputs: { shipmentsCsv: shipFile.text, invoicesCsv: invFile?.text ?? null },
        configVersionId: run.provenance?.configVersionId ?? "v0-bundled",
        savedAt: Date.now(),
      };
      saveClose(stored).then(refresh);
      const mergeNote = invoiceMerge
        ? `${invoiceMerge.added} invoice lines added (${invoiceMerge.monthsAdded.join(", ") || "no new months"}; ${invoiceMerge.duplicatesDropped} duplicate ids dropped)`
        : "no new invoices uploaded — calibration window unchanged";
      setResult({ run, qtdNote, mergeNote });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const onVerify = (stored: StoredClose) => {
    try {
      const { identical } = reproduceClose(stored, BASE_INVOICES, BASE_DENISE, versions, priorCloseCounts);
      setVerify((v) => ({ ...v, [stored.periodKey]: identical ? "identical" : "diverged" }));
    } catch {
      setVerify((v) => ({ ...v, [stored.periodKey]: "diverged" }));
    }
  };

  return (
    <div className="space-y-6">
      {/* period history */}
      <Card
        title="Close history"
        subtitle="April 2026 ships with the app (build-time engine run). Every close you run here is saved with its inputs and rate-config version, so it can be reproduced bit-for-bit."
      >
        <ul className="divide-y divide-slate-100">
          {allPeriods.map((p) => {
            const stored = closes.find((c) => c.periodKey === p.periodKey);
            return (
              <li key={p.periodKey} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                <span className="w-28 font-semibold text-slate-900">{p.label}</span>
                <span className="tnum font-mono text-slate-800">{fmtUsd(p.run.totalAccrual)}</span>
                <PeriodBadge run={p.run} />
                <span className="text-xs text-slate-500">
                  {p.run.shipmentEstimates.length} shipments · {p.run.exceptions.length} flags ·{" "}
                  {p.run.provenance ? `config ${p.run.provenance.configVersionId}` : "config v0-bundled"}
                </span>
                {p.bundled ? (
                  <Badge className="bg-slate-100 text-slate-600 ring-slate-200">bundled</Badge>
                ) : (
                  verify[p.periodKey] && (
                    <Badge
                      className={
                        verify[p.periodKey] === "identical"
                          ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
                          : "bg-red-100 text-red-800 ring-red-200"
                      }
                    >
                      {verify[p.periodKey] === "identical" ? "reproduced exactly" : "diverged — inputs or config changed"}
                    </Badge>
                  )
                )}
                <span className="ml-auto flex gap-2">
                  <button
                    className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    onClick={() =>
                      downloadText(
                        `freightclose-je-${p.label.toLowerCase().replace(/\s+/g, "-")}.csv`,
                        journalEntryToCsv(p.run.journalEntry)
                      )
                    }
                  >
                    JE CSV
                  </button>
                  <button
                    className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    onClick={() =>
                      downloadText(
                        `freightclose-shipment-backup-${p.label.toLowerCase().replace(/\s+/g, "-")}.csv`,
                        shipmentBackupCsv(p.run)
                      )
                    }
                  >
                    Backup CSV
                  </button>
                  {stored && (
                    <>
                      <button
                        className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        onClick={() => onVerify(stored)}
                      >
                        Re-run &amp; verify
                      </button>
                      <button
                        className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                        onClick={() => deleteClose(stored.periodKey).then(refresh)}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* upload + run */}
      <Card
        title="Run the next month"
        subtitle="Shipments CSV is required (the month being accrued). Add the invoice CSV for newly invoiced months when it arrives — the engine recalibrates and the window rolls forward. Same schemas as the challenge files; nothing is invented, every fallback is flagged."
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <UploadBlock
            label="1 · Shipments (required)"
            hint="shipments_<month>.csv — the month you are closing"
            file={shipFile}
            validation={shipVal}
            onPick={onShipPick}
          />
          <UploadBlock
            label="2 · New invoices (optional)"
            hint="freight_invoices_*.csv — months invoiced since the last close"
            file={invFile}
            validation={invVal}
            onPick={onInvPick}
          />
        </div>

        <div className="mt-5 flex flex-wrap items-end gap-4 border-t border-slate-100 pt-4">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Close period
            </span>
            <input
              type="month"
              value={periodKey}
              onChange={(e) => setPeriodKey(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
          <div className="text-xs text-slate-500">
            {shipVal?.monthsFound.length ? (
              <>Months in shipments file: {shipVal.monthsFound.join(", ")} (latest preselected)</>
            ) : (
              <>Pick the shipments file to infer the period</>
            )}
            <br />
            Rate source: {(["peak", "heartland", "coastal"] as const).map((c) => `${carrierName[c].split(" ")[0]} ${rateSource[c]}`).join(" · ")} — change on the Rates tab
          </div>
          <button
            disabled={!canRun}
            onClick={run}
            className="ml-auto rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-parchment transition enabled:hover:bg-ink/85 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Run close
          </button>
        </div>
        {error && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-inset ring-red-200">
            {error}
          </p>
        )}
      </Card>

      {/* result */}
      {result && <CloseResult run={result.run} qtdNote={result.qtdNote} mergeNote={result.mergeNote} />}
    </div>
  );
}

function CloseResult({ run, qtdNote, mergeNote }: { run: AccrualRun; qtdNote: string; mergeNote: string }) {
  const sev = run.exceptionsBySeverity;
  return (
    <Card
      title={`${run.period} close — saved`}
      subtitle={`${mergeNote} · Heartland QTD: ${qtdNote}`}
      right={<PeriodBadge run={run} />}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Stat label={`${run.period} accrual`} value={fmtUsd(run.totalAccrual)} sub={`net of ${fmtUsd2(run.totalCreditReserve)} credit reserve`} />
        <Stat label="Confidence (±1σ)" value={`${fmtUsd(run.confidence.total.low)}–${fmtUsd(run.confidence.total.high)}`} sub="from rate-index volatility" />
        <Stat label="Shipments priced" value={run.shipmentEstimates.length} sub={`invoices through ${run.inputs.invoicesThrough}`} />
        <Stat
          label="Flags"
          value={`${run.exceptions.length}`}
          sub={`${sev.error} error · ${sev.warn} warn · ${sev.info} info`}
          accent={sev.error ? "text-red-700" : "text-slate-900"}
        />
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-4">Carrier</th>
              <th className="py-2 pr-4">Shipments</th>
              <th className="py-2 pr-4 text-right">Base</th>
              <th className="py-2 pr-4 text-right">Fuel</th>
              <th className="py-2 pr-4 text-right">Accessorials</th>
              <th className="py-2 pr-4 text-right">Reserve</th>
              <th className="py-2 pr-4 text-right">Accrual</th>
            </tr>
          </thead>
          <tbody>
            {run.carrierSummaries.map((cs) => (
              <tr key={cs.carrier} className="border-b border-slate-100">
                <td className="py-2 pr-4">
                  <Badge className={carrierAccent[cs.carrier]}>{carrierName[cs.carrier]}</Badge>
                </td>
                <td className="py-2 pr-4">{cs.shipmentCount}</td>
                <td className="tnum py-2 pr-4 text-right">{fmtUsd(cs.base)}</td>
                <td className="tnum py-2 pr-4 text-right">{fmtUsd(cs.fuel)}</td>
                <td className="tnum py-2 pr-4 text-right">{fmtUsd(cs.accessorials + cs.residential)}</td>
                <td className="tnum py-2 pr-4 text-right">{fmtUsd2(cs.creditReserve)}</td>
                <td className="tnum py-2 pr-4 text-right font-semibold">{fmtUsd(cs.accrual)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span>
          Provenance: engine {run.provenance?.engineVersion} · config {run.provenance?.configVersionId} (effective{" "}
          {run.provenance?.configEffectiveFrom === "0000-01" ? "bundled" : run.provenance?.configEffectiveFrom})
          {run.provenance?.qtdStart ? ` · QTD carry-in ${run.provenance.qtdStart.count}` : ""}
        </span>
        <span className="ml-auto flex gap-2">
          <button
            className="rounded-md border border-slate-200 px-2 py-1 font-medium text-slate-700 hover:bg-slate-50"
            onClick={() =>
              downloadText(
                `freightclose-je-${run.period.toLowerCase().replace(/\s+/g, "-")}.csv`,
                journalEntryToCsv(run.journalEntry)
              )
            }
          >
            Download JE CSV
          </button>
          <button
            className="rounded-md border border-slate-200 px-2 py-1 font-medium text-slate-700 hover:bg-slate-50"
            onClick={() =>
              downloadText(
                `freightclose-shipment-backup-${run.period.toLowerCase().replace(/\s+/g, "-")}.csv`,
                shipmentBackupCsv(run)
              )
            }
          >
            Download backup CSV
          </button>
        </span>
      </div>

      {run.exceptions.filter((e) => e.severity !== "info").length > 0 && (
        <div className="mt-4 rounded-lg border border-slate-200 p-3">
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            Flags to review (errors &amp; warnings)
          </div>
          <ul className="space-y-1 text-xs text-slate-700">
            {run.exceptions
              .filter((e) => e.severity !== "info")
              .slice(0, 8)
              .map((e) => (
                <li key={e.id} className="flex items-start gap-2">
                  <Badge className={severityStyle[e.severity]}>{e.severity}</Badge>
                  <span>{e.message}</span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
