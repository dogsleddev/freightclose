"use client";

// Rate tables with effective-dated versions. The bundled /config card is
// immutable version v0; saving an edit creates a NEW version effective from a
// chosen month. Calibration anchors every historical month to the card in
// force that month, so past closes reconstruct unchanged forever — and the
// next close prices on the new card x the calibrated index.

import { useEffect, useMemo, useState } from "react";
import { accrualRun } from "@/app/lib/accrual";
import { Card, Badge } from "@/components/ui";
import { carrierName, fmtPct, fmtUsd, fmtSignedPct } from "@/app/lib/format";
import {
  BUNDLED_VERSION,
  resolveConfigFor,
  validateConfigSet,
  type ConfigSet,
} from "@/engine/configSet";
import {
  listVersions,
  saveVersion,
  deleteVersion,
  getSettings,
  saveSettings,
  type StoredVersion,
} from "@/app/lib/closeStore";
import type { Carrier, RateSource, ShipmentEstimate } from "@/engine/types";

function clone(set: ConfigSet): ConfigSet {
  return JSON.parse(JSON.stringify(set)) as ConfigSet;
}

// --- Worked examples -------------------------------------------------------
// One representative, fully-priced shipment per carrier from the April hero
// close, rendered beside its rate card (CLAUDE.md #9: "rate tables with worked
// examples beside lines"). Picked deterministically: a clean row (no flags)
// that exercises the carrier's signature mechanic (Peak min-charge/accessorial,
// Heartland QTD volume discount, Coastal min-floor/residential), longest trace.
function pickRepresentative(carrier: Carrier): ShipmentEstimate | undefined {
  const rows = accrualRun.shipmentEstimates.filter((s) => s.carrier === carrier);
  const clean = rows.filter((s) => s.exceptionIds.length === 0);
  const interesting = clean.filter((s) => {
    if (carrier === "heartland") return (s.classification.heartlandDiscountPct ?? 0) > 0;
    if (carrier === "peak") return s.minChargeApplied || s.accessorials.length > 0;
    return s.minChargeApplied || s.residentialSurcharge > 0;
  });
  const pool = interesting.length ? interesting : clean.length ? clean : rows;
  return [...pool].sort(
    (a, b) => b.calcTrace.length - a.calcTrace.length || a.shipmentId.localeCompare(b.shipmentId)
  )[0];
}

const REPRESENTATIVE: Record<Carrier, ShipmentEstimate | undefined> = {
  peak: pickRepresentative("peak"),
  heartland: pickRepresentative("heartland"),
  coastal: pickRepresentative("coastal"),
};

function WorkedExample({ e }: { e: ShipmentEstimate }) {
  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Worked example</span>
        <span className="font-mono text-[11px] text-slate-400">{e.shipmentId} · Apr 2026</span>
      </div>
      <div className="mb-2 text-xs text-slate-500">
        {e.destination.city}, {e.destination.state} {e.destination.zip} · {e.weightLbs ?? "imputed"} lb
        {e.units > 1 ? ` · ${e.units} units` : ""}
      </div>
      <ol className="space-y-1 text-[13px]">
        {e.calcTrace.map((s, i) => {
          const total = i === e.calcTrace.length - 1;
          return (
            <li
              key={i}
              className={`flex justify-between gap-3 ${
                total
                  ? "border-t border-slate-200 pt-1 font-semibold text-slate-900"
                  : "border-b border-slate-100 pb-1 text-slate-600"
              }`}
            >
              <span>
                {s.label}{" "}
                {s.formula && <span className="font-mono text-[11px] text-slate-400">{s.formula}</span>}
              </span>
              <span className="tnum shrink-0">{s.value.toLocaleString()}</span>
            </li>
          );
        })}
      </ol>
      <p className="mt-1.5 text-[11px] text-slate-400">
        A real priced shipment from the April close — drill the full row on Shipment Backup.
      </p>
    </div>
  );
}

