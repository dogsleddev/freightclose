// Workflow diagrams — two bespoke SVGs in the style of the Manus 2 reference: a
// branching calculation data-flow (driven by the real engine run) shown on
// Method & sensitivity, and a reconciliation decision-tree with materiality
// traffic-lights shown on Closed periods. Each renders on a light inset panel so
// the literal colors read in both light and dark themes (matching the map/flow
// diagrams).

import { accrualRun } from "@/app/lib/accrual";
import { fmtUsd, carrierName } from "@/app/lib/format";

// palette (literal — light inset panel)
const NAVY = "#21436b";
const GREEN = "#15803d";
const CREAM = "#efe7d6";
const RED = "#b91c1c";
const AMBER = "#b45309";
const SKY = "#2f6fb0";
const PANEL = "#fbfaf6";
const ARROW = "#9a968b";
const INKT = "#33332f";
const MUTE = "#6b6a64";

type Line = { t: string; size?: number; bold?: boolean; color?: string };

function Box({
  x, y, w, h, fill, color = "#ffffff", border, lines, rx = 6,
}: { x: number; y: number; w: number; h: number; fill: string; color?: string; border?: string; lines: Line[]; rx?: number }) {
  const cx = x + w / 2;
  const lineH = 14;
  const start = y + h / 2 - ((lines.length - 1) * lineH) / 2 + 4;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={rx} fill={fill} stroke={border ?? "none"} strokeWidth={border ? 1.25 : 0} />
      {lines.map((ln, i) => (
        <text key={i} x={cx} y={start + i * lineH} textAnchor="middle" fontSize={ln.size ?? 12} fontWeight={ln.bold ? 700 : 400} fill={ln.color ?? color}>
          {ln.t}
        </text>
      ))}
    </g>
  );
}

function Diamond({ cx, cy, hw, hh, lines }: { cx: number; cy: number; hw: number; hh: number; lines: Line[] }) {
  const lineH = 13;
  const start = cy - ((lines.length - 1) * lineH) / 2 + 3;
  return (
    <g>
      <polygon points={`${cx},${cy - hh} ${cx + hw},${cy} ${cx},${cy + hh} ${cx - hw},${cy}`} fill={CREAM} stroke="#cdbfa0" strokeWidth={1.25} />
      {lines.map((ln, i) => (
        <text key={i} x={cx} y={start + i * lineH} textAnchor="middle" fontSize={ln.size ?? 11} fontWeight={ln.bold ? 700 : 400} fill={ln.color ?? INKT}>
          {ln.t}
        </text>
      ))}
    </g>
  );
}

// connector path ending in a downward arrowhead at (ex,ey); d should stop ~6px above
function Conn({ d, ex, ey, color = ARROW }: { d: string; ex: number; ey: number; color?: string }) {
  return (
    <g stroke={color} strokeWidth={1.5} fill="none">
      <path d={d} />
      <path d={`M${ex - 4},${ey - 6} L${ex + 4},${ey - 6} L${ex},${ey} z`} fill={color} stroke="none" />
    </g>
  );
}
function Down({ x, y1, y2, color = ARROW }: { x: number; y1: number; y2: number; color?: string }) {
  return <Conn d={`M${x},${y1} V${y2 - 6}`} ex={x} ey={y2} color={color} />;
}

