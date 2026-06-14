// build-portable.mjs — emit a single self-contained portable HTML dashboard.
// Reads the engine output (app/_generated/accrualRun.json) and inlines it +
// a vanilla-JS renderer + brand CSS into one file you can open by double-click.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const run = JSON.parse(readFileSync(join(root, 'app/_generated/accrualRun.json'), 'utf8'));

const RENDERER = String.raw`
const $ = (s, r = document) => r.querySelector(s);
const fmtUsd = (n, dp = 2) =>
  n == null ? '—' : (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
const fmtPct = (n, dp = 1) => (n == null ? '—' : (n * 100).toFixed(dp) + '%');
const fmtNum = (n, dp = 0) => (n == null ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp }));
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const CARRIER = { peak: 'Peak Logistics', heartland: 'Heartland Freight', coastal: 'Coastal Express' };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const R = window.RUN;

function tabHandler() {
  document.querySelectorAll('.tab').forEach(t =>
    t.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      $('#panel-' + t.dataset.tab).classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    })
  );
}

// ---- Overview (Denise-free — vs-Denise content is quarantined to its own tab) ----
function renderOverview() {
  const conf = R.confidence.total;
  const bt = R.backtest.overall;
  const stat = (label, value, sub) =>
    '<div class="stat"><div class="stat-label">' + label + '</div><div class="stat-value">' + value +
    '</div>' + (sub ? '<div class="stat-sub">' + sub + '</div>' : '') + '</div>';
  return (
    '<div class="hero">' +
      '<div class="hero-eyebrow">April 2026 freight accrual · accrued liability · calibrated estimate</div>' +
      '<div class="hero-figure">' + fmtUsd(R.totalAccrual) + '</div>' +
      '<div class="hero-band">Confidence band ' + fmtUsd(conf.low, 0) + ' – ' + fmtUsd(conf.high, 0) +
        ' &nbsp;·&nbsp; ' + R.inputs.uniqueShipments + ' shipments priced before a single carrier invoice arrived</div>' +
    '</div>' +
    '<div class="stat-grid">' +
      stat('Booked accrual', fmtUsd(R.totalAccrual), 'Dr 6200 / Cr 21500') +
      stat('Reconstruction error', '±' + fmtUsd(R.backtest.reconstruction.byCarrierMonthMaxErrorDollars), 'max per carrier-month, ' + R.inputs.invoiceLines + ' lines') +
      stat('Engine bias', fmtPct(bt.engineBias), 'near-unbiased — neither over- nor under-states the liability') +
      stat('Exceptions', String(R.exceptions.length), R.exceptionsBySeverity.error + ' error · ' + R.exceptionsBySeverity.warn + ' warn · ' + R.exceptionsBySeverity.info + ' info') +
      stat('Tie-outs', R.tieOuts.filter(t => t.passed).length + '/' + R.tieOuts.length + ' pass', R.allTieOutsPassed ? 'everything ties' : 'CHECK FAILURES') +
      stat('Inputs', R.inputs.uniqueShipments + ' shp', R.inputs.invoiceLines + ' invoice lines · through ' + R.inputs.invoicesThrough) +
    '</div>' +
    '<p class="note">Every figure here is read from the deterministic engine run — see <b>Method &amp; Tie-outs</b> for how it is built, and the <b>Denise Comparison</b> tab for the head-to-head against the prior manual estimate.</p>'
  );
}

// ---- Journal Entry ----
function renderJE() {
  const je = R.journalEntry;
  return (
    '<h3>Journal Entry — ' + je.period + ' · ' + je.framework + '</h3>' +
    '<div class="je-meta"><span>Date <b>' + je.date + '</b></span><span>Balanced <b class="' +
      (je.balanced ? 'ok' : 'bad') + '">' + (je.balanced ? 'yes' : 'NO') + '</b></span></div>' +
    '<p class="note">' + esc(je.description) + '</p>' +
    '<table><thead><tr><th>Account</th><th>Name</th><th>Dr/Cr</th><th class="r">Amount</th><th>Memo</th></tr></thead><tbody>' +
      je.lines.map(l =>
        '<tr><td class="mono">' + l.account + '</td><td>' + l.accountName + '</td><td>' +
        '<span class="pill ' + l.type + '">' + cap(l.type) + '</span></td><td class="r">' + fmtUsd(l.amount) +
        '</td><td class="memo">' + esc(l.memo) + '</td></tr>'
      ).join('') +
      '<tr class="total"><td colspan="3">Total debits</td><td class="r">' + fmtUsd(je.totalDebits) + '</td><td></td></tr>' +
      '<tr class="total"><td colspan="3">Total credits</td><td class="r">' + fmtUsd(je.totalCredits) + '</td><td></td></tr>' +
    '</tbody></table>'
  );
}

// ---- Carriers ----
function renderCarriers() {
  const rows = R.carrierSummaries.map(c =>
    '<tr><td>' + CARRIER[c.carrier] + '</td><td class="r">' + c.shipmentCount + '</td><td class="r">' + fmtUsd(c.base) +
    '</td><td class="r">' + fmtUsd(c.fuel) + '</td><td class="r">' + fmtUsd(c.accessorials + c.residential) +
    '</td><td class="r">' + fmtUsd(c.subtotal) + '</td><td class="r neg">' + fmtUsd(c.creditReserve) +
    '</td><td class="r"><b>' + fmtUsd(c.accrual) + '</b></td><td class="r">' + fmtPct(c.backtestMape) + '</td></tr>'
  ).join('');
  return (
    '<h3>Carrier summaries</h3>' +
    '<table><thead><tr><th>Carrier</th><th class="r">Shp</th><th class="r">Base</th><th class="r">Fuel</th>' +
    '<th class="r">Access.</th><th class="r">Subtotal</th><th class="r">Credit res.</th><th class="r">Accrual</th>' +
    '<th class="r">Back-test MAPE</th></tr></thead><tbody>' + rows +
    '<tr class="total"><td>Total</td><td class="r">' + R.carrierSummaries.reduce((a, c) => a + c.shipmentCount, 0) +
    '</td><td class="r">' + fmtUsd(R.carrierSummaries.reduce((a, c) => a + c.base, 0)) +
    '</td><td class="r">' + fmtUsd(R.carrierSummaries.reduce((a, c) => a + c.fuel, 0)) +
    '</td><td class="r">' + fmtUsd(R.carrierSummaries.reduce((a, c) => a + c.accessorials + c.residential, 0)) +
    '</td><td class="r">' + fmtUsd(R.totalSubtotal) + '</td><td class="r neg">' + fmtUsd(R.totalCreditReserve) +
    '</td><td class="r"><b>' + fmtUsd(R.totalAccrual) + '</b></td><td></td></tr>' +
    '</tbody></table>' +
    '<h3>Confidence band (±1σ of each carrier\'s monthly rate-index volatility)</h3>' +
    '<table><thead><tr><th>Carrier</th><th class="r">Accrual</th><th class="r">CV</th><th class="r">Low</th><th class="r">High</th></tr></thead><tbody>' +
      R.confidence.byCarrier.map(c =>
        '<tr><td>' + CARRIER[c.carrier] + '</td><td class="r">' + fmtUsd(c.accrual) + '</td><td class="r">' +
        c.cvPct.toFixed(1) + '%</td><td class="r">' + fmtUsd(c.low) + '</td><td class="r">' + fmtUsd(c.high) + '</td></tr>'
      ).join('') +
    '</tbody></table><p class="note">' + esc(R.confidence.note) + '</p>'
  );
}

// ---- Back-test (engine-only — Denise comparison lives on its own tab) ----
function renderBacktest() {
  const o = R.backtest.overall;
  const bc = R.backtest.byCarrier;
  const carrierRow = k =>
    '<tr><td>' + CARRIER[k] + '</td><td class="r">' + fmtPct(bc[k].engineMape) +
    '</td><td class="r ' + (bc[k].engineBias < 0 ? 'neg' : 'pos') + '">' + fmtPct(bc[k].engineBias) +
    '</td><td class="r">' + bc[k].months + '</td></tr>';
  const cells = R.backtest.cells.map(c =>
    '<tr><td>' + c.month + '</td><td>' + CARRIER[c.carrier] + '</td><td class="r">' + fmtUsd(c.actual, 0) +
    '</td><td class="r">' + fmtUsd(c.engineEstimate, 0) + '</td><td class="r ' + (c.engineErrorPct < 0 ? 'neg' : 'pos') + '">' +
    fmtPct(c.engineErrorPct) + '</td></tr>'
  ).join('');
  return (
    '<div class="callout"><b>The honest framing.</b> The monthly rate index is near-unpredictable noise (±30%) while monthly ' +
    'spend is stabilized, so per-month MAPE is inherently noisy and a trailing average is hard to beat — we don\'t claim a MAPE win. ' +
    'The wins that matter: reconstruction ties to ±' + fmtUsd(R.backtest.reconstruction.byCarrierMonthMaxErrorDollars) +
    '; the engine is near-unbiased (' + fmtPct(o.engineBias) + ') — bias is what misstates the P&L every period. ' +
    'The head-to-head against the prior manual estimate is on the <b>Denise Comparison</b> tab.</div>' +
    '<p class="note">' + esc(R.backtest.modeNote) + '</p>' +
    '<h3>By carrier (expanding-window forecast)</h3>' +
    '<table><thead><tr><th>Carrier</th><th class="r">Engine MAPE</th><th class="r">Engine bias</th><th class="r">Carrier-months</th></tr></thead><tbody>' +
      ['peak', 'heartland', 'coastal'].map(carrierRow).join('') +
      '<tr class="total"><td>Overall</td><td class="r">' + fmtPct(o.engineMape) + '</td><td class="r">' + fmtPct(o.engineBias) +
      '</td><td class="r">' + o.months + '</td></tr>' +
    '</tbody></table>' +
    '<h3>Month-by-month detail</h3>' +
    '<table><thead><tr><th>Month</th><th>Carrier</th><th class="r">Actual</th><th class="r">Engine</th><th class="r">Err</th></tr></thead><tbody>' +
    cells + '</tbody></table>'
  );
}

// ---- Denise Comparison (QUARANTINE: all vs-Denise content lives only here) ----
function renderDenise() {
  const denise = R.deniseApril;
  const o = R.backtest.overall;
  const bc = R.backtest.byCarrier;
  const carrierRow = k =>
    '<tr><td>' + CARRIER[k] + '</td><td class="r">' + fmtPct(bc[k].engineMape) + '</td><td class="r">' + fmtPct(bc[k].deniseMape) +
    '</td><td class="r ' + (bc[k].engineBias < 0 ? 'neg' : 'pos') + '">' + fmtPct(bc[k].engineBias) +
    '</td><td class="r ' + (bc[k].deniseBias < 0 ? 'neg' : 'pos') + '">' + fmtPct(bc[k].deniseBias) +
    '</td><td class="r">' + bc[k].engineWins + '/' + bc[k].months + '</td></tr>';
  const cells = R.backtest.cells.map(c =>
    '<tr><td>' + c.month + '</td><td>' + CARRIER[c.carrier] + '</td><td class="r">' + fmtUsd(c.actual, 0) +
    '</td><td class="r">' + fmtUsd(c.engineEstimate, 0) + '</td><td class="r ' + (c.engineErrorPct < 0 ? 'neg' : 'pos') + '">' +
    fmtPct(c.engineErrorPct) + '</td><td class="r">' + fmtUsd(c.deniseEstimate, 0) + '</td><td class="r ' +
    (c.deniseErrorPct < 0 ? 'neg' : 'pos') + '">' + fmtPct(c.deniseErrorPct) + '</td><td>' +
    '<span class="pill ' + (c.winner === 'engine' ? 'credit' : 'debit') + '">' + cap(c.winner) + '</span></td></tr>'
  ).join('');
  return (
    '<div class="callout"><b>Honest accuracy.</b> Out-of-sample, Denise\'s trailing-3-month average is hard to beat on per-month ' +
    'MAPE (engine ' + fmtPct(o.engineMape) + ' vs Denise ' + fmtPct(o.deniseMape) + ') — we do <b>not</b> claim a MAPE win. ' +
    'FreightClose wins where a black-box average can\'t: every dollar ties to a shipment, it adapts to rate changes, it carries ' +
    'controls, it\'s repeatable by anyone, and it is near-unbiased (' + fmtPct(o.engineBias) + ') vs Denise\'s chronic ' +
    fmtPct(o.deniseBias) + ' under-accrual — bias is what misstates the P&L every period.</div>' +
    '<h3>FreightClose vs Denise — April, by carrier</h3>' +
    '<table><thead><tr><th>Carrier</th><th class="r">FreightClose</th><th class="r">Denise (3-mo avg)</th><th class="r">Delta</th></tr></thead><tbody>' +
      denise.byCarrier.map(c =>
        '<tr><td>' + CARRIER[c.carrier] + '</td><td class="r">' + fmtUsd(c.freightClose) + '</td><td class="r">' +
        fmtUsd(c.denise) + '</td><td class="r ' + (c.delta < 0 ? 'neg' : 'pos') + '">' + fmtUsd(c.delta) + '</td></tr>'
      ).join('') +
      '<tr class="total"><td>Total</td><td class="r">' + fmtUsd(denise.totalFreightClose) + '</td><td class="r">' +
      fmtUsd(denise.totalDenise) + '</td><td class="r">' + fmtUsd(denise.totalFreightClose - denise.totalDenise) + '</td></tr>' +
    '</tbody></table>' +
    '<p class="note">' + esc(denise.note) + '</p>' +
    '<h3>Back-test — engine vs Denise (expanding-window forecast)</h3>' +
    '<table><thead><tr><th>Carrier</th><th class="r">Engine MAPE</th><th class="r">Denise MAPE</th>' +
    '<th class="r">Engine bias</th><th class="r">Denise bias</th><th class="r">Engine wins</th></tr></thead><tbody>' +
      ['peak', 'heartland', 'coastal'].map(carrierRow).join('') +
      '<tr class="total"><td>Overall</td><td class="r">' + fmtPct(o.engineMape) + '</td><td class="r">' + fmtPct(o.deniseMape) +
      '</td><td class="r">' + fmtPct(o.engineBias) + '</td><td class="r">' + fmtPct(o.deniseBias) + '</td><td class="r">' +
      o.engineWins + '/' + o.months + '</td></tr>' +
    '</tbody></table>' +
    '<h3>Month-by-month — engine vs Denise</h3>' +
    '<table><thead><tr><th>Month</th><th>Carrier</th><th class="r">Actual</th><th class="r">Engine</th><th class="r">Err</th>' +
    '<th class="r">Denise</th><th class="r">Err</th><th>Winner</th></tr></thead><tbody>' + cells + '</tbody></table>'
  );
}

// ---- Shipments ----
function renderShipments() {
  const body = R.shipmentEstimates.map((s, i) =>
    '<tr class="ship-row" data-i="' + i + '"><td class="mono">' + s.shipmentId + '</td><td>' + CARRIER[s.carrier] +
    '</td><td>' + s.date + '</td><td>' + esc(s.destination.city) + ', ' + s.destination.state + '</td><td class="r">' +
    fmtNum(s.weightLbs, 1) + '</td><td class="r">' + fmtUsd(s.baseCharge) + '</td><td class="r">' + fmtUsd(s.fuelSurcharge) +
    '</td><td class="r">' + fmtUsd(s.accessorialTotal + s.residentialSurcharge) + '</td><td class="r"><b>' + fmtUsd(s.total) +
    '</b></td></tr>' +
    '<tr class="trace" data-trace="' + i + '"><td colspan="9"><div class="trace-box">' +
      s.calcTrace.map(t => '<div class="trace-line"><span class="tl-label">' + esc(t.label) + '</span>' +
        '<span class="tl-formula">' + esc(t.formula) + '</span><span class="tl-value">' +
        (typeof t.value === 'number' ? fmtNum(t.value, 2) : esc(t.value)) + '</span></div>').join('') +
      (s.exceptionIds.length ? '<div class="trace-exc">⚑ ' + s.exceptionIds.join(', ') + '</div>' : '') +
    '</div></td></tr>'
  ).join('');
  return (
    '<h3>Shipment-level backup — ' + R.shipmentEstimates.length + ' priced shipments</h3>' +
    '<p class="note">Click any row to expand its calculation trace. Every total ties up to the carrier summary and the JE.</p>' +
    '<div class="ship-filter"><input id="shipFilter" placeholder="Filter by id, carrier, or city…"></div>' +
    '<table class="ship-table"><thead><tr><th>ID</th><th>Carrier</th><th>Date</th><th>Destination</th><th class="r">Wt (lb)</th>' +
    '<th class="r">Base</th><th class="r">Fuel</th><th class="r">Access.</th><th class="r">Total</th></tr></thead><tbody>' +
    body + '</tbody></table>'
  );
}

// ---- Exceptions ----
function renderExceptions() {
  const sev = { error: 'bad', warn: 'warn', info: 'info' };
  const rows = R.exceptions.map(e =>
    '<tr><td class="mono">' + e.id + '</td><td><span class="pill ' + sev[e.severity] + '">' + e.severity + '</span></td>' +
    '<td class="mono">' + e.code + '</td><td>' + (e.carrier ? CARRIER[e.carrier] : '—') + '</td><td class="mono">' +
    (e.shipmentId || '—') + '</td><td class="memo">' + esc(e.message) + '</td></tr>'
  ).join('');
  return (
    '<h3>Exceptions — ' + R.exceptions.length + ' flags (' + R.exceptionsBySeverity.error + ' error · ' +
    R.exceptionsBySeverity.warn + ' warn · ' + R.exceptionsBySeverity.info + ' info)</h3>' +
    '<p class="note">Every fallback and assumption raises a flag — no silent defaults.</p>' +
    '<table><thead><tr><th>ID</th><th>Sev</th><th>Code</th><th>Carrier</th><th>Shipment</th><th>Message</th></tr></thead><tbody>' +
    rows + '</tbody></table>'
  );
}

// ---- Method / tie-outs ----
function renderMethod() {
  const tie = R.tieOuts.map(t =>
    '<tr><td>' + esc(t.name) + '</td><td class="r">' + fmtUsd(t.expected) + '</td><td class="r">' + fmtUsd(t.actual) +
    '</td><td><span class="pill ' + (t.passed ? 'credit' : 'debit') + '">' + (t.passed ? 'pass' : 'FAIL') + '</span></td></tr>'
  ).join('');
  const idx = R.calibration.rateIndex.byCarrierMonth;
  const months = [...new Set(idx.map(x => x.month))].sort();
  const carriers = ['peak', 'heartland', 'coastal'];
  const head = '<tr><th>Carrier</th>' + months.map(m => '<th class="r">' + m + '</th>').join('') + '</tr>';
  const grid = carriers.map(c =>
    '<tr><td>' + CARRIER[c] + '</td>' + months.map(m => {
      const cell = idx.find(x => x.carrier === c && x.month === m);
      return '<td class="r">' + (cell ? cell.index.toFixed(3) : '—') + '</td>';
    }).join('') + '</tr>'
  ).join('');
  return (
    '<div class="callout"><b>The mechanism.</b> Each carrier applies a global monthly rate index on top of its printed ' +
    '(structural) card — identical across that carrier\'s destinations within a month. The engine calibrates this index per ' +
    'month from invoice history, which is why reconstruction reproduces all ' + R.inputs.invoiceLines + ' lines to ±' +
    fmtUsd(R.backtest.reconstruction.byCarrierMonthMaxErrorDollars) + '. April prices on the recent-window average.</div>' +
    '<h3>Pipeline</h3>' +
    '<div class="pipe">' +
      ['Invoices → calibrate monthly rate index', 'Price April shipments on calibrated rates', 'Sum to carrier summaries',
       'Apply credit reserve', 'Assert tie-outs', 'Emit accrued-liability journal entry'].map((s, i) =>
        '<div class="pipe-step"><span class="pipe-n">' + (i + 1) + '</span>' + s + '</div>').join('<span class="pipe-arrow">→</span>') +
    '</div>' +
    '<h3>Calibrated monthly rate index</h3>' +
    '<div class="scroll"><table><thead>' + head + '</thead><tbody>' + grid + '</tbody></table></div>' +
    '<h3>Tie-outs — assertions in code</h3>' +
    '<table><thead><tr><th>Assertion</th><th class="r">Expected</th><th class="r">Actual</th><th>Result</th></tr></thead><tbody>' +
    tie + '</tbody></table>'
  );
}

function boot() {
  $('#panel-overview').innerHTML = renderOverview();
  $('#panel-je').innerHTML = renderJE();
  $('#panel-carriers').innerHTML = renderCarriers();
  $('#panel-backtest').innerHTML = renderBacktest();
  $('#panel-denise').innerHTML = renderDenise();
  $('#panel-shipments').innerHTML = renderShipments();
  $('#panel-exceptions').innerHTML = renderExceptions();
  $('#panel-method').innerHTML = renderMethod();
  tabHandler();
  // shipment row expand + filter
  document.querySelectorAll('.ship-row').forEach(r =>
    r.addEventListener('click', () => {
      const t = document.querySelector('.trace[data-trace="' + r.dataset.i + '"]');
      t.classList.toggle('open');
      r.classList.toggle('expanded');
    })
  );
  const filter = $('#shipFilter');
  if (filter) filter.addEventListener('input', () => {
    const q = filter.value.toLowerCase();
    document.querySelectorAll('.ship-row').forEach(r => {
      const show = r.textContent.toLowerCase().includes(q);
      r.style.display = show ? '' : 'none';
      const t = document.querySelector('.trace[data-trace="' + r.dataset.i + '"]');
      if (!show) { t.classList.remove('open'); r.classList.remove('expanded'); }
    });
  });
}
boot();
`;

