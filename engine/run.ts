// Engine entrypoint (Node shell). Runs at build time (prebuild), feeds the
// bundled CSVs to the pure period-aware orchestrator (engine/close.ts), and
// writes the typed AccrualRun JSON the UI renders plus the NetSuite JE CSV and
// shipment-backup CSV. Deterministic; no env vars; no runtime FS reads in the
// app. The same runClose() also powers in-browser closes on /close.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadPeriod } from "./load";
import { runClose, shipmentBackupCsv } from "./close";
import { buildHistoricalJournals } from "./history";
import { journalEntryToCsv } from "./je";
import { buildClosedPeriods, buildPeriodsIndex } from "./reconcile";
import { buildMayScenario } from "./may";
import { writeSamples } from "./samples";

const GEN_DIR = join(process.cwd(), "app", "_generated");
const PUBLIC_DIR = join(process.cwd(), "public");

// The build-time hero close. April 2026 ("2604") is the open period; its
// shipments are priced against the calibrated invoice history of the closed
// months that precede it. periods.json keeps April's own invoices null.
const HERO_PERIOD_ID = "2604";

function main() {
  const period = loadPeriod(HERO_PERIOD_ID);
  const { periodKey, shipments, duplicateShipmentIds, invoices, denise, ingestExceptions, normalization } = period;

  const run = runClose({
    periodKey,
    shipments,
    duplicateShipmentIds,
    invoices,
    denise,
    ingestExceptions,
  });

  const slug = run.period.toLowerCase().replace(/\s+/g, "-"); // "april-2026"
  mkdirSync(GEN_DIR, { recursive: true });
  mkdirSync(PUBLIC_DIR, { recursive: true });
  writeFileSync(join(GEN_DIR, "accrualRun.json"), JSON.stringify(run, null, 2) + "\n", "utf8");
  // Typed bundled inputs for the in-browser engine (/close uploads, /method
  // sensitivity lab): invoice history, Denise baseline, and the April
  // shipments so the client can re-run the close under varied parameters.
  writeFileSync(
    join(GEN_DIR, "baseInputs.json"),
    JSON.stringify({ invoices, denise, shipments, duplicateShipmentIds }) + "\n",
    "utf8"
  );
  // Prior months recreated from actual invoices (one balanced JE per month).
  writeFileSync(
    join(GEN_DIR, "historicalJournal.json"),
    JSON.stringify(buildHistoricalJournals(invoices), null, 2) + "\n",
    "utf8"
  );
  writeFileSync(join(PUBLIC_DIR, `freightclose-je-${slug}.csv`), journalEntryToCsv(run.journalEntry), "utf8");
  writeFileSync(join(PUBLIC_DIR, `freightclose-shipment-backup-${slug}.csv`), shipmentBackupCsv(run), "utf8");

  // Multi-period: the period index (UI nav/badges) + the closed-period three-way
  // reconciliations (engine estimate vs actual + signed true-up JE, badged
  // "Reconstructed from invoices"). April stays the open hero (no actuals); May
  // is synthetic (a later task) — only closed months are reconciled here.
  const periodsIndex = buildPeriodsIndex();
  const closedPeriods = buildClosedPeriods();
  writeFileSync(join(GEN_DIR, "periodsIndex.json"), JSON.stringify(periodsIndex, null, 2) + "\n", "utf8");
  writeFileSync(join(GEN_DIR, "closedPeriods.json"), JSON.stringify(closedPeriods, null, 2) + "\n", "utf8");
  for (const cp of closedPeriods) {
    const cpSlug = cp.label.toLowerCase().replace(/\s+/g, "-"); // "october-2025"
    // -TRUEUP: a true-up is a distinct entry from the month's original accrual.
    writeFileSync(join(PUBLIC_DIR, `freightclose-trueup-je-${cpSlug}.csv`), journalEntryToCsv(cp.trueUpJournal, { externalIdSuffix: "-TRUEUP" }), "utf8");
  }

  // May 2026 — synthetic adaptability scenario (no-change vs Peak fuel spike).
  // Badged synthetic; kept in its own artifact, never merged with the real
  // periods (the real/synthetic boundary stays physical).
  const may = buildMayScenario();
  writeFileSync(join(GEN_DIR, "mayScenario.json"), JSON.stringify(may, null, 2) + "\n", "utf8");
  for (const v of may.variants) {
    // Distinct NetSuite ExternalID per variant — the two synthetic scenarios are
    // mutually exclusive, but must not collide on import (FREIGHTCLOSE-2026-05).
    writeFileSync(
      join(PUBLIC_DIR, `freightclose-trueup-je-may-2026-${v.key}.csv`),
      journalEntryToCsv(v.trueUpJournal, { externalIdSuffix: `-TRUEUP-${v.key.toUpperCase()}` }),
      "utf8"
    );
  }

  // Sample datasets for the in-browser "Load Sample…" data-entry mode: each
  // period's CSVs, normalized, copied to public/samples/<id>/ + a client-safe
  // manifest (carries the real/synthetic badge). Never read by the app at runtime.
  const samples = writeSamples(PUBLIC_DIR, GEN_DIR);

  // eslint-disable-next-line no-console
  console.log(
    `[engine] ${run.period.split(" ")[0]} accrual $${run.totalAccrual.toLocaleString()} | ${run.shipmentEstimates.length} shipments | ` +
      `${run.exceptions.length} exceptions | tie-outs ${run.allTieOutsPassed ? "PASS" : "FAIL"} | ` +
      `recon max err $${run.backtest.reconstruction.byCarrierMonthMaxErrorDollars}`
  );
  // Closed-period reconciliation controls: every true-up JE must balance and the
  // actual register must tie to Denise's recorded actual_invoiced (to the cent).
  const trueUpUnbalanced = [
    ...closedPeriods.filter((c) => !c.trueUpJournal.balanced),
    ...may.variants.filter((v) => !v.trueUpJournal.balanced).map((v) => ({ label: `May ${v.key}` })),
  ];
  const deniseUntied = closedPeriods.filter((c) => !c.actualsReconcileToDenise);
  // eslint-disable-next-line no-console
  console.log(`[engine] sample datasets exported: ${samples.length} periods → public/samples/`);
  // eslint-disable-next-line no-console
  console.log(
    `[engine] closed periods ${closedPeriods.length} reconciled | true-up JEs balanced ${closedPeriods.length - closedPeriods.filter((c) => !c.trueUpJournal.balanced).length}/${closedPeriods.length} | ` +
      `actual↔Denise tie-outs ${closedPeriods.length - deniseUntied.length}/${closedPeriods.length}`
  );
  // eslint-disable-next-line no-console
  console.log(
    `[engine] May scenario: engine spike uplift $${may.engineSpikeUplift.toLocaleString()} | actual spike Δ $${may.actualSpikeDelta.toLocaleString()} (Peak fuel) | ` +
      `blind under-accrual $${may.blindUnderAccrual.toLocaleString()} | both true-ups balanced ${may.variants.every((v) => v.trueUpJournal.balanced) ? "yes" : "NO"}`
  );
  // eslint-disable-next-line no-console
  console.log(
    `[engine] ingest normalized ${normalization.monthsNormalized} month label(s) + ${normalization.datesNormalized} date(s); ` +
      `${normalization.unparseableMonths.length} unparseable month(s), ${normalization.unparseableDates.length} unparseable date(s) (Finding 0 controls)`
  );

  if (!run.allTieOutsPassed) {
    // eslint-disable-next-line no-console
    console.error("[engine] TIE-OUTS FAILED:", run.tieOuts.filter((t) => !t.passed));
    process.exit(1);
  }
  if (trueUpUnbalanced.length) {
    // eslint-disable-next-line no-console
    console.error("[engine] TRUE-UP JE UNBALANCED:", trueUpUnbalanced.map((c) => c.label));
    process.exit(1);
  }
}

main();
