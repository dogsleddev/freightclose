// Data-source connections — how data reaches the engine TODAY (CSV upload /
// Load Sample) vs the ROADMAP (direct Ramp / Stripe / 3PL / NetSuite connectors
// via API or MCP). Pure presentational SVG on a light inset panel, so the
// literal brand colors read in both light and dark themes (matches the guide
// diagrams). No data dependency.

const NAVY = "#21436b";
const AMBER = "#b45309";
const GREEN = "#15803d";
const SKY = "#2f6fb0";
const PANEL = "#fbfaf6";
const INKT = "#33332f";
const MUTE = "#6b6a64";
const ARROW = "#9a968b";
const BORDER = "#cdbfa0";

const SOURCES = [
  { t: "3PL / TMS", s: "shipment activity", fill: NAVY },
  { t: "Carrier portals", s: "rate cards + invoices", fill: AMBER },
  { t: "Ramp", s: "freight spend", fill: GREEN },
  { t: "Stripe", s: "DTC order volume", fill: SKY },
];

export function ConnectionsDiagram() {
  const sx = 16, sw = 160, sh = 38, gap = 8;
  const syTop = 12;
  const smid = (i: number) => syTop + i * (sh + gap) + sh / 2;
  const busX = 190;
  const ex = 300, ew = 160, ey = 46, eh = 120, emidY = ey + eh / 2; // 106
  const nx = 556, nw = 160, ny = 66, nh = 80, nmidY = ny + nh / 2; // 106

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox="0 0 740 200"
        role="img"
        aria-label="Data-source connections: CSV and Load Sample today; direct Ramp, Stripe, 3PL and NetSuite connectors on the roadmap"
        className="w-full min-w-[680px]"
      >
        <rect x="0" y="0" width="100%" height="100%" rx="10" fill={PANEL} />
        <defs>
          <marker id="cd-arrow" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 z" fill={ARROW} />
          </marker>
          <marker id="cd-arrow-navy" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 z" fill={NAVY} />
          </marker>
        </defs>

        {/* source systems + stubs to the bus */}
        {SOURCES.map((src, i) => {
          const y = syTop + i * (sh + gap);
          return (
            <g key={src.t}>
              <rect x={sx} y={y} width={sw} height={sh} rx="7" fill={src.fill} />
              <text x={sx + 13} y={y + 16} fontSize="12.5" fontWeight="700" fill="#ffffff">{src.t}</text>
              <text x={sx + 13} y={y + 29} fontSize="9.5" fill="#ffffff" fillOpacity="0.85">{src.s}</text>
              <line x1={sx + sw} y1={smid(i)} x2={busX} y2={smid(i)} stroke={ARROW} strokeWidth="1.25" />
            </g>
          );
        })}
        {/* the bus */}
        <line x1={busX} y1={smid(0)} x2={busX} y2={smid(3)} stroke={ARROW} strokeWidth="1.5" />

        {/* TODAY — solid CSV path into the engine */}
        <path d={`M${busX},86 C ${busX + 45},86 ${ex - 45},${emidY - 12} ${ex},${emidY - 12}`} stroke={ARROW} strokeWidth="1.6" fill="none" markerEnd="url(#cd-arrow)" />
        <text x={(busX + ex) / 2} y="74" textAnchor="middle" fontSize="10" fontWeight="700" fill={MUTE}>CSV · Load Sample</text>
        <text x={(busX + ex) / 2} y="86" textAnchor="middle" fontSize="9" fill={MUTE}>today</text>

        {/* ROADMAP — dashed direct path into the engine */}
        <path d={`M${busX},150 C ${busX + 45},150 ${ex - 45},${emidY + 24} ${ex},${emidY + 24}`} stroke={NAVY} strokeWidth="1.5" strokeDasharray="5 4" fill="none" markerEnd="url(#cd-arrow-navy)" opacity="0.85" />
        <text x={(busX + ex) / 2} y="166" textAnchor="middle" fontSize="10" fontWeight="700" fill={NAVY}>direct API · MCP</text>
        <text x={(busX + ex) / 2} y="178" textAnchor="middle" fontSize="9" fill={NAVY} fillOpacity="0.85">roadmap</text>

        {/* engine */}
        <rect x={ex} y={ey} width={ew} height={eh} rx="9" fill="#0e1116" />
        <text x={ex + ew / 2} y={emidY - 16} textAnchor="middle" fontSize="15" fontWeight="700" fill="#f4eddb">Freight Close</text>
        <text x={ex + ew / 2} y={emidY + 3} textAnchor="middle" fontSize="10.5" fill="#e66a3c">calibrate · price · accrue</text>
        <text x={ex + ew / 2} y={emidY + 20} textAnchor="middle" fontSize="9" fill="#aeb4bf">deterministic · in-browser</text>

        {/* engine -> NetSuite (JE) */}
        <line x1={ex + ew} y1={emidY} x2={nx} y2={nmidY} stroke={ARROW} strokeWidth="1.6" markerEnd="url(#cd-arrow)" />
        <text x={(ex + ew + nx) / 2} y={emidY - 8} textAnchor="middle" fontSize="10" fontWeight="700" fill={GREEN}>Journal entry</text>
        <text x={(ex + ew + nx) / 2} y={emidY + 18} textAnchor="middle" fontSize="9" fill={MUTE}>Dr 6200 / Cr 21500</text>

        {/* NetSuite */}
        <rect x={nx} y={ny} width={nw} height={nh} rx="8" fill="#ffffff" stroke={BORDER} strokeWidth="1.25" />
        <text x={nx + nw / 2} y={nmidY - 5} textAnchor="middle" fontSize="13" fontWeight="700" fill={INKT}>NetSuite (ERP)</text>
        <text x={nx + nw / 2} y={nmidY + 13} textAnchor="middle" fontSize="9.5" fill={MUTE}>books the accrual</text>
      </svg>
    </div>
  );
}