const CSS = String.raw`
  :root{
    --ink:#0e1116; --ink2:#171c24; --ink3:#222a35; --line:#2c3543;
    --parch:#f4eddb; --parch-dim:#cfc8b6; --mut:#9aa6b4;
    --orange:#e66a3c; --sky:#8fb8d6; --pine:#6fe0b4; --pine2:#2a8e6d; --red:#e05a4f; --amber:#e0a13c;
  }
  *{box-sizing:border-box}
  html,body{margin:0;padding:0}
  body{background:var(--ink);color:var(--parch);font-family:'Geist',ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;line-height:1.5;-webkit-font-smoothing:antialiased}
  .mono{font-family:'Geist Mono',ui-monospace,'SF Mono',Menlo,Consolas,monospace}
  header{border-bottom:1px solid var(--line);background:linear-gradient(180deg,#0e1116,#11151c);padding:22px clamp(16px,4vw,48px)}
  .brand{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap}
  .brand h1{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:clamp(26px,4vw,38px);margin:0;letter-spacing:-.5px}
  .brand .tag{color:var(--mut);font-size:13px}
  .brand .dot{width:9px;height:9px;border-radius:50%;background:var(--orange);display:inline-block;margin-right:2px}
  .sub{color:var(--parch-dim);font-size:14px;margin-top:6px}
  nav{position:sticky;top:0;z-index:10;background:rgba(14,17,22,.92);backdrop-filter:blur(8px);border-bottom:1px solid var(--line);display:flex;gap:2px;overflow-x:auto;padding:0 clamp(8px,2vw,24px)}
  .tab{appearance:none;background:none;border:none;color:var(--mut);font:inherit;font-size:14px;padding:14px 16px;cursor:pointer;border-bottom:2px solid transparent;white-space:nowrap}
  .tab:hover{color:var(--parch)}
  .tab.active{color:var(--orange);border-bottom-color:var(--orange)}
  main{padding:clamp(20px,4vw,40px) clamp(16px,4vw,48px);max-width:1180px;margin:0 auto}
  .panel{display:none;animation:fade .25s ease}
  .panel.active{display:block}
  @keyframes fade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
  h3{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:20px;margin:34px 0 12px;color:var(--parch)}
  .panel>h3:first-child{margin-top:0}
  .hero{border:1px solid var(--line);border-radius:14px;background:linear-gradient(135deg,#141a22,#11161d);padding:28px 30px;margin-bottom:22px}
  .hero-eyebrow{color:var(--sky);font-size:13px;letter-spacing:.4px;text-transform:uppercase}
  .hero-figure{font-family:'Fraunces',Georgia,serif;font-size:clamp(42px,8vw,68px);font-weight:600;line-height:1;margin:8px 0;color:var(--parch)}
  .hero-band{color:var(--parch-dim);font-size:14px}
  .stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:8px}
  .stat{border:1px solid var(--line);border-radius:11px;background:var(--ink2);padding:15px 16px}
  .stat-label{color:var(--mut);font-size:12px;text-transform:uppercase;letter-spacing:.4px}
  .stat-value{font-family:'Fraunces',Georgia,serif;font-size:24px;font-weight:600;margin:4px 0 2px}
  .stat-sub{color:var(--parch-dim);font-size:12px}
  table{width:100%;border-collapse:collapse;font-size:13.5px;margin:6px 0 4px}
  th,td{text-align:left;padding:9px 12px;border-bottom:1px solid var(--ink3)}
  th{color:var(--mut);font-weight:500;font-size:12px;text-transform:uppercase;letter-spacing:.3px;border-bottom:1px solid var(--line)}
  td.r,th.r{text-align:right;font-variant-numeric:tabular-nums}
  tr.total td{border-top:1px solid var(--line);border-bottom:none;font-weight:600;color:var(--parch)}
  td.neg{color:var(--red)} td.pos{color:var(--pine)}
  .memo{color:var(--parch-dim);font-size:12.5px;max-width:380px}
  .note{color:var(--mut);font-size:13px;margin:8px 0 0;max-width:760px}
  .pill{display:inline-block;font-size:11px;font-weight:600;padding:2px 9px;border-radius:20px;text-transform:uppercase;letter-spacing:.3px}
  .pill.debit,.pill.bad{background:rgba(224,90,79,.16);color:#f0938b}
  .pill.credit,.pill.ok{background:rgba(111,224,180,.15);color:var(--pine)}
  .pill.warn{background:rgba(224,161,60,.16);color:var(--amber)}
  .pill.info{background:rgba(143,184,214,.16);color:var(--sky)}
  b.ok{color:var(--pine)} b.bad{color:var(--red)}
  .je-meta{display:flex;gap:24px;color:var(--mut);font-size:13px;margin:4px 0 10px}
  .je-meta b{color:var(--parch)}
  .callout{border-left:3px solid var(--orange);background:var(--ink2);border-radius:0 10px 10px 0;padding:14px 18px;font-size:14px;color:var(--parch-dim);margin-bottom:14px}
  .callout b{color:var(--parch)}
  .ship-filter{margin:10px 0}
  .ship-filter input{width:100%;max-width:360px;background:var(--ink2);border:1px solid var(--line);border-radius:8px;color:var(--parch);padding:9px 12px;font:inherit;font-size:14px}
  .ship-filter input:focus{outline:none;border-color:var(--orange)}
  .ship-row{cursor:pointer}
  .ship-row:hover td{background:var(--ink2)}
  .ship-row.expanded td{background:var(--ink3)}
  .ship-row td:first-child::before{content:'▸';color:var(--mut);margin-right:7px;font-size:11px;display:inline-block;transition:transform .15s}
  .ship-row.expanded td:first-child::before{transform:rotate(90deg);color:var(--orange)}
  .trace{display:none} .trace.open{display:table-row}
  .trace-box{background:var(--ink);border:1px solid var(--line);border-radius:9px;padding:10px 14px;margin:2px 0 8px}
  .trace-line{display:grid;grid-template-columns:1.4fr 1.6fr auto;gap:14px;padding:5px 0;border-bottom:1px dashed var(--ink3);font-size:13px}
  .trace-line:last-child{border-bottom:none}
  .tl-label{color:var(--parch)} .tl-formula{color:var(--mut);font-family:'Geist Mono',monospace;font-size:12px}
  .tl-value{text-align:right;font-variant-numeric:tabular-nums;color:var(--sky)}
  .trace-exc{color:var(--amber);font-size:12.5px;margin-top:6px}
  .pipe{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:10px 0}
  .pipe-step{display:flex;align-items:center;gap:9px;background:var(--ink2);border:1px solid var(--line);border-radius:9px;padding:9px 13px;font-size:13px}
  .pipe-n{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:var(--orange);color:var(--ink);font-weight:700;font-size:12px}
  .pipe-arrow{color:var(--mut)}
  .scroll{overflow-x:auto}
  footer{border-top:1px solid var(--line);color:var(--mut);font-size:12.5px;padding:22px clamp(16px,4vw,48px);text-align:center}
  footer a{color:var(--sky);text-decoration:none}
`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>FreightClose — April 2026 Accrual (portable)</title>
<style>${CSS}</style>
</head>
<body>
<header>
  <div class="brand">
    <h1><span class="dot"></span>FreightClose</h1>
    <span class="tag">Ridgeline Foods · Finance Engineer Cup R1</span>
  </div>
  <div class="sub">April 2026 outbound-freight accrual estimated from current-month shipment activity, calibrated against six months of invoices, before carrier bills arrive. Portable build — open offline, no server. Generated ${run.generatedAtNote || ''}.</div>
