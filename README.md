# FreightClose

An accurate, transparent, repeatable **freight-accrual engine + month-end close
workflow** for Ridgeline Foods — built for the Numeric Finance Engineer Cup (Round 1).

FreightClose prices what actually shipped against carrier rates **calibrated from
invoice history** (not the stale printed cards), ties every booked dollar to a
shipment, flags every exception and assumption, books a NetSuite-importable journal
entry, and proves itself against six months of actuals.

## What it does

- **Calibrate-from-invoice accrual engine** — recovers each carrier's effective
  monthly rate index from invoice history and prices every shipment with a full,
  auditable calculation trace. Reconstruction ties every historical invoice to the cent.
- **Month-end close** — per-carrier accrual + confidence band, an exceptions register
  with risk levels, automatic tie-outs, and a CFO sign-off that **locks the period** and
  archives a self-contained portable HTML report.
- **Honest accuracy** — a neutral out-of-sample back-test with a confidence band. A
  trailing average is hard to beat on raw MAPE; FreightClose wins on transparency,
  adaptability, controls, repeatability, and a near-unbiased estimate — and says so plainly.
- **Adaptability demo** — a simulated fuel-surcharge spike: the same shipments, the
  accrual moves by a known, explained amount, and the divergence is flagged. A trailing
  average can't see an announced rate change; the engine can.
- **Data wrangling, surfaced** — dedup, carrier-name normalization, imputed weights,
  per-origin mileage recovery, ZIP-based zones/regions, and on-ingest date normalization —
  every assumption becomes a visible, flagged exception, never a silent default.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # the engine's unit tests
npm run build    # production build (fully static)
```

The app is a **static Next.js client-side app**: the deterministic TypeScript engine runs
in your browser. Uploaded CSVs never leave the device, and saved closes/approvals persist
to the browser's IndexedDB — no server, no database. (A storage interface is in place for a
later Supabase swap.)

## Sample data

The real challenge dataset is **not redistributed**. The app ships a normalized
**"Load Sample…"** mode (`public/samples/`) so it runs instantly with no upload, and the
deterministic engine artifacts in `app/_generated/` are committed so the project builds and
deploys without the raw data. With the raw data present locally, regenerate everything with
`npm run engine`.

## Stack

Next.js 15 · React 19 · TypeScript (client-side compute, no backend) · Tailwind CSS ·
deployed on Vercel.
