"use client";

// Data Import — dual-mode entry so anyone can run the engine in their browser:
//   • Load Sample…  — pick a bundled period (from sampleManifest) and the engine
//                      prices it instantly, no file needed.
//   • Upload CSV     — drop in your own shipments (+ optional invoices), validated
//                      against the challenge schema, same deterministic engine.
// Plus downloadable import templates + a (future) direct-connection diagram.
// Reuses the exact closeClient.buildClose pipeline the Monthly Close tab runs.

import { useMemo, useState } from "react";
import baseInputs from "@/app/_generated/baseInputs.json";
import sampleManifestData from "@/app/_generated/sampleManifest.json";
import { Card, Badge, Stat } from "@/components/ui";
import { fmtUsd, fmtUsd2, carrierName, carrierAccent, severityStyle } from "@/app/lib/format";
import {
  buildClose,
  validateShipmentsCsv,
  inferPeriod,
  downloadText,
  SHIPMENT_COLUMNS,
  INVOICE_COLUMNS,
  type CsvValidation,
} from "@/app/lib/closeClient";
import { journalEntryToCsv } from "@/engine/je";
import { shipmentBackupCsv } from "@/engine/close";
import { monthMetaFromKey } from "@/engine/lookups";
import { UploadBlock, readFile, type FilePick } from "./UploadBlock";
import type { AccrualRun, DeniseBaseline, InvoiceLine } from "@/engine/types";

const BASE_INVOICES = (baseInputs as { invoices: InvoiceLine[] }).invoices;
const BASE_DENISE = (baseInputs as { denise: DeniseBaseline[] }).denise;

interface SampleEntry {
  id: string;
  label: string;
  period: string;
  status: "closed" | "open" | "simulated";
  source: "real" | "synthetic";
  badge: string;
  files: { shipments: string; invoices?: string; denise?: string };
}
const SAMPLES = sampleManifestData as unknown as SampleEntry[];

const TEMPLATES: { key: string; label: string; cols: string[] }[] = [
  { key: "shipments", label: "Shipments", cols: SHIPMENT_COLUMNS },
  { key: "invoices", label: "Invoices", cols: INVOICE_COLUMNS },
];

function sampleBadge(s: SampleEntry) {
  if (s.source === "synthetic") return <Badge className="bg-amber-100 text-amber-800 ring-amber-200">{s.badge || "Simulated"}</Badge>;
  if (s.status === "closed") return <Badge className="bg-sky-100 text-sky-800 ring-sky-200">{s.badge}</Badge>;
  return <Badge className="bg-emerald-100 text-emerald-800 ring-emerald-200">open period</Badge>;
}

export function ImportPanel() {
  const [mode, setMode] = useState<"sample" | "upload">("sample");
  const [sampleId, setSampleId] = useState(SAMPLES.find((s) => s.id === "2604")?.id ?? SAMPLES[0]?.id ?? "");
  const [shipFile, setShipFile] = useState<FilePick>(null);
  const [shipVal, setShipVal] = useState<CsvValidation | null>(null);
  const [periodKey, setPeriodKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ run: AccrualRun; sourceNote: string } | null>(null);

  const selectedSample = useMemo(() => SAMPLES.find((s) => s.id === sampleId), [sampleId]);

  const runEngine = (shipmentsCsv: string, key: string, sourceNote: string) => {
    setError(null);
    try {
      const { run } = buildClose({
        periodKey: key,
        shipmentsCsv,
        invoicesCsv: null,
        baseInvoices: BASE_INVOICES,
        denise: BASE_DENISE,
        configVersions: [],
        priorCloses: [],
      });
      setResult({ run, sourceNote });
    } catch (e) {
      setError((e as Error).message);
      setResult(null);
    }
  };

  const loadSample = async () => {
    if (!selectedSample) return;
    setBusy(true);
    setError(null);
    try {
      const text = await fetch(selectedSample.files.shipments).then((r) => {
        if (!r.ok) throw new Error(`Could not load sample (${r.status}).`);
        return r.text();
      });
      runEngine(text, selectedSample.period, `Sample: ${selectedSample.label} (${selectedSample.source})`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

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

  const canRunUpload = !!shipFile && !!shipVal?.ok && !!monthMetaFromKey(periodKey);

  return (
    <div className="space-y-6">
      {/* mode toggle */}
      <div className="flex gap-1.5">
        {(["sample", "upload"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              mode === m ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            {m === "sample" ? "Load Sample…" : "Upload CSV"}
          </button>
        ))}
      </div>

      {mode === "sample" ? (
        <Card
          title="Load a sample dataset"
          subtitle="Pick a bundled period and the deterministic engine prices it in your browser — no file needed. Real periods are reconstructed from invoices; May is a clearly-badged synthetic scenario."
        >
          <div className="flex flex-wrap items-end gap-4">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Period</span>
              <select
                value={sampleId}
                onChange={(e) => setSampleId(e.target.value)}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                {SAMPLES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                    {s.source === "synthetic" ? " — simulated" : s.status === "open" ? " — open (hero)" : " — closed"}
                  </option>
                ))}
              </select>
            </label>
            {selectedSample && sampleBadge(selectedSample)}
            <button
              disabled={busy}
              onClick={loadSample}
              className="ml-auto rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-parchment transition enabled:hover:bg-ink/85 disabled:opacity-40"
            >
              {busy ? "Pricing…" : "Load & price"}
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Calibration uses the bundled invoice history; the selected period&apos;s shipments are priced through the
            same engine the build runs. For the full close workflow (uploads, rate versions, reproduce-close audit),
            see <b>Monthly Close</b>.
          </p>
        </Card>
      ) : (
        <Card
          title="Upload your own shipments"
          subtitle="Same schema as the challenge files; validated before pricing, every fallback flagged. Add invoices and run a full close on the Monthly Close tab."
        >
          <UploadBlock
            label="Shipments CSV"
            hint="shipments_<month>.csv — the month being accrued"
            file={shipFile}
            validation={shipVal}
            onPick={onShipPick}
          />
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Period</span>
              <input
                type="month"
                value={periodKey}
                onChange={(e) => setPeriodKey(e.target.value)}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>
            <button
              disabled={!canRunUpload}
              onClick={() => shipFile && runEngine(shipFile.text, periodKey, `Uploaded: ${shipFile.name}`)}
              className="ml-auto rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-parchment transition enabled:hover:bg-ink/85 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Price shipments
            </button>
          </div>
        </Card>
      )}

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-inset ring-red-200">{error}</p>
      )}

      {result && <ImportResult run={result.run} sourceNote={result.sourceNote} />}

      {/* templates */}
      <Card title="Import templates" subtitle="Download a headers-only CSV in the exact schema the engine expects.">
        <div className="flex flex-wrap gap-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.key}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => downloadText(`freightclose-template-${t.key}.csv`, t.cols.join(",") + "\n")}
            >
              {t.label} template
            </button>
          ))}
        </div>
      </Card>

      {/* future connections */}
      <Card title="Direct connections" subtitle="Future path — CSV is the supported path today.">
        <div className="flex flex-wrap items-center gap-3">
          {["Ramp", "Stripe", "3PL portal", "NetSuite"].map((src) => (
            <span key={src} className="rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-500">
              {src}
            </span>
          ))}
          <span className="text-slate-400">→</span>
          <span className="rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-parchment">Freight Close engine</span>
          <Badge className="bg-slate-100 text-slate-500 ring-slate-200">future</Badge>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          The storage interface is built to swap CSV ingestion for direct API connections (Ramp / Stripe / 3PL /
          NetSuite) without touching the engine. CSV import is the production path for this submission.
        </p>
      </Card>
    </div>
  );
}