// --- Peak mileage table ----------------------------------------------------
// Merges the engine's calibrated billing miles (from invoice history, keyed by
// destination) with the printed-card fallback, badging each row's source and
// surfacing the per-origin (Denver vs SLC) DATA forensics.
const SRC_BADGE: Record<string, string> = {
  calibrated: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  printed: "bg-slate-100 text-slate-600 ring-slate-200",
  geo: "bg-amber-100 text-amber-800 ring-amber-200",
};

function MileageTable({ set }: { set: ConfigSet }) {
  const printedByZip = new Map(set.peak.printedMileageTable.map((m) => [m.zip, m]));
  const calibByZip = new Map(accrualRun.calibration.peak.mileage.map((m) => [m.zip, m]));
  const zips = Array.from(new Set([...calibByZip.keys(), ...printedByZip.keys()]));
  const rows = zips
    .map((zip) => {
      const cal = calibByZip.get(zip);
      const pr = printedByZip.get(zip);
      return {
        zip,
        city: cal?.city ?? pr?.city ?? "",
        state: cal?.state ?? pr?.state ?? "",
        calMiles: cal?.miles ?? null,
        printedMiles: pr?.miles ?? null,
        source: cal?.source ?? "printed",
        lineCount: cal?.lineCount ?? 0,
        sortMiles: cal?.miles ?? pr?.miles ?? 0,
      };
    })
    .sort((a, b) => a.sortMiles - b.sortMiles);

  const count = (code: string) => accrualRun.exceptions.filter((e) => e.code === code).length;
  const origin = set.peak.originAssumption.primaryOrigin;

  return (
    <Card
      title="Peak mileage table"
      subtitle="Peak prices per billing mile. The engine uses mileage calibrated from invoice history (keyed by destination); the printed card is the fallback and a geo estimate the last resort — every fallback is flagged, never silent."
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-1.5 pr-2 font-medium">Destination</th>
              <th className="py-1.5 px-2 text-right font-medium">Calibrated mi</th>
              <th className="py-1.5 px-2 text-right font-medium">Printed mi</th>
              <th className="py-1.5 px-2 font-medium">Source</th>
              <th className="py-1.5 pl-2 text-right font-medium">Invoice lines</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.zip} className="border-b border-slate-100">
                <td className="py-1.5 pr-2 text-slate-700">
                  {r.city}, {r.state} <span className="font-mono text-xs text-slate-400">{r.zip}</span>
                </td>
                <td className="tnum py-1.5 px-2 text-right">{r.calMiles?.toLocaleString() ?? "—"}</td>
                <td className="tnum py-1.5 px-2 text-right text-slate-500">{r.printedMiles?.toLocaleString() ?? "—"}</td>
                <td className="py-1.5 px-2">
                  <Badge className={SRC_BADGE[r.source]}>{r.source}</Badge>
                </td>
                <td className="tnum py-1.5 pl-2 text-right text-slate-500">{r.lineCount || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
        <span className="font-semibold">Per-origin assumption (DATA forensics).</span> Calibrated mileage is keyed by
        destination only — invoice history does not separate {origin}-origin from Salt Lake City-origin lanes.
        Non-{origin}-origin shipments are priced at the destination's {origin}-primary calibrated mileage and flagged
        ({count("ORIGIN_ASSUMPTION")} origin-assumption
        {count("MILEAGE_FALLBACK_GEO") ? `, ${count("MILEAGE_FALLBACK_GEO")} geo fallback` : ""}
        {count("OUT_OF_TERRITORY") ? `, ${count("OUT_OF_TERRITORY")} out-of-territory` : ""}) — never silently using a{" "}
        {origin} figure for an SLC shipment.
      </div>
    </Card>
  );
}