function Panel({ vb, children, label }: { vb: string; children: React.ReactNode; label: string }) {
  return (
    <div className="overflow-x-auto">
      <svg viewBox={vb} role="img" aria-label={label} className="w-full min-w-[620px]">
        <rect x="0" y="0" width="100%" height="100%" rx="10" fill={PANEL} />
        {children}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1) Calculation data-flow — manifest → group → per-carrier pricing → total
// ---------------------------------------------------------------------------
const sum = (c: "peak" | "heartland" | "coastal") => accrualRun.carrierSummaries.find((s) => s.carrier === c)!;
const access = (s: ReturnType<typeof sum>) => s.accessorials + s.residential;

export function CalcFlowDiagram() {
  const r = accrualRun;
  const lanes = [
    { c: "peak" as const, x: 130, head: AMBER, tint: "#faeeda", bd: "#e3b15f", method: "Per-mile × weight tier × index + fuel" },
    { c: "heartland" as const, x: 360, head: GREEN, tint: "#e1f5ee", bd: "#7fcbb0", method: "Flat zone × index × QTD discount" },
    { c: "coastal" as const, x: 580, head: SKY, tint: "#e6f1fb", bd: "#8ebbe6", method: "Per-lb × region × index + min + resid." },
  ];
  const headY = 188, headH = 46, priceY = 262, priceH = 70, accY = 360, accH = 40, busY = 426;
  const sumY = 450, sumH = 40, totY = 524, totH = 54, cx = 360;

  return (
    <Panel vb="0 0 720 600" label="How the April accrual is calculated — branching data-flow by carrier">
      {/* manifest */}
      <Box x={cx - 130} y={14} w={260} h={46} fill="#eceadf" color={INKT} border="#d3cdb9"
        lines={[{ t: "April shipment manifest", bold: true, size: 12.5 }, { t: `${r.inputs.shipmentRows} rows → ${r.inputs.uniqueShipments} unique (1 duplicate flagged)`, size: 10.5, color: MUTE }]} />
      <Down x={cx} y1={60} y2={84} />
      {/* group-by-carrier diamond */}
      <Diamond cx={cx} cy={118} hw={70} hh={34} lines={[{ t: "Group by carrier", bold: true, size: 11.5 }]} />
      {/* diamond -> lanes */}
      {lanes.map((l) => (
        <Conn key={`c-${l.c}`} d={`M${cx},${152} V168 H${l.x} V${headY - 6}`} ex={l.x} ey={headY} />
      ))}
      {lanes.map((l) => {
        const s = sum(l.c);
        return (
          <g key={l.c}>
            {/* header */}
            <Box x={l.x - 88} y={headY} w={176} h={headH} fill={l.head} color="#fff"
              lines={[{ t: carrierName[l.c], bold: true, size: 12 }, { t: `${s.shipmentCount} shipments`, size: 10.5, color: "#ffffff" }]} />
            <Down x={l.x} y1={headY + headH} y2={priceY} />
            {/* pricing */}
            <Box x={l.x - 95} y={priceY} w={190} h={priceH} fill={l.tint} color={INKT} border={l.bd}
              lines={[
                { t: l.method, size: 9.5, color: MUTE },
                { t: `Base ${fmtUsd(s.base)}`, size: 10.5, bold: true },
                { t: `Fuel ${fmtUsd(s.fuel)} · Acc ${fmtUsd(access(s))}`, size: 10 },
              ]} />
            <Down x={l.x} y1={priceY + priceH} y2={accY} />
            {/* accrual */}
            <Box x={l.x - 70} y={accY} w={140} h={accH} fill={l.head} color="#fff"
              lines={[{ t: `Accrual ${fmtUsd(s.accrual)}`, bold: true, size: 12 }]} />
            {/* down to bus */}
            <line x1={l.x} y1={accY + accH} x2={l.x} y2={busY} stroke={ARROW} strokeWidth={1.5} />
          </g>
        );
      })}
      {/* bus + merge to sum */}
      <line x1={lanes[0].x} y1={busY} x2={lanes[2].x} y2={busY} stroke={ARROW} strokeWidth={1.5} />
      <Down x={cx} y1={busY} y2={sumY} />
      <Box x={cx - 150} y={sumY} w={300} h={sumH} fill={NAVY} color="#fff"
        lines={[{ t: `Σ carriers ${fmtUsd(r.totalSubtotal)}  −  credit reserve ${fmtUsd(Math.abs(r.totalCreditReserve))}`, bold: true, size: 11.5 }]} />
      <Down x={cx} y1={sumY + sumH} y2={totY} />
      {/* total */}
      <Box x={cx - 160} y={totY} w={320} h={totH} fill={GREEN} color="#fff"
        lines={[
          { t: `Total accrual ${fmtUsd(r.totalAccrual)}`, bold: true, size: 15 },
          { t: `Confidence (±1σ) ${fmtUsd(r.confidence.total.low)} – ${fmtUsd(r.confidence.total.high)}`, size: 10.5, color: "#ffffff" },
        ]} />
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// 2) Reconciliation decision-tree — materiality traffic-lights
// ---------------------------------------------------------------------------
export function ReconDiagram() {
  const cx = 360;
  const branches = [
    { x: 140, fill: GREEN, band: "within ±5%", lines: [{ t: "Green — no action", bold: true, size: 11, color: "#fff" }, { t: "accrual was accurate", size: 9.5, color: "#fff" }] },
    { x: 360, fill: AMBER, band: "±5–10%", lines: [{ t: "Amber — document", bold: true, size: 11, color: "#fff" }, { t: "root-cause analysis", size: 9.5, color: "#fff" }] },
    { x: 580, fill: RED, band: ">10%", lines: [{ t: "Red — investigate", bold: true, size: 11, color: "#fff" }, { t: "adjust & recalibrate", size: 9.5, color: "#fff" }] },
  ];
  const brY = 348, brH = 44, mergeY = 432, tuY = 446, tuH = 40, feedY = 520, feedH = 40;
  return (
    <Panel vb="0 0 720 590" label="Reconciliation process when invoices arrive — materiality traffic-lights">
      <Box x={cx - 150} y={14} w={300} h={44} fill={NAVY} color="#fff"
        lines={[{ t: "Month-end — book accrual", bold: true, size: 12 }, { t: "DR 6200 Freight expense · CR 21500 accrued liability", size: 9.5, color: "#fff" }]} />
      <Down x={cx} y1={58} y2={78} />
      <Box x={cx - 150} y={78} w={300} h={40} fill={GREEN} color="#fff" lines={[{ t: "Approve & lock the period", bold: true, size: 12 }]} />
      <Down x={cx} y1={118} y2={138} />
      <Box x={cx - 150} y={138} w={300} h={40} fill="#dcd8cc" color={INKT} lines={[{ t: "Invoices arrive — 15–30 days later", bold: true, size: 11.5 }]} />
      <Down x={cx} y1={178} y2={206} />
      <Diamond cx={cx} cy={250} hw={92} hh={42} lines={[{ t: "Compare actual", bold: true, size: 11.5 }, { t: "vs estimate", size: 11 }, { t: "(vs materiality band)", size: 9.5, color: MUTE }]} />
      {/* diamond -> 3 branches with band labels */}
      {branches.map((b) => (
        <g key={b.x}>
          <Conn d={`M${cx},${292} V318 H${b.x} V${brY - 6}`} ex={b.x} ey={brY} />
          <text x={b.x === cx ? cx + 44 : b.x} y={332} textAnchor="middle" fontSize={9.5} fontWeight={700} fill={MUTE}>{b.band}</text>
          <Box x={b.x - 80} y={brY} w={160} h={brH} fill={b.fill} lines={b.lines} />
          <line x1={b.x} y1={brY + brH} x2={b.x} y2={mergeY} stroke={ARROW} strokeWidth={1.5} />
        </g>
      ))}
      <line x1={branches[0].x} y1={mergeY} x2={branches[2].x} y2={mergeY} stroke={ARROW} strokeWidth={1.5} />
      <Down x={cx} y1={mergeY} y2={tuY} />
      <Box x={cx - 150} y={tuY} w={300} h={tuH} fill={NAVY} color="#fff" lines={[{ t: "Book true-up JE (estimate → actual)", bold: true, size: 11.5 }]} />
      <Down x={cx} y1={tuY + tuH} y2={feedY} />
      <Box x={cx - 160} y={feedY} w={320} h={feedH} fill={NAVY} color="#fff" lines={[{ t: "Feed variance into next month's calibration", bold: true, size: 11.5 }]} />
    </Panel>
  );
}
