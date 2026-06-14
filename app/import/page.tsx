import { PageHeader } from "@/components/ui";
import { ImportPanel } from "@/components/close/ImportPanel";

export const metadata = { title: "Data Import — Freight Close" };

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Data import"
        lead="Two ways in, one engine. Load a bundled sample period to price it instantly in your browser, or upload your own shipments CSV — validated against the challenge schema, every fallback flagged. No server, no database; the same deterministic engine the build runs."
      />
      <ImportPanel />
    </div>
  );
}