function ImportResult({ run, sourceNote }: { run: AccrualRun; sourceNote: string }) {
  const sev = run.exceptionsBySeverity;
  const slug = run.period.toLowerCase().replace(/\s+/g, "-");
  return (
    <Card
      title={`${run.period} — priced in your browser`}
      subtitle={`${sourceNote} · ${run.shipmentEstimates.length} shipments · deterministic engine`}
      right={
        run.allTieOutsPassed ? (
          <Badge className="bg-emerald-100 text-emerald-800 ring-emerald-200">tie-outs pass</Badge>
        ) : (
          <Badge className="bg-red-100 text-red-800 ring-red-200">tie-outs FAIL</Badge>
        )
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Stat label={`${run.period} accrual`} value={fmtUsd(run.totalAccrual)} sub={`net of ${fmtUsd2(run.totalCreditReserve)} reserve`} />
        <Stat label="Confidence (±1σ)" value={`${fmtUsd(run.confidence.total.low)}–${fmtUsd(run.confidence.total.high)}`} sub="rate-index volatility" />
        <Stat label="Shipments" value={run.shipmentEstimates.length} sub={`invoices through ${run.inputs.invoicesThrough}`} />
        <Stat label="Flags" value={`${run.exceptions.length}`} sub={`${sev.error} error · ${sev.warn} warn · ${sev.info} info`} accent={sev.error ? "text-red-700" : "text-slate-900"} />
      </div>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-4 font-medium">Carrier</th>
              <th className="py-2 pr-4 text-right font-medium">Shipments</th>
              <th className="py-2 pr-4 text-right font-medium">Accrual</th>
            </tr>
          </thead>
          <tbody className="tnum">
            {run.carrierSummaries.map((cs) => (
              <tr key={cs.carrier} className="border-b border-slate-100">
                <td className="py-2 pr-4"><Badge className={carrierAccent[cs.carrier]}>{carrierName[cs.carrier]}</Badge></td>
                <td className="py-2 pr-4 text-right">{cs.shipmentCount}</td>
                <td className="py-2 pr-4 text-right font-semibold">{fmtUsd(cs.accrual)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          onClick={() => downloadText(`freightclose-je-${slug}.csv`, journalEntryToCsv(run.journalEntry))}
        >
          Download JE CSV
        </button>
        <button
          className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          onClick={() => downloadText(`freightclose-shipment-backup-${slug}.csv`, shipmentBackupCsv(run))}
        >
          Download backup CSV
        </button>
      </div>
      {sev.error + sev.warn > 0 && (
        <ul className="mt-4 space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-700">
          {run.exceptions.filter((e) => e.severity !== "info").slice(0, 6).map((e) => (
            <li key={e.id} className="flex items-start gap-2">
              <Badge className={severityStyle[e.severity]}>{e.severity}</Badge>
              <span>{e.message}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
