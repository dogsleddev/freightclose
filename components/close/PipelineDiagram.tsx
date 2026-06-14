export function PipelineDiagram() {
  return (
    <div className="overflow-x-auto">
      <svg
        viewBox="0 0 860 980"
        xmlns="http://www.w3.org/2000/svg"
        fontFamily="ui-monospace,monospace"
        fontSize={12}
        style={{ minWidth: 680, width: "100%" }}
        role="img"
      >
        <title>FreightClose: Accrual Pipeline and Exception System</title>
        <desc>
          Flow diagram showing how shipments are priced, exceptions are raised, and the journal entry is produced.
        </desc>

        <defs>
          <marker id="pd-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#64748b" />
          </marker>
        </defs>

        {/* BG */}
        <rect width="860" height="980" fill="#f8fafc" rx="12" />

        {/* ── TITLE ── */}
        <text x="430" y="32" textAnchor="middle" fontSize={15} fontWeight="700" fill="#0f172a">
          FreightClose — Accrual Pipeline &amp; Exception System
        </text>

        {/* ── INPUTS label ── */}
        <text x="430" y="60" textAnchor="middle" fontSize={10} fill="#94a3b8" fontWeight="600" letterSpacing="1">
          INPUTS
        </text>

        {/* Shipments CSV */}
        <rect x="40" y="70" width="150" height="44" rx="6" fill="#dbeafe" stroke="#93c5fd" strokeWidth="1.5" />
        <text x="115" y="88" textAnchor="middle" fontSize={11} fontWeight="700" fill="#1e40af">Shipment CSV</text>
        <text x="115" y="103" textAnchor="middle" fontSize={10} fill="#1e40af">April 2026 rows</text>

        {/* Invoice History */}
        <rect x="220" y="70" width="150" height="44" rx="6" fill="#dbeafe" stroke="#93c5fd" strokeWidth="1.5" />
        <text x="295" y="88" textAnchor="middle" fontSize={11} fontWeight="700" fill="#1e40af">Invoice History</text>
        <text x="295" y="103" textAnchor="middle" fontSize={10} fill="#1e40af">Oct–Mar actuals</text>

        {/* Rate Cards */}
        <rect x="400" y="70" width="150" height="44" rx="6" fill="#dbeafe" stroke="#93c5fd" strokeWidth="1.5" />
        <text x="475" y="88" textAnchor="middle" fontSize={11} fontWeight="700" fill="#1e40af">Rate Cards</text>
        <text x="475" y="103" textAnchor="middle" fontSize={10} fill="#1e40af">config/*.json</text>

        {/* Denise Baseline */}
        <rect x="580" y="70" width="150" height="44" rx="6" fill="#dbeafe" stroke="#93c5fd" strokeWidth="1.5" />
        <text x="655" y="88" textAnchor="middle" fontSize={11} fontWeight="700" fill="#1e40af">Denise Baseline</text>
        <text x="655" y="103" textAnchor="middle" fontSize={10} fill="#1e40af">trailing avg compare</text>

        {/* arrows down to step 1 */}
        <line x1="115" y1="114" x2="115" y2="146" stroke="#64748b" strokeWidth="1.5" markerEnd="url(#pd-arr)" />
        <line x1="295" y1="114" x2="295" y2="146" stroke="#64748b" strokeWidth="1.5" markerEnd="url(#pd-arr)" />
        <line x1="475" y1="114" x2="475" y2="146" stroke="#64748b" strokeWidth="1.5" markerEnd="url(#pd-arr)" />
        <line x1="655" y1="114" x2="655" y2="146" stroke="#64748b" strokeWidth="1.5" markerEnd="url(#pd-arr)" />

        {/* ── STEP 1: CALIBRATION ── */}
        <text x="12" y="168" fontSize={10} fontWeight="700" fill="#64748b">① CALIBRATE</text>
        <rect x="40" y="150" width="760" height="74" rx="8" fill="#f0fdf4" stroke="#86efac" strokeWidth="1.5" />
        <text x="420" y="172" textAnchor="middle" fontSize={12} fontWeight="700" fill="#14532d">
          calibrate.ts — Discover monthly rate indices from invoice history
        </text>

        <rect x="58" y="180" width="210" height="32" rx="5" fill="#dcfce7" stroke="#86efac" />
        <text x="163" y="194" textAnchor="middle" fontSize={10} fontWeight="600" fill="#166534">Peak: mileage → implied $/mi</text>
        <text x="163" y="207" textAnchor="middle" fontSize={9} fill="#166534">infer miles from invoice baseCharge</text>

        <rect x="295" y="180" width="210" height="32" rx="5" fill="#dcfce7" stroke="#86efac" />
        <text x="400" y="194" textAnchor="middle" fontSize={10} fontWeight="600" fill="#166534">Heartland: zone rate × QTD tier</text>
        <text x="400" y="207" textAnchor="middle" fontSize={9} fill="#166534">solve for zone rate per (zone, month)</text>

        <rect x="532" y="180" width="210" height="32" rx="5" fill="#dcfce7" stroke="#86efac" />
        <text x="637" y="194" textAnchor="middle" fontSize={10} fontWeight="600" fill="#166534">Coastal: effective $/lb per region</text>
        <text x="637" y="207" textAnchor="middle" fontSize={9} fill="#166534">(baseCharge − fuel) ÷ weightLbs</text>

        <text x="420" y="242" textAnchor="middle" fontSize={10} fill="#166534">
          → peakIndex, heartlandIndex, coastalIndex (3-month rolling avg of printed-card multipliers)
        </text>

        <line x1="420" y1="248" x2="420" y2="270" stroke="#64748b" strokeWidth="1.5" markerEnd="url(#pd-arr)" />

        {/* ── STEP 2: ACCRUAL ── */}
        <text x="12" y="292" fontSize={10} fontWeight="700" fill="#64748b">② ACCRUE</text>
        <rect x="40" y="275" width="760" height="200" rx="8" fill="#faf5ff" stroke="#c4b5fd" strokeWidth="1.5" />
        <text x="420" y="296" textAnchor="middle" fontSize={12} fontWeight="700" fill="#581c87">
          accrue.ts — Price every shipment, raise per-shipment exceptions
        </text>

        {/* Peak carrier box */}
        <rect x="58" y="305" width="218" height="155" rx="6" fill="#ede9fe" stroke="#c4b5fd" />
        <text x="167" y="323" textAnchor="middle" fontSize={11} fontWeight="700" fill="#4c1d95">Peak Logistics</text>
        <text x="167" y="338" textAnchor="middle" fontSize={9} fill="#5b21b6">price/peak.ts</text>
        <line x1="78" y1="344" x2="258" y2="344" stroke="#c4b5fd" strokeWidth="1" />
        <text x="78" y="357" fontSize={9} fill="#4c1d95">1. Mileage lookup (ZIP → miles)</text>
        <text x="78" y="370" fontSize={9} fill="#4c1d95">2. Weight tier ($/mi bracket)</text>
        <text x="78" y="383" fontSize={9} fill="#4c1d95">3. Base = miles × tier rate</text>
        <text x="78" y="396" fontSize={9} fill="#4c1d95">4. min($185) floor applied</text>
        <text x="78" y="409" fontSize={9} fill="#4c1d95">5. × peakIndex</text>
        <text x="78" y="422" fontSize={9} fill="#4c1d95">6. + fuel (14% of base)</text>
        <text x="78" y="435" fontSize={9} fill="#4c1d95">7. + accessorials (face value)</text>
        <rect x="78" y="440" width="170" height="14" rx="3" fill="#fef2f2" />
        <text x="83" y="450" fontSize={8.5} fill="#b91c1c">⚠ MILEAGE_FALLBACK_PRINTED/GEO</text>
        <text x="78" y="463" fontSize={8.5} fill="#b91c1c">⚠ OUT_OF_TERRITORY, ORIGIN_ASSUMPTION</text>

        {/* Heartland carrier box */}
        <rect x="301" y="305" width="218" height="155" rx="6" fill="#ede9fe" stroke="#c4b5fd" />
        <text x="410" y="323" textAnchor="middle" fontSize={11} fontWeight="700" fill="#4c1d95">Heartland Freight</text>
        <text x="410" y="338" textAnchor="middle" fontSize={9} fill="#5b21b6">price/heartland.ts</text>
        <line x1="321" y1="344" x2="501" y2="344" stroke="#c4b5fd" strokeWidth="1" />
        <text x="321" y="357" fontSize={9} fill="#4c1d95">1. ZIP prefix → zone (Z1–Z4)</text>
        <text x="321" y="370" fontSize={9} fill="#4c1d95">2. Printed zone rate (Z1=$320…)</text>
        <text x="321" y="383" fontSize={9} fill="#4c1d95">3. QTD cumulative → discount tier</text>
        <text x="321" y="396" fontSize={9} fill="#4c1d95">   (0/5/10/15% at 50/120/200)</text>
        <text x="321" y="409" fontSize={9} fill="#4c1d95">4. Base = rate × heartlandIndex</text>
        <text x="321" y="422" fontSize={9} fill="#4c1d95">       × (1 − discount)</text>
        <text x="321" y="435" fontSize={9} fill="#4c1d95">5. + accessorials (no fuel line)</text>
        <rect x="321" y="440" width="170" height="14" rx="3" fill="#fef2f2" />
        <text x="326" y="450" fontSize={8.5} fill="#b91c1c">⚠ UNMAPPED_ZONE, QTD_CARRYOVER</text>
        <text x="321" y="463" fontSize={8.5} fill="#b91c1c">⚠ MISSING_WEIGHT (info — no impact)</text>

        {/* Coastal carrier box */}
        <rect x="544" y="305" width="218" height="155" rx="6" fill="#ede9fe" stroke="#c4b5fd" />
        <text x="653" y="323" textAnchor="middle" fontSize={11} fontWeight="700" fill="#4c1d95">Coastal Express</text>
        <text x="653" y="338" textAnchor="middle" fontSize={9} fill="#5b21b6">price/coastal.ts</text>
        <line x1="564" y1="344" x2="744" y2="344" stroke="#c4b5fd" strokeWidth="1" />
        <text x="564" y="357" fontSize={9} fill="#4c1d95">1. ZIP range → region</text>
        <text x="564" y="370" fontSize={9} fill="#4c1d95">   SoCal / NorCal / PNW</text>
        <text x="564" y="383" fontSize={9} fill="#4c1d95">2. Base = lbs × region $/lb</text>
        <text x="564" y="396" fontSize={9} fill="#4c1d95">3. min($28) floor applied</text>
        <text x="564" y="409" fontSize={9} fill="#4c1d95">4. × coastalIndex</text>
        <text x="564" y="422" fontSize={9} fill="#4c1d95">5. + fuel (9.5% of base)</text>
        <text x="564" y="435" fontSize={9} fill="#4c1d95">6. + residential (by weight tier)</text>
        <rect x="564" y="440" width="170" height="14" rx="3" fill="#fef2f2" />
        <text x="569" y="450" fontSize={8.5} fill="#b91c1c">⚠ OUT_OF_TERRITORY, IMPUTED_WEIGHT</text>
        <text x="564" y="463" fontSize={8.5} fill="#b91c1c">⚠ RESIDENTIAL_NO_FEE</text>

        <line x1="420" y1="479" x2="420" y2="500" stroke="#64748b" strokeWidth="1.5" markerEnd="url(#pd-arr)" />

        {/* ── STEP 3: BACK-TEST ── */}
        <text x="12" y="522" fontSize={10} fontWeight="700" fill="#64748b">③ BACK-TEST</text>
        <rect x="40" y="505" width="760" height="50" rx="8" fill="#fff7ed" stroke="#fed7aa" strokeWidth="1.5" />
        <text x="420" y="524" textAnchor="middle" fontSize={12} fontWeight="700" fill="#7c2d12">
          backtest.ts — Re-price Oct–Mar; compute MAPE &amp; bias vs actual invoices
        </text>
        <text x="420" y="541" textAnchor="middle" fontSize={10} fill="#7c2d12">
          ⚠ BACKTEST_MAPE_HIGH if carrier MAPE &gt; 5% · Reconstruction error must be &lt; $2.00
        </text>

        <line x1="420" y1="558" x2="420" y2="578" stroke="#64748b" strokeWidth="1.5" markerEnd="url(#pd-arr)" />

        {/* ── STEP 4: EXCEPTIONS ── */}
        <text x="12" y="600" fontSize={10} fontWeight="700" fill="#64748b">④ EXCEPTIONS</text>
        <rect x="40" y="582" width="760" height="100" rx="8" fill="#fff1f2" stroke="#fca5a5" strokeWidth="1.5" />
        <text x="420" y="601" textAnchor="middle" fontSize={12} fontWeight="700" fill="#7f1d1d">
          exceptions.ts — Consolidate, assign stable IDs (EXC-0001…)
        </text>

        <rect x="58" y="608" width="110" height="36" rx="4" fill="#fef2f2" stroke="#fca5a5" />
        <text x="113" y="622" textAnchor="middle" fontSize={9} fontWeight="600" fill="#991b1b">Per-shipment</text>
        <text x="113" y="634" textAnchor="middle" fontSize={9} fill="#991b1b">from pricers ↑</text>

        <rect x="180" y="608" width="110" height="36" rx="4" fill="#fef2f2" stroke="#fca5a5" />
        <text x="235" y="622" textAnchor="middle" fontSize={9} fontWeight="600" fill="#991b1b">Duplicates</text>
        <text x="235" y="634" textAnchor="middle" fontSize={9} fill="#991b1b">parse-time drop</text>

        <rect x="302" y="608" width="120" height="36" rx="4" fill="#fef2f2" stroke="#fca5a5" />
        <text x="362" y="622" textAnchor="middle" fontSize={9} fontWeight="600" fill="#991b1b">Rate divergence</text>
        <text x="362" y="634" textAnchor="middle" fontSize={9} fill="#991b1b">&gt;10% printed vs cal</text>

        <rect x="434" y="608" width="110" height="36" rx="4" fill="#fef2f2" stroke="#fca5a5" />
        <text x="489" y="622" textAnchor="middle" fontSize={9} fontWeight="600" fill="#991b1b">Cost outliers</text>
        <text x="489" y="634" textAnchor="middle" fontSize={9} fill="#991b1b">|z| &gt; 3σ per carrier</text>

        <rect x="556" y="608" width="110" height="36" rx="4" fill="#fef2f2" stroke="#fca5a5" />
        <text x="611" y="622" textAnchor="middle" fontSize={9} fontWeight="600" fill="#991b1b">MAPE alarm</text>
        <text x="611" y="634" textAnchor="middle" fontSize={9} fill="#991b1b">&gt;5% back-test err</text>

        <rect x="678" y="608" width="110" height="36" rx="4" fill="#fef2f2" stroke="#fca5a5" />
        <text x="733" y="622" textAnchor="middle" fontSize={9} fontWeight="600" fill="#991b1b">Credit reserve</text>
        <text x="733" y="634" textAnchor="middle" fontSize={9} fill="#991b1b">−0.3% adj note</text>

        <text x="58" y="658" fontSize={9} fill="#b91c1c">
          error: unmapped ZIP/carrier · warn: fallbacks, divergence · info: outliers, reserve, assumptions
        </text>

        <line x1="420" y1="684" x2="420" y2="704" stroke="#64748b" strokeWidth="1.5" markerEnd="url(#pd-arr)" />

        {/* ── STEP 5: TIE-OUTS ── */}
        <text x="12" y="726" fontSize={10} fontWeight="700" fill="#64748b">⑤ TIE-OUTS</text>
        <rect x="40" y="708" width="760" height="60" rx="8" fill="#f0f9ff" stroke="#7dd3fc" strokeWidth="1.5" />
        <text x="420" y="727" textAnchor="middle" fontSize={12} fontWeight="700" fill="#0c4a6e">
          close.ts — 6 hard assertions (build fails if any miss)
        </text>
        <text x="58" y="745" fontSize={9.5} fill="#0c4a6e">
          Σ shipments == carrier subtotal · Σ carriers == total subtotal · Σ carrier accruals == total accrual
        </text>
        <text x="58" y="760" fontSize={9.5} fill="#0c4a6e">
          JE debits == JE credits · JE total == total accrual · Back-test recon error &lt; $2.00
        </text>

        <line x1="420" y1="770" x2="420" y2="790" stroke="#64748b" strokeWidth="1.5" markerEnd="url(#pd-arr)" />

        {/* ── STEP 6: OUTPUT ── */}
        <text x="12" y="812" fontSize={10} fontWeight="700" fill="#64748b">⑥ OUTPUT</text>

        <rect x="40" y="794" width="370" height="70" rx="8" fill="#f0fdf4" stroke="#86efac" strokeWidth="1.5" />
        <text x="225" y="813" textAnchor="middle" fontSize={12} fontWeight="700" fill="#14532d">Journal Entry (accrued liability)</text>
        <text x="225" y="829" textAnchor="middle" fontSize={10} fill="#166534">Dr 6200 Freight &amp; Delivery Expense</text>
        <text x="225" y="843" textAnchor="middle" fontSize={10} fill="#166534">Cr 21500 Accrued Freight Liability</text>
        <text x="225" y="857" textAnchor="middle" fontSize={10} fill="#166534">April 2026 ≈ $93,530</text>

        <rect x="430" y="794" width="370" height="70" rx="8" fill="#faf5ff" stroke="#c4b5fd" strokeWidth="1.5" />
        <text x="615" y="813" textAnchor="middle" fontSize={12} fontWeight="700" fill="#581c87">Confidence Band</text>
        <text x="615" y="829" textAnchor="middle" fontSize={10} fill="#5b21b6">±1σ per carrier from rate-index</text>
        <text x="615" y="843" textAnchor="middle" fontSize={10} fill="#5b21b6">volatility across Oct–Mar</text>
        <text x="615" y="857" textAnchor="middle" fontSize={10} fill="#5b21b6">shown on /close dashboard</text>

        {/* ── THRESHOLDS LEGEND ── */}
        <rect x="40" y="878" width="760" height="88" rx="8" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5" />
        <text x="420" y="895" textAnchor="middle" fontSize={11} fontWeight="700" fill="#334155">
          Config Thresholds (config/engine.json) — all editable
        </text>

        <rect x="58" y="902" width="168" height="26" rx="4" fill="#fef2f2" stroke="#fca5a5" />
        <text x="142" y="913" textAnchor="middle" fontSize={9} fontWeight="600" fill="#991b1b">divergencePct = 10%</text>
        <text x="142" y="924" textAnchor="middle" fontSize={9} fill="#7f1d1d">printed vs calibrated → RATE_DIVERGENCE</text>

        <rect x="238" y="902" width="168" height="26" rx="4" fill="#fff7ed" stroke="#fed7aa" />
        <text x="322" y="913" textAnchor="middle" fontSize={9} fontWeight="600" fill="#7c2d12">backtestMapeAlarmPct = 5%</text>
        <text x="322" y="924" textAnchor="middle" fontSize={9} fill="#7c2d12">→ BACKTEST_MAPE_HIGH warn</text>

        <rect x="418" y="902" width="168" height="26" rx="4" fill="#f0f9ff" stroke="#7dd3fc" />
        <text x="502" y="913" textAnchor="middle" fontSize={9} fontWeight="600" fill="#0c4a6e">costOutlierZ = 3.0</text>
        <text x="502" y="924" textAnchor="middle" fontSize={9} fill="#0369a1">|z-score| &gt; 3σ → COST_OUTLIER info</text>

        <rect x="598" y="902" width="186" height="26" rx="4" fill="#f0fdf4" stroke="#86efac" />
        <text x="691" y="913" textAnchor="middle" fontSize={9} fontWeight="600" fill="#14532d">creditReserve ≈ −0.3%</text>
        <text x="691" y="924" textAnchor="middle" fontSize={9} fill="#166534">of subtotal → ADJUSTMENT_RESIDUAL info</text>

        <text x="58" y="948" fontSize={9.5} fill="#475569" fontWeight="600">Rate source per carrier:</text>
        <rect x="190" y="938" width="110" height="20" rx="3" fill="#dcfce7" stroke="#86efac" />
        <text x="245" y="951" textAnchor="middle" fontSize={9} fontWeight="600" fill="#166534">calibrated (default)</text>
        <text x="310" y="951" fontSize={9} fill="#64748b">uses 3-month rolling index · or</text>
        <rect x="470" y="938" width="120" height="20" rx="3" fill="#fef9c3" stroke="#fde047" />
        <text x="530" y="951" textAnchor="middle" fontSize={9} fontWeight="600" fill="#713f12">printed_override</text>
        <text x="600" y="951" fontSize={9} fill="#64748b">forces index=1.0, flags divergence</text>
      </svg>
    </div>
  );
}
