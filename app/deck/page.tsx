import { PageHeader } from "@/components/ui";

// In-app rendering of the Loom slide deck — the standalone summary of the build.
// Each slide is a 16:9 panel that uses container-query units (cqw) so all type
// and spacing scale with the panel width and never overflow. Colors are LITERAL
// brand values (not the themed tokens) so the deck looks identical in light and
// dark mode — a presentation should not flip with the app theme. The same
// content ships as a downloadable .pptx (button below) for the Loom screen-share.

export const metadata = { title: "Slide deck — Freight Close" };

const INK = "#0E1116",
  INK2 = "#161A21",
  PARCH = "#F4EDDB",
  PAPER = "#FFFFFF",
  TRAIL = "#E66A3C",
  PINE = "#2A8E6D",
  PINEL = "#6FE0B4",
  SKY = "#4A779E",
  MUTE = "#6B6450",
  MUTEL = "#AEB4BF",
  LINE = "#E6DCC1",
  BORDERD = "#2A3038";

type Kids = React.ReactNode;

function Panel({ dark = false, n, children }: { dark?: boolean; n: number; children: Kids }) {
  return (
    <section
      className="relative mx-auto aspect-[16/9] w-full max-w-5xl overflow-hidden rounded-xl shadow-sm"
      style={{ containerType: "inline-size", background: dark ? INK : PAPER, color: dark ? PARCH : INK, border: `1px solid ${dark ? BORDERD : LINE}` }}
    >
      <div className="flex h-full w-full flex-col p-[5cqw]">{children}</div>
      <span className="absolute text-[1.4cqw]" style={{ right: "3cqw", bottom: "2.4cqw", color: dark ? MUTEL : MUTE, opacity: 0.65 }}>
        {n}
      </span>
    </section>
  );
}

function Title({ dark, children, sub }: { dark?: boolean; children: Kids; sub?: string }) {
  return (
    <div className="shrink-0">
      <h2 className="font-serif font-bold leading-tight text-[3.4cqw]" style={{ color: dark ? PARCH : INK }}>
        {children}
      </h2>
      {sub && (
        <p className="mt-[0.6cqw] text-[1.7cqw] leading-snug" style={{ color: dark ? MUTEL : MUTE }}>
          {sub}
        </p>
      )}
    </div>
  );
}

// label + body card (left accent bar)
function BarCard({ label, body, color = TRAIL }: { label: string; body: string; color?: string }) {
  return (
    <div className="relative flex flex-col overflow-hidden rounded-[1cqw] p-[1.8cqw] pl-[2.4cqw]" style={{ background: PAPER, border: `1px solid ${LINE}` }}>
      <span className="absolute left-0 top-0 h-full w-[0.6cqw]" style={{ background: color }} />
      <div className="font-serif font-bold text-[1.9cqw]" style={{ color: INK }}>
        {label}
      </div>
      <div className="mt-[0.5cqw] text-[1.45cqw] leading-snug" style={{ color: MUTE }}>
        {body}
      </div>
    </div>
  );
}

// label + body card with a numbered chip
function ChipCard({ n, label, body, color = TRAIL }: { n: number; label: string; body: string; color?: string }) {
  return (
    <div className="flex gap-[1.4cqw] rounded-[1cqw] p-[1.8cqw]" style={{ background: PAPER, border: `1px solid ${LINE}` }}>
      <span className="flex h-[3cqw] w-[3cqw] shrink-0 items-center justify-center rounded-full font-serif font-bold text-[1.6cqw] text-white" style={{ background: color }}>
        {n}
      </span>
      <div className="min-w-0">
        <div className="font-serif font-bold text-[1.9cqw]" style={{ color: INK }}>
          {label}
        </div>
        <div className="mt-[0.4cqw] text-[1.45cqw] leading-snug" style={{ color: MUTE }}>
          {body}
        </div>
      </div>
    </div>
  );
}

