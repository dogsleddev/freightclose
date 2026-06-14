// Build-time sample export. Copies each period's shipments/invoices/Denise CSVs
// to public/samples/<id>/ — NORMALIZED on the way out (Oct-25 → October 2025,
// M/D/YYYY → ISO) so the in-browser "Load Sample…" path can fetch the raw text
// and run it straight through the same client close pipeline (closeClient) with
// no Finding-0 collapse. Emits app/_generated/sampleManifest.json (client-safe
// index with the real/synthetic badge). Build-time only; never read by the app.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseCsvObjects } from "./csv";
import { loadPeriodsIndex } from "./load";
import {
  newNormalizationReport,
  normalizeShipmentRows,
  normalizeInvoiceRows,
  normalizeDeniseRows,
} from "./normalize";

const DATA_DIR = join(process.cwd(), "data");

function rowsToCsv(rows: Record<string, string>[]): string {
  if (!rows.length) return "";
  const header = Object.keys(rows[0]);
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const lines = [header.join(",")];
  for (const r of rows) lines.push(header.map((h) => esc(r[h] ?? "")).join(","));
  return lines.join("\n") + "\n";
}

export interface SampleManifestEntry {
  id: string;
  label: string;
  period: string;
  status: "closed" | "open" | "simulated";
  source: "real" | "synthetic";
  badge: string;
  files: { shipments: string; invoices?: string; denise?: string };
}

export function writeSamples(publicDir: string, genDir: string): SampleManifestEntry[] {
  const index = loadPeriodsIndex();
  const manifest: SampleManifestEntry[] = [];

  for (const p of index.periods) {
    const dir = join(publicDir, "samples", p.id);
    mkdirSync(dir, { recursive: true });
    const report = newNormalizationReport();
    const files: SampleManifestEntry["files"] = { shipments: `/samples/${p.id}/shipments.csv` };

    const shipRows = normalizeShipmentRows(
      parseCsvObjects(readFileSync(join(DATA_DIR, p.files.shipments), "utf8")),
      p.files.shipments,
      report
    );
    writeFileSync(join(dir, "shipments.csv"), rowsToCsv(shipRows), "utf8");

    if (p.files.invoices) {
      const invRows = normalizeInvoiceRows(
        parseCsvObjects(readFileSync(join(DATA_DIR, p.files.invoices), "utf8")),
        p.files.invoices,
        report
      );
      writeFileSync(join(dir, "invoices.csv"), rowsToCsv(invRows), "utf8");
      files.invoices = `/samples/${p.id}/invoices.csv`;
    }

    if (p.files.denise) {
      const denRows = normalizeDeniseRows(
        parseCsvObjects(readFileSync(join(DATA_DIR, p.files.denise), "utf8")),
        p.files.denise,
        report
      );
      writeFileSync(join(dir, "denise.csv"), rowsToCsv(denRows), "utf8");
      files.denise = `/samples/${p.id}/denise.csv`;
    }

    manifest.push({
      id: p.id,
      label: p.label,
      period: p.period,
      status: p.status,
      source: p.source,
      badge: p.badge,
      files,
    });
  }

  writeFileSync(join(genDir, "sampleManifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
  return manifest;
}