// --- Classification lookups (ZIP → Zone / ZIP → Region) --------------------
function LookupTables({ set }: { set: ConfigSet }) {
  const [view, setView] = useState<"zone" | "region">("zone");
  const zoneGroups = useMemo(() => {
    const g: Record<string, { min: number; max: number; zone: string; note?: string }[]> = {};
    for (const e of set.heartland.zonePrefixTable) (g[e.zone] ??= []).push(e);
    return Object.entries(g).sort(([a], [b]) => a.localeCompare(b));
  }, [set]);

  return (
    <Card
      title="Classification lookups"
      subtitle="How a destination ZIP maps to a Heartland zone or a Coastal region — ZIP-prefix / ZIP-range based, not state. (KC-metro Kansas still prices as Zone 1; a California shipment splits SoCal vs NorCal by ZIP.)"
      right={
        <div className="flex gap-1.5">
          {(["zone", "region"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                view === v ? "bg-ink text-parchment" : "border border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {v === "zone" ? "ZIP → Zone (Heartland)" : "ZIP → Region (Coastal)"}
            </button>
          ))}
        </div>
      }
    >
      {view === "zone" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {zoneGroups.map(([zone, entries]) => (
            <div key={zone} className="rounded-lg border border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-800">
                  Zone {zone} · {fmtUsd(set.heartland.printedZoneRates[zone] ?? 0)} flat
                </span>
                <Badge className="bg-slate-100 text-slate-600 ring-slate-200">{entries.length} ranges</Badge>
              </div>
              <ul className="space-y-1 text-sm">
                {entries.map((e, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span className="font-mono text-xs text-slate-500">
                      {String(e.min).padStart(3, "0")}xx–{String(e.max).padStart(3, "0")}xx
                    </span>
                    <span className="text-right text-xs text-slate-500">{e.note}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {set.coastal.regions.map((r) => (
            <div key={r.key} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
              <div>
                <div className="text-sm font-semibold text-slate-800">{r.label}</div>
                <div className="mt-0.5 font-mono text-xs text-slate-500">
                  ZIP {r.zipMin.toLocaleString()} – {r.zipMax.toLocaleString()}
                </div>
              </div>
              <Badge className="bg-sky-100 text-sky-800 ring-sky-200">${r.printedPerLb.toFixed(2)}/lb printed</Badge>
            </div>
          ))}
          <p className="text-xs text-slate-400">
            Coastal calibrated $/lb (recent window):{" "}
            {accrualRun.calibration.coastal.regionRates
              .map((rr) => `${rr.region} $${rr.perLb.toFixed(3)}`)
              .join(" · ")}
            .
          </p>
        </div>
      )}
    </Card>
  );
}

export function RatesPanel() {
  const [versions, setVersions] = useState<StoredVersion[]>([]);
  const [viewMonth, setViewMonth] = useState("2026-05");
  const [draft, setDraft] = useState<ConfigSet | null>(null);
  const [effectiveFrom, setEffectiveFrom] = useState("2026-05");
  const [note, setNote] = useState("");
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [rateSource, setRateSource] = useState(accrualRun.rateSource);

  const refresh = () => {
    listVersions().then(setVersions).catch(() => setVersions([]));
    getSettings().then((s) => s && setRateSource(s.rateSource)).catch(() => {});
  };
  useEffect(refresh, []);

  const resolved = useMemo(() => resolveConfigFor(versions, viewMonth), [versions, viewMonth]);
  const editing = draft !== null;
  const set = draft ?? resolved.set;

  const startEdit = () => {
    setDraft(clone(resolved.set));
    setEffectiveFrom(viewMonth);
    setSaveMsg(null);
  };
  const cancelEdit = () => {
    setDraft(null);
    setSaveMsg(null);
  };

  const save = async () => {
    if (!draft) return;
    const issues = validateConfigSet(draft);
    if (issues.length) {
      setSaveMsg(`Not saved — ${issues.length} validation issue(s): ${issues.slice(0, 3).map((i) => `${i.path}: ${i.message}`).join("; ")}`);
      return;
    }
    if (!note.trim()) {
      setSaveMsg("Not saved — a note explaining the change is required (audit trail).");
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(effectiveFrom)) {
      setSaveMsg("Not saved — effective-from month required.");
      return;
    }
    const id = `v${versions.length + 1}-${effectiveFrom}`;
    await saveVersion({ id, effectiveFrom, note: note.trim(), set: draft, savedAt: Date.now() });
    setDraft(null);
    setNote("");
    setSaveMsg(`Saved ${id}, effective ${effectiveFrom}. Months before keep their card; closes from ${effectiveFrom} price on it.`);
    refresh();
  };

  const toggleSource = async (c: Carrier) => {
    const next: Record<Carrier, RateSource> = {
      ...rateSource,
      [c]: rateSource[c] === "calibrated" ? "printed_override" : "calibrated",
    };
    setRateSource(next);
    await saveSettings({ rateSource: next });
  };

  const num = (v: number, onChange: (n: number) => void, step = 0.01) =>
    editing ? (
      <input
        type="number"
        step={step}
        value={Number.isFinite(v) ? v : ""}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="tnum w-24 rounded border border-slate-300 px-1.5 py-0.5 text-right text-sm"
      />
    ) : (
      <span className="tnum">{v}</span>
    );

  const upd = (fn: (d: ConfigSet) => void) => {
    setDraft((d) => {
      if (!d) return d;
      const next = clone(d);
      fn(next);
      return next;
    });
  };

  const indices = accrualRun.calibration.rateIndex.aprilByCarrier;

  return (
    <div className="space-y-6">
      <Card
        title="Card in force"
        subtitle="Pick a month to see (or change) the rate card the engine prices that month with. Editing never touches history: it creates a new version from your chosen month forward."
        right={
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={viewMonth}
              onChange={(e) => {
                setViewMonth(e.target.value);
                setDraft(null);
              }}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
            {!editing ? (
              <button
                onClick={startEdit}
                className="rounded-lg bg-ink px-3 py-1.5 text-sm font-semibold text-parchment hover:bg-ink/85"
              >
                Edit → new version
              </button>
            ) : (
              <button
                onClick={cancelEdit}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            )}
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
          <Badge className="bg-slate-100 text-slate-700 ring-slate-200">{resolved.id}</Badge>
          <span>
            effective {resolved.effectiveFrom === "0000-01" ? "from the start (bundled)" : resolved.effectiveFrom} ·{" "}
            {resolved.note}
          </span>
        </div>
        {editing && (
          <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600">
                New version effective from
              </span>
              <input
                type="month"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block grow text-sm">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-600">
                Note (why — required)
              </span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Heartland 2026 repricing letter, zones +10%"
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>
            <button
              onClick={save}
              className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-parchment hover:bg-ink/85"
            >
              Save version
            </button>
          </div>
        )}
        {saveMsg && (
          <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-inset ring-slate-200">
            {saveMsg}
          </p>
        )}
      </Card>

      {/* Calibration: printed card vs invoice index (moved here from the Overview) */}
      <Card
        title="Calibration: printed card vs invoice reality"
        subtitle="Each carrier applies a monthly rate index on top of the printed card. We calibrate it from invoices; the printed card alone is stale — in both directions."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4 font-medium">Carrier</th>
                <th className="py-2 pr-4 text-right font-medium">Calibrated index</th>
                <th className="py-2 pr-4 text-right font-medium">Range (6 mo)</th>
                <th className="py-2 pr-4 text-right font-medium">Printed card</th>
              </tr>
            </thead>
            <tbody className="tnum">
              {(["peak", "heartland", "coastal"] as const).map((c) => {
                const idx = accrualRun.calibration.rateIndex.aprilByCarrier[c];
                const stats = accrualRun.calibration.rateIndex.statsByCarrier[c];
                const div = accrualRun.calibration[c].divergence;
                return (
                  <tr key={c} className="border-b border-slate-100">
                    <td className="py-2 pr-4">{carrierName[c]}</td>
                    <td className="py-2 pr-4 text-right font-medium">{idx.toFixed(3)}×</td>
                    <td className="py-2 pr-4 text-right text-xs text-slate-500">
                      {stats.min.toFixed(2)}–{stats.max.toFixed(2)}
                    </td>
                    <td className="py-2 pr-4 text-right text-xs">
                      <span className={div.direction === "printed_high" ? "text-amber-700" : "text-sky-700"}>
                        runs {fmtSignedPct(div.divergencePct)} {div.direction === "printed_high" ? "high" : "low"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-600">
          Peak&apos;s printed card runs high (≈ the findings&apos; ~20%); Heartland&apos;s and Coastal&apos;s run low
          recently. Calibrating from invoices catches both directions — a static card cannot.
        </p>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Peak */}
        <Card title="Peak Logistics" subtitle="per-mile by weight tier × monthly index + FSC">
          <table className="w-full text-sm">
            <tbody>
              {set.peak.weightTiers.map((t, i) => (
                <tr key={t.key} className="border-b border-slate-100">
                  <td className="py-1.5 pr-2 text-slate-600">{t.label}</td>
                  <td className="py-1.5 text-right">
                    {num(t.printedRatePerMile, (n) => upd((d) => void (d.peak.weightTiers[i].printedRatePerMile = n)))}{" "}
                    <span className="text-xs text-slate-400">/mi</span>
                  </td>
                </tr>
              ))}
              <tr className="border-b border-slate-100">
                <td className="py-1.5 pr-2 text-slate-600">Fuel surcharge</td>
                <td className="py-1.5 text-right">
                  {num(set.peak.fuelSurchargePct, (n) => upd((d) => void (d.peak.fuelSurchargePct = n)), 0.001)}{" "}
                  <span className="text-xs text-slate-400">(of base)</span>
                </td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-1.5 pr-2 text-slate-600">Minimum charge</td>
                <td className="py-1.5 text-right">
                  $ {num(set.peak.minChargePerShipment, (n) => upd((d) => void (d.peak.minChargePerShipment = n)))}
                </td>
              </tr>
              {Object.entries(set.peak.accessorials).map(([code, fee]) => (
                <tr key={code} className="border-b border-slate-100">
                  <td className="py-1.5 pr-2 text-slate-600">Accessorial · {code}</td>
                  <td className="py-1.5 text-right">
                    $ {num(fee, (n) => upd((d) => void (d.peak.accessorials[code] = n)))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {REPRESENTATIVE.peak && <WorkedExample e={REPRESENTATIVE.peak} />}
        </Card>

        {/* Heartland */}
        <Card title="Heartland Freight" subtitle="flat zone rate (fuel incl.) × index × QTD volume discount">
          <table className="w-full text-sm">
            <tbody>
              {Object.entries(set.heartland.printedZoneRates).map(([zone, rate]) => (
                <tr key={zone} className="border-b border-slate-100">
                  <td className="py-1.5 pr-2 text-slate-600">Zone {zone}</td>
                  <td className="py-1.5 text-right">
                    $ {num(rate, (n) => upd((d) => void (d.heartland.printedZoneRates[zone] = n)))}
                  </td>
                </tr>
              ))}
              {set.heartland.volumeTiers.map((t, i) => (
                <tr key={t.tier} className="border-b border-slate-100">
                  <td className="py-1.5 pr-2 text-slate-600">
                    Tier {t.tier} · QTD {t.minQtd}–{t.maxQtd ?? "∞"}
                  </td>
                  <td className="py-1.5 text-right">
                    {num(t.discount, (n) => upd((d) => void (d.heartland.volumeTiers[i].discount = n)), 0.01)}{" "}
                    <span className="text-xs text-slate-400">discount</span>
                  </td>
                </tr>
              ))}
              {Object.entries(set.heartland.accessorials).map(([code, fee]) => (
                <tr key={code} className="border-b border-slate-100">
                  <td className="py-1.5 pr-2 text-slate-600">Accessorial · {code}</td>
                  <td className="py-1.5 text-right">
                    $ {num(fee, (n) => upd((d) => void (d.heartland.accessorials[code] = n)))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-slate-400">
            Zone ZIP-prefix boundaries are structural (view-only here); tier thresholds reset {set.heartland.volumeDiscount.resetDates.join(" / ")}.
          </p>
          {REPRESENTATIVE.heartland && <WorkedExample e={REPRESENTATIVE.heartland} />}
        </Card>

        {/* Coastal */}
        <Card title="Coastal Express" subtitle="per-lb by region × index, min charge, FSC, residential tiers">
          <table className="w-full text-sm">
            <tbody>
              {set.coastal.regions.map((r, i) => (
                <tr key={r.key} className="border-b border-slate-100">
                  <td className="py-1.5 pr-2 text-slate-600">{r.label}</td>
                  <td className="py-1.5 text-right">
                    $ {num(r.printedPerLb, (n) => upd((d) => void (d.coastal.regions[i].printedPerLb = n)), 0.001)}{" "}
                    <span className="text-xs text-slate-400">/lb</span>
                  </td>
                </tr>
              ))}
              <tr className="border-b border-slate-100">
                <td className="py-1.5 pr-2 text-slate-600">Minimum charge</td>
                <td className="py-1.5 text-right">
                  $ {num(set.coastal.minChargePerShipment, (n) => upd((d) => void (d.coastal.minChargePerShipment = n)))}
                </td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-1.5 pr-2 text-slate-600">Fuel surcharge</td>
                <td className="py-1.5 text-right">
                  {num(set.coastal.fuelSurchargePct, (n) => upd((d) => void (d.coastal.fuelSurchargePct = n)), 0.001)}{" "}
                  <span className="text-xs text-slate-400">(of base)</span>
                </td>
              </tr>
              {set.coastal.residentialSurchargeTiers.map((t, i) => (
                <tr key={t.label} className="border-b border-slate-100">
                  <td className="py-1.5 pr-2 text-slate-600">Residential · {t.label}</td>
                  <td className="py-1.5 text-right">
                    $ {num(t.fee, (n) => upd((d) => void (d.coastal.residentialSurchargeTiers[i].fee = n)))}
                  </td>
                </tr>
              ))}
              {Object.entries(set.coastal.accessorials).map(([code, fee]) => (
                <tr key={code} className="border-b border-slate-100">
                  <td className="py-1.5 pr-2 text-slate-600">Accessorial · {code}</td>
                  <td className="py-1.5 text-right">
                    $ {num(fee, (n) => upd((d) => void (d.coastal.accessorials[code] = n)))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {REPRESENTATIVE.coastal && <WorkedExample e={REPRESENTATIVE.coastal} />}
        </Card>
      </div>

      <MileageTable set={set} />

      <LookupTables set={set} />

      <Card
        title="Rate source per carrier"
        subtitle="Default is calibrated (printed card × monthly index from invoice history). printed_override prices the card at face value — used before history exists for a new card; the divergence is always flagged, never silent."
      >
        <ul className="divide-y divide-slate-100">
          {(["peak", "heartland", "coastal"] as Carrier[]).map((c) => (
            <li key={c} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
              <span className="w-40 font-medium text-slate-800">{carrierName[c]}</span>
              <Badge
                className={
                  rateSource[c] === "calibrated"
                    ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
                    : "bg-amber-100 text-amber-800 ring-amber-200"
                }
              >
                {rateSource[c]}
              </Badge>
              <span className="text-xs text-slate-500">
                calibrated index (recent window): {indices[c]} — printed card would price{" "}
                {fmtPct(Math.abs(1 - indices[c]) / indices[c])} {indices[c] < 1 ? "higher" : "lower"}
              </span>
              <button
                onClick={() => toggleSource(c)}
                className="ml-auto rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Switch to {rateSource[c] === "calibrated" ? "printed_override" : "calibrated"}
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          Applies to the next close you run on the Run a close tab (saved in this browser).
        </p>
      </Card>

      <Card title="Version history" subtitle="Every saved card version, oldest first. Deleting a version does not touch saved closes — they store the run they produced.">
        <ul className="divide-y divide-slate-100 text-sm">
          {[BUNDLED_VERSION, ...versions].map((v) => (
            <li key={v.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <Badge className="bg-slate-100 text-slate-700 ring-slate-200">{v.id}</Badge>
              <span className="text-slate-600">
                effective {v.effectiveFrom === "0000-01" ? "start" : v.effectiveFrom}
              </span>
              <span className="text-xs text-slate-500">{v.note}</span>
              {v.id !== BUNDLED_VERSION.id && (
                <button
                  onClick={() => deleteVersion(v.id).then(refresh)}
                  className="ml-auto rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                >
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
