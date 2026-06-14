// Renders a FlowModel ({nodes, edges} on a col/row grid) as an inline SVG
// flowchart — no graphviz, no runtime dep. Lays out by node.col/node.row so the
// diagrams are edited as data (app/lib/flow.ts), not SVG coordinates.

import type { FlowModel, NodeKind } from "@/app/lib/flow";

const PAD = 18;
const COL_W = 250;
const ROW_H = 132;
const BOX_W = 202;
const BOX_H = 76;

// Dogsled-aligned light palette per node kind (matches the app's diagram style).
const KIND: Record<NodeKind, { fill: string; stroke: string }> = {
  input: { fill: "#e8f1f8", stroke: "#4a779e" },
  process: { fill: "#faf6ec", stroke: "#a99c7e" },
  decision: { fill: "#fdefe6", stroke: "#c25431" },
  control: { fill: "#f3ecd9", stroke: "#5c5340" },
  output: { fill: "#e8f6ef", stroke: "#2a8e6d" },
};
const TEXT = "#0e1116";
const SUBTEXT = "#5c5340";
const EDGE = "#a99c7e";

function wrap(s: string, max: number, maxLines: number): string[] {
  const words = s.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = (cur + " " + w).trim();
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].replace(/\s+\S*$/, "") + "…";
    return kept;
  }
  return lines;
}

/** Point on a box's perimeter in the direction of (tx, ty). */
function edgePoint(cx: number, cy: number, towardX: number, towardY: number) {
  const dx = towardX - cx;
  const dy = towardY - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const hw = BOX_W / 2 + 2;
  const hh = BOX_H / 2 + 2;
  const tX = dx !== 0 ? hw / Math.abs(dx) : Infinity;
  const tY = dy !== 0 ? hh / Math.abs(dy) : Infinity;
  const t = Math.min(tX, tY);
  return { x: cx + dx * t, y: cy + dy * t };
}

export function FlowDiagram({ model, title }: { model: FlowModel; title?: string }) {
  const center = (id: string) => {
    const n = model.nodes.find((x) => x.id === id)!;
    return { cx: PAD + n.col * COL_W + BOX_W / 2, cy: PAD + n.row * ROW_H + BOX_H / 2 };
  };
  const maxCol = Math.max(...model.nodes.map((n) => n.col));
  const maxRow = Math.max(...model.nodes.map((n) => n.row));
  const w = PAD * 2 + maxCol * COL_W + BOX_W;
  const h = PAD * 2 + maxRow * ROW_H + BOX_H;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full min-w-[640px]" role="img" aria-label={title ?? "process diagram"}>
        {title && <desc>{title}</desc>}
        <defs>
          <marker id="fd-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={EDGE} />
          </marker>
        </defs>

        {/* edges (drawn first, nodes paint over the ends) */}
        {model.edges.map((e, i) => {
          const a = center(e.from);
          const b = center(e.to);
          const p1 = edgePoint(a.cx, a.cy, b.cx, b.cy);
          const p2 = edgePoint(b.cx, b.cy, a.cx, a.cy);
          const mx = (p1.x + p2.x) / 2;
          const my = (p1.y + p2.y) / 2;
          return (
            <g key={i}>
              <line
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke={EDGE}
                strokeWidth={1.5}
                strokeDasharray={e.dashed ? "5 4" : undefined}
                markerEnd="url(#fd-arrow)"
              />
              {e.label && (
                <>
                  <rect x={mx - 16} y={my - 9} width={32} height={16} rx={4} fill="#f4eddb" stroke={EDGE} strokeWidth={0.75} />
                  <text x={mx} y={my + 3} textAnchor="middle" fontSize={9} fontWeight={700} fill={SUBTEXT}>
                    {e.label}
                  </text>
                </>
              )}
            </g>
          );
        })}

        {/* nodes */}
        {model.nodes.map((n) => {
          const x = PAD + n.col * COL_W;
          const y = PAD + n.row * ROW_H;
          const c = KIND[n.kind];
          const labelLines = wrap(n.label, 26, 2);
          const detailLines = n.detail ? wrap(n.detail, 34, 2) : [];
          const labelStartY = y + 22 - (labelLines.length - 1) * 7;
          return (
            <g key={n.id}>
              <rect x={x} y={y} width={BOX_W} height={BOX_H} rx={9} fill={c.fill} stroke={c.stroke} strokeWidth={1.5} />
              {labelLines.map((ln, i) => (
                <text key={i} x={x + BOX_W / 2} y={labelStartY + i * 14} textAnchor="middle" fontSize={12} fontWeight={700} fill={TEXT}>
                  {ln}
                </text>
              ))}
              {detailLines.map((ln, i) => (
                <text key={`d${i}`} x={x + BOX_W / 2} y={y + 44 + i * 12} textAnchor="middle" fontSize={9.5} fill={SUBTEXT}>
                  {ln}
                </text>
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