</header>
<nav>
  <button class="tab active" data-tab="overview">Overview</button>
  <button class="tab" data-tab="je">Journal Entry</button>
  <button class="tab" data-tab="carriers">Carriers</button>
  <button class="tab" data-tab="backtest">Accuracy / Back-test</button>
  <button class="tab" data-tab="denise">Denise Comparison</button>
  <button class="tab" data-tab="shipments">Shipment Backup</button>
  <button class="tab" data-tab="exceptions">Exceptions</button>
  <button class="tab" data-tab="method">Method &amp; Tie-outs</button>
</nav>
<main>
  <section id="panel-overview" class="panel active"></section>
  <section id="panel-je" class="panel"></section>
  <section id="panel-carriers" class="panel"></section>
  <section id="panel-backtest" class="panel"></section>
  <section id="panel-denise" class="panel"></section>
  <section id="panel-shipments" class="panel"></section>
  <section id="panel-exceptions" class="panel"></section>
  <section id="panel-method" class="panel"></section>
</main>
<footer>
  Engine v${run.provenance.engineVersion} · config ${run.provenance.configVersionId} · ${run.framework} · rate source: calibrated.
  Everything ties — JE total = Σ shipment estimates = ${'$' + run.totalAccrual.toLocaleString('en-US',{minimumFractionDigits:2})}.
  Live app: <a href="https://freightclose.dogsled.dev">freightclose.dogsled.dev</a> · <i>Aim high. Pull hard. Leave tracks.</i>
</footer>
<script>window.RUN=${JSON.stringify(run)};</script>
<script>${RENDERER}</script>
</body>
</html>`;

// Emit into public/ as the period's portable archive (served by the deployed
// app + offered as the "portable HTML archive" download on approval).
const slug = String(run.period).toLowerCase().replace(/\s+/g, '-'); // "april-2026"
const out = join(root, 'public', `freightclose-archive-${slug}.html`);
writeFileSync(out, html, 'utf8');
console.log('[portable] Wrote ' + out + ' (' + (html.length / 1024).toFixed(0) + ' KB)');