export default function DeckPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Slide deck"
        lead="The standalone summary of Freight Close — the same deck that bookends the walkthrough. Watch the full walkthrough, flip through the slides here, or download the PowerPoint."
      />
      <div className="flex flex-wrap items-center gap-3">
        <a
          href="https://www.loom.com/share/8189ec40ebe341b7a003493986b7c840"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-trail px-4 py-2 text-sm font-medium text-white hover:bg-trail-dark"
        >
          ▶ Watch the walkthrough
        </a>
        <a
          href="https://github.com/dogsleddev/freightclose"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          View the repo ↗
        </a>
        <a
          href="/freight-close-deck.pptx"
          download
          className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-parchment hover:bg-ink/85"
        >
          Download .pptx ↓
        </a>
      </div>

      <div className="space-y-5">
        {/* 1 — Title */}
        <Panel dark n={1}>
          <div className="flex h-full flex-col justify-center">
            <div className="font-serif font-bold leading-none text-[7cqw]">
              <span style={{ color: PARCH }}>Freight </span>
              <span style={{ color: TRAIL }}>Close</span>
            </div>
            <p className="mt-[2cqw] text-[2.3cqw]" style={{ color: PARCH }}>
              Calibrated freight-accrual engine + month-end close · Ridgeline Foods
            </p>
            <p className="mt-[1cqw] text-[1.6cqw]" style={{ color: MUTEL }}>
              Numeric Finance Engineer Cup — Round 1
            </p>
            <p className="mt-[3cqw] text-[1.7cqw] font-medium">
              <span style={{ color: PARCH }}>Chris Dougherty</span>
              <span style={{ color: TRAIL }}> · freightclose.dogsled.dev</span>
            </p>
          </div>
        </Panel>

        {/* 2 — Problem */}
        <Panel n={2}>
          <Title sub="Ridgeline accrues freight at month-end, before the carrier invoices arrive.">
            The problem with the old accrual
          </Title>
          <div className="mt-[3cqw] grid flex-1 grid-cols-3 gap-[2cqw]">
            <ChipCard n={1} label="Black box" body="Denise's trailing-average estimate is never tied to what actually shipped this month." />
            <ChipCard n={2} label="Blind to change" body="A trailing average can't see a rate change coming — it only reacts after the fact." />
            <ChipCard n={3} label="No controls" body="No validation, no exception flags, no audit trail. Automating it just automates the errors." />
          </div>
        </Panel>

        {/* 3 — Approach */}
        <Panel n={3}>
          <Title sub="Instead of trusting stale printed rate cards, recover the real effective rates from the carriers' own history.">
            Price what actually shipped — calibrated from invoices
          </Title>
          <div className="mt-[3cqw] flex flex-1 items-center">
            <div className="flex w-full items-stretch gap-[1cqw]">
              {[
                ["Shipments in", "upload or sample"],
                ["Normalize", "dedup · impute · flag"],
                ["Calibrate", "from 6 mo of invoices"],
                ["Price each shipment", "base · fuel · accessorials"],
                ["Accrual + JE", "ties to every shipment"],
              ].map((s, i, arr) => (
                <div key={s[0]} className="flex flex-1 items-center gap-[1cqw]">
                  <div
                    className="flex flex-1 flex-col rounded-[1cqw] p-[1.4cqw]"
                    style={{ background: i === 2 ? INK : PAPER, border: `1px solid ${i === 2 ? INK : LINE}` }}
                  >
                    <span className="flex h-[2.4cqw] w-[2.4cqw] items-center justify-center rounded-full font-serif font-bold text-[1.3cqw] text-white" style={{ background: TRAIL }}>
                      {i + 1}
                    </span>
                    <div className="mt-[0.8cqw] font-serif font-bold text-[1.5cqw]" style={{ color: i === 2 ? PARCH : INK }}>
                      {s[0]}
                    </div>
                    <div className="mt-[0.3cqw] text-[1.15cqw] leading-snug" style={{ color: i === 2 ? MUTEL : MUTE }}>
                      {s[1]}
                    </div>
                  </div>
                  {i < arr.length - 1 && (
                    <span className="font-serif text-[2.4cqw] font-bold" style={{ color: TRAIL }}>
                      ›
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
          <p className="shrink-0 text-[1.45cqw] italic" style={{ color: MUTE }}>
            Then reconcile: when the invoices land, the estimate is trued-up and the variance feeds next month's calibration.
          </p>
        </Panel>

        {/* 4 — April hero */}
        <Panel n={4}>
          <Title sub="A point estimate with a band, not a single guess. Every figure ties to shipment-level backup.">
            April 2026 — the close
          </Title>
          <div className="mt-[3cqw] grid flex-1 grid-cols-4 gap-[2cqw]">
            {[
              ["$93,530", "recommended accrual", TRAIL],
              ["$86K–$101K", "confidence band (±1σ)", INK],
              ["−0.23%", "6-mo back-test bias", PINE],
              ["±$0.32", "recon error · 811 invoices", PINE],
            ].map((s) => (
              <div key={s[1]} className="flex flex-col items-center justify-center rounded-[1cqw] px-[1cqw] py-[2cqw] text-center" style={{ background: PAPER, border: `1px solid ${LINE}` }}>
                <div className="font-serif font-bold leading-tight text-[3.6cqw]" style={{ color: s[2] }}>
                  {s[0]}
                </div>
                <div className="mt-[1cqw] text-[1.4cqw] leading-snug" style={{ color: MUTE }}>
                  {s[1]}
                </div>
              </div>
            ))}
          </div>
          <p className="shrink-0 text-[1.45cqw] italic" style={{ color: MUTE }}>
            160 shipments priced · 811 invoice lines calibrated · all 8 tie-outs pass · reproduces six months of invoices to the cent.
          </p>
        </Panel>

        {/* 5 — Data */}
        <Panel n={5}>
          <Title sub="DATA is graded. Nothing is dropped or defaulted silently; every assumption raises a flag.">
            Messy data, handled — and flagged
          </Title>
          <div className="mt-[2.5cqw] grid flex-1 grid-cols-3 grid-rows-2 gap-[1.6cqw]">
            <BarCard label="Deduplicated" body="161 rows → 160 unique (SHP-10033 caught & flagged)" />
            <BarCard label="Carrier names" body="9 variants normalized (PEAK LOG, HEARTLAND, …)" />
            <BarCard label="Missing weight" body="5 blanks imputed and flagged — never zeroed" />
            <BarCard label="Mileage handling" body="Off-table lanes recovered from invoices; SLC origin flagged as a Denver-mileage assumption" />
            <BarCard label="ZIP-based zones" body="ZIP-prefix zones / ZIP-range regions, not state" />
            <BarCard label="Date serialization" body="normalized on ingest — Finding 0: no silent collapse" />
          </div>
          <p className="mt-[1.5cqw] shrink-0 text-[1.45cqw] italic" style={{ color: MUTE }}>
            23 flags this month · <span style={{ color: PINE, fontWeight: 700 }}>0 blocking</span> · the register reads “ready to close.”
          </p>
        </Panel>

        {/* 6 — Tie-out */}
        <Panel n={6}>
          <Title sub="Denise's number is a black box. Here, any booked dollar drills to the shipment that produced it.">
            Every dollar ties to a shipment
          </Title>
          <div className="mt-[3cqw] flex flex-1 gap-[2cqw]">
            <div className="flex flex-[1.3] flex-col rounded-[1cqw] p-[2.2cqw]" style={{ background: PAPER, border: `1px solid ${LINE}` }}>
              <div className="font-serif font-bold text-[1.7cqw]" style={{ color: INK }}>
                Shipment calc trace — every variable shown
              </div>
              <div className="mt-[1.4cqw] space-y-[0.8cqw] text-[1.45cqw]">
                <div style={{ color: INK, fontWeight: 700 }}>Base&nbsp;&nbsp;rate × weight tier × calibrated index</div>
                <div style={{ color: MUTE }}>+ Fuel surcharge (calibrated %)</div>
                <div style={{ color: MUTE }}>+ Accessorials (residential, liftgate, …)</div>
                <div style={{ color: MUTE }}>+ Minimum / floor where it applies</div>
              </div>
              <div className="mt-[1.6cqw] font-serif font-bold text-[1.9cqw]" style={{ color: TRAIL }}>
                = Shipment total
              </div>
            </div>
            <div className="flex flex-1 flex-col items-center justify-center rounded-[1cqw] p-[2cqw] text-center" style={{ background: INK }}>
              <div className="font-serif font-bold leading-none text-[6cqw]" style={{ color: PARCH }}>
                160
              </div>
              <div className="mt-[1cqw] text-[1.5cqw]" style={{ color: MUTEL }}>
                shipments, each with its full calc trace
              </div>
              <div className="mt-[1.4cqw] text-[1.3cqw] italic leading-snug" style={{ color: PARCH }}>
                Audit-ready: follow any journal-entry dollar down to a single shipment.
              </div>
            </div>
          </div>
        </Panel>

        {/* 7 — Controls */}
        <Panel n={7}>
          <Title sub="Automating an estimate without controls just automates the errors faster.">
            Controls, not just an estimate
          </Title>
          <div className="mt-[2.5cqw] grid flex-1 grid-cols-2 grid-rows-3 gap-[1.4cqw]">
            <ChipCard n={1} color={PINE} label="Exception register" body="risk levels per flag + reviewer disposition notes" />
            <ChipCard n={2} color={PINE} label="Materiality bands" body="green ≤5% · amber ≤10% · red >10% escalate" />
            <ChipCard n={3} color={PINE} label="Tie-outs" body="JE balances · per-carrier sums to total · no negatives" />
            <ChipCard n={4} color={PINE} label="Rate-divergence flag" body="raised when the estimate strays from the trailing anchor" />
            <ChipCard n={5} color={PINE} label="Reproducible" body="recompute from stored inputs — bit-for-bit" />
            <ChipCard n={6} color={PINE} label="Audit trail" body="inputs, rate-card versions, and timestamped approvals" />
          </div>
        </Panel>

        {/* 8 — Honest accuracy (dark) */}
        <Panel dark n={8}>
          <Title dark sub="A finance judge would test this — so we say it plainly.">
            Honest about accuracy
          </Title>
          <p className="mt-[1.6cqw] shrink-0 text-[1.8cqw] leading-snug">
            <span style={{ color: TRAIL, fontWeight: 700 }}>We do not beat Denise&apos;s headline error</span>
            <span style={{ color: PARCH }}> — a trailing-3-month average smooths rate noise a per-shipment engine can&apos;t foresee.</span>
          </p>
          <div className="mt-[2cqw] grid flex-1 grid-cols-2 gap-[2cqw]">
            {[
              ["Freight Close engine", "≈15% MAPE", "−0.23% bias", "near-unbiased", PINEL],
              ["Denise · trailing avg", "≈8% MAPE", "−3.18% bias", "wins on MAPE · chronic under-accrual", TRAIL],
            ].map((c) => (
              <div key={c[0]} className="flex flex-col justify-center rounded-[1cqw] p-[2cqw]" style={{ background: INK2, border: `1px solid ${BORDERD}` }}>
                <div className="font-serif font-bold text-[1.7cqw]" style={{ color: PARCH }}>
                  {c[0]}
                </div>
                <div className="mt-[0.8cqw] font-serif font-bold text-[2.6cqw]" style={{ color: c[4] }}>
                  {c[1]} &nbsp; {c[2]}
                </div>
                <div className="mt-[0.6cqw] text-[1.3cqw]" style={{ color: MUTEL }}>
                  {c[3]}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-[1.6cqw] shrink-0 text-[1.45cqw] leading-snug" style={{ color: PINEL }}>
            Where we win: ties to a shipment · adapts to rate changes · carries controls · repeatable · near-unbiased · reconstructs 6 months of invoices to the cent ($0.32).
          </p>
        </Panel>

        {/* 9 — Book & lock */}
        <Panel n={9}>
          <Title sub="A controlled close-out — and a routine accrued liability, not a contingency.">
            Book it, lock it, archive it
          </Title>
          <div className="mt-[2.5cqw] grid flex-1 grid-cols-2 grid-rows-2 gap-[1.6cqw]">
            <BarCard color={PINE} label="NetSuite-ready JE" body="Dr Freight Expense by carrier · Cr Accrued Freight Liability — import layout, reverses on invoice receipt." />
            <BarCard color={PINE} label="Control gates" body="Every automated gate must pass and the approver attests the manual reviews before sign-off." />
            <BarCard color={PINE} label="Lock + full archive" body="On approval the period locks and saves the JE, shipment backup, portable HTML, and approval record." />
            <BarCard color={PINE} label="Reopen is audited" body="Re-opening is timestamped and the prior approval stays in the log — nothing is lost." />
          </div>
        </Panel>

        {/* 10 — May adaptability (dark) */}
        <Panel dark n={10}>
          <Title dark sub="Same 160 shipments, two rate worlds — Peak fuel surcharge 14% → 19%.">
            Adaptability — the May fuel spike
          </Title>
          <div className="mt-[2.5cqw] grid flex-1 grid-cols-2 gap-[2cqw]">
            {[
              ["Engine adapts", "+$2,464", "recalibrates to the new rate and flags the divergence", PINEL],
              ["A blind average misses", "−$5,561", "you'd under-accrue until the invoice lands", TRAIL],
            ].map((m) => (
              <div key={m[0]} className="flex flex-col justify-center rounded-[1cqw] p-[2.4cqw]" style={{ background: INK2, border: `1px solid ${BORDERD}` }}>
                <div className="font-serif font-bold text-[1.9cqw]" style={{ color: PARCH }}>
                  {m[0]}
                </div>
                <div className="mt-[0.8cqw] font-serif font-bold leading-none text-[5cqw]" style={{ color: m[3] }}>
                  {m[1]}
                </div>
                <div className="mt-[1cqw] text-[1.4cqw]" style={{ color: MUTEL }}>
                  {m[2]}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-[1.6cqw] shrink-0 text-[1.6cqw] italic" style={{ color: PARCH }}>
            A trailing average physically can&apos;t do this — same shipments, a known and explained change in the number.
          </p>
        </Panel>

        {/* 11 — vs Denise */}
        <Panel n={11}>
          <Title sub="Engine, Denise, and actuals side by side — including where she still wins.">
            The honest head-to-head
          </Title>
          <div className="mt-[3cqw] flex-1 overflow-hidden rounded-[1cqw]" style={{ border: `1px solid ${LINE}` }}>
            <table className="w-full border-collapse text-[1.45cqw]">
              <thead>
                <tr style={{ background: INK, color: PAPER }}>
                  <th className="p-[1.4cqw] text-left font-serif"></th>
                  <th className="p-[1.4cqw] text-center font-serif">Out-of-sample MAPE</th>
                  <th className="p-[1.4cqw] text-center font-serif">Accrual bias</th>
                  <th className="p-[1.4cqw] text-center font-serif">Verdict</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderTop: `1px solid ${LINE}` }}>
                  <td className="p-[1.4cqw] font-serif font-bold" style={{ color: INK }}>Freight Close</td>
                  <td className="p-[1.4cqw] text-center" style={{ color: MUTE }}>≈15%</td>
                  <td className="p-[1.4cqw] text-center font-bold" style={{ color: PINE }}>−0.23% (near-unbiased)</td>
                  <td className="p-[1.4cqw] text-center" style={{ color: MUTE }}>transparency · control · adaptability</td>
                </tr>
                <tr style={{ borderTop: `1px solid ${LINE}` }}>
                  <td className="p-[1.4cqw] font-serif font-bold" style={{ color: INK }}>Denise (trailing avg)</td>
                  <td className="p-[1.4cqw] text-center font-bold" style={{ color: TRAIL }}>≈8% (wins)</td>
                  <td className="p-[1.4cqw] text-center" style={{ color: MUTE }}>−3.18% (chronic under)</td>
                  <td className="p-[1.4cqw] text-center" style={{ color: MUTE }}>lower error, but a black box</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-[1.6cqw] shrink-0 text-[1.45cqw] italic" style={{ color: MUTE }}>
            Quarantined to one tab — we automate Denise&apos;s judgment with controls and adaptability, not a louder accuracy claim.
          </p>
        </Panel>

        {/* 12 — What I'd improve */}
        <Panel n={12}>
          <Title sub="The core is real and shipping today; these are the next steps.">
            What I&apos;d add with more time
          </Title>
          <div className="mt-[2.5cqw] grid flex-1 grid-cols-2 grid-rows-2 gap-[1.6cqw]">
            <ChipCard n={1} color={SKY} label="Live data connections" body="Ramp · Stripe · 3PL · NetSuite feeds instead of CSV upload" />
            <ChipCard n={2} color={SKY} label="Supabase persistence" body="shared, durable rate cards, approvals & audit log across the team" />
            <ChipCard n={3} color={SKY} label="Anomaly detection" body="auto-surface shipments and lanes that don't look right" />
            <ChipCard n={4} color={SKY} label="Richer mileage tables" body="fuller per-origin lane data to retire the mileage assumptions" />
          </div>
        </Panel>

        {/* 13 — Close (dark) */}
        <Panel dark n={13}>
          <div className="flex h-full flex-col justify-center">
            <div className="font-serif font-bold leading-none text-[5.5cqw]">
              <span style={{ color: PARCH }}>Freight </span>
              <span style={{ color: TRAIL }}>Close</span>
            </div>
            <p className="mt-[2.2cqw] text-[2cqw] leading-snug" style={{ color: PARCH }}>
              Prices what shipped · calibrates from invoices · ties every dollar out · carries the controls · adapts when rates move.
            </p>
            <p className="mt-[2cqw] font-serif font-bold text-[2.4cqw]" style={{ color: TRAIL }}>
              freightclose.dogsled.dev
            </p>
            <p className="mt-[3cqw] text-[1.6cqw]" style={{ color: MUTEL }}>
              Thank you.
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}
