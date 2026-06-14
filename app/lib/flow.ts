// Data-driven flow/process diagrams. Each diagram is a small {nodes, edges}
// model laid out on a column/row grid — edit a label/detail/col/row here and the
// <FlowDiagram> renderer re-lays it out, so the diagrams are easy to iterate on
// without touching SVG coordinates. Used by Steps to Use / Steps to Prepare
// Month (and reusable elsewhere). No engine data; pure content.

export type NodeKind = "input" | "process" | "decision" | "output" | "control";

export interface FlowNode {
  id: string;
  label: string;
  detail?: string;
  kind: NodeKind;
  col: number; // 0-based grid column (left → right)
  row: number; // 0-based grid row (top → down)
}

export interface FlowEdge {
  from: string;
  to: string;
  label?: string; // e.g. "pass" / "fail"
  dashed?: boolean;
}

export interface FlowModel {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

// --- Steps to Use — a visitor/judge tour of the app ------------------------

export const STEPS_USE: FlowModel = {
  nodes: [
    { id: "import", kind: "input", col: 0, row: 0, label: "1 · Run a close", detail: "Load a sample period or upload a CSV — priced in-browser" },
    { id: "cfo", kind: "process", col: 1, row: 0, label: "2 · Overview", detail: "Accrual by carrier + confidence band" },
    { id: "exceptions", kind: "control", col: 2, row: 0, label: "3 · Exceptions", detail: "Every flag + how it was handled" },
    { id: "backup", kind: "process", col: 2, row: 1, label: "4 · Shipment Backup", detail: "Drill any dollar to its calc trace" },
    { id: "rates", kind: "process", col: 1, row: 1, label: "5 · Rates & Method", detail: "Calibrated cards + the math" },
    { id: "accuracy", kind: "process", col: 0, row: 1, label: "6 · Accuracy", detail: "Honest back-test; head-to-head on vs. Denise" },
    { id: "closed", kind: "process", col: 0, row: 2, label: "7 · Closed Periods", detail: "Estimate vs actual + true-up JE" },
    { id: "may", kind: "process", col: 1, row: 2, label: "8 · May Scenario", detail: "Adaptability: the fuel-spike what-if" },
    { id: "je", kind: "output", col: 2, row: 2, label: "9 · Journal Entries", detail: "NetSuite-ready entry" },
    { id: "approval", kind: "output", col: 2, row: 3, label: "10 · Approval", detail: "Sign-off → lock + archive" },
  ],
  edges: [
    { from: "import", to: "cfo" },
    { from: "cfo", to: "exceptions" },
    { from: "exceptions", to: "backup" },
    { from: "backup", to: "rates" },
    { from: "rates", to: "accuracy" },
    { from: "accuracy", to: "closed" },
    { from: "closed", to: "may" },
    { from: "may", to: "je" },
    { from: "je", to: "approval" },
  ],
};

// --- Steps to Prepare Month — the operator's month-end runbook -------------

export const STEPS_PREPARE: FlowModel = {
  nodes: [
    { id: "gather", kind: "input", col: 0, row: 0, label: "1 · Gather inputs", detail: "This month's shipments (+ newly arrived invoices)" },
    { id: "validate", kind: "process", col: 1, row: 0, label: "2 · Validate on import", detail: "Schema check; normalize dates/months; flag, never drop" },
    { id: "calibrate", kind: "process", col: 2, row: 0, label: "3 · Calibrate + price", detail: "Effective rates from invoice history → price each shipment" },
    { id: "review", kind: "control", col: 2, row: 1, label: "4 · Review exceptions", detail: "Resolve errors; accept/annotate warnings" },
    { id: "gate", kind: "decision", col: 1, row: 1, label: "Tie-outs pass?", detail: "JE balances · carrier sums · reconstruction" },
    { id: "fix", kind: "control", col: 0, row: 1, label: "Fix & re-run", detail: "Correct inputs/config, recompute" },
    { id: "approve", kind: "process", col: 1, row: 2, label: "5 · CFO sign-off", detail: "Checklist + attestations → Approve" },
    { id: "lock", kind: "output", col: 2, row: 2, label: "6 · Lock + archive", detail: "Period locks; JE + backup + portable HTML saved" },
    { id: "reconcile", kind: "output", col: 2, row: 3, label: "7 · Reconcile next month", detail: "When invoices arrive: true-up on Closed Periods" },
  ],
  edges: [
    { from: "gather", to: "validate" },
    { from: "validate", to: "calibrate" },
    { from: "calibrate", to: "review" },
    { from: "review", to: "gate" },
    { from: "gate", to: "fix", label: "fail", dashed: true },
    { from: "fix", to: "calibrate", dashed: true },
    { from: "gate", to: "approve", label: "pass" },
    { from: "approve", to: "lock" },
    { from: "lock", to: "reconcile" },
  ],
};
