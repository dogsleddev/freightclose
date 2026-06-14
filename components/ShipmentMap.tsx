// Shipment Map — a geographic view of the period's accrual (new; no prototype
// has one). The challenge data carries no lat/lng, so the engine output is
// aggregated to destination STATE and plotted on a small undistorted
// equirectangular projection: a hub-and-spoke freight network radiating from
// the Denver HQ, bubbles sized by accrual $ and colored by carrier, with the
// Denver / Salt Lake City origin split surfaced (the per-origin DATA forensics).
// Pure render over accrualRun — no map library, no network, no hooks.

import { accrualRun } from "@/app/lib/accrual";
import { Card, Badge } from "@/components/ui";
import { fmtUsd, fmtNum, carrierName, carrierAccent } from "@/app/lib/format";
import type { Carrier } from "@/engine/types";

const carrierHex: Record<Carrier, string> = {
  peak: "#e66a3c", // trail orange
  heartland: "#2a8e6d", // pine
  coastal: "#4a779e", // sky
};

// Approximate geographic centers (lat, lng). Covers every state in the data and
// then some, so a new period's lanes still plot.
const STATE_CENTROID: Record<string, [number, number]> = {
  AL: [32.8, -86.8], AZ: [34.2, -111.7], AR: [34.9, -92.4], CA: [37.2, -119.4],
  CO: [39.0, -105.5], CT: [41.6, -72.7], DE: [39.0, -75.5], FL: [28.6, -81.5],
  GA: [32.6, -83.4], ID: [44.4, -114.6], IL: [40.0, -89.2], IN: [39.9, -86.3],
  IA: [42.0, -93.5], KS: [38.5, -98.3], KY: [37.5, -85.3], LA: [31.0, -92.0],
  ME: [45.4, -69.2], MD: [39.0, -76.8], MA: [42.3, -71.8], MI: [44.3, -85.4],
  MN: [46.3, -94.3], MS: [32.7, -89.7], MO: [38.5, -92.3], MT: [46.9, -110.0],
  NE: [41.5, -99.8], NV: [39.3, -116.9], NH: [43.7, -71.6], NJ: [40.1, -74.7],
  NM: [34.4, -106.1], NY: [42.9, -75.5], NC: [35.6, -79.4], ND: [47.5, -100.3],
  OH: [40.3, -82.8], OK: [35.6, -97.5], OR: [43.9, -120.6], PA: [40.9, -77.8],
  RI: [41.7, -71.5], SC: [33.9, -80.9], SD: [44.4, -100.2], TN: [35.9, -86.4],
  TX: [31.5, -99.3], UT: [39.3, -111.7], VT: [44.1, -72.7], VA: [37.5, -78.9],
  WA: [47.4, -120.5], WV: [38.6, -80.6], WI: [44.6, -89.9], WY: [43.0, -107.5],
};

const ORIGIN_CENTROID: Record<string, [number, number]> = {
  "Denver, CO": [39.74, -104.99],
  "Salt Lake City, UT": [40.76, -111.89],
};

interface StateAgg {
  state: string;
  count: number;
  accrual: number;
  carrier: Carrier; // dominant (the data is single-carrier per state)
  lat: number;
  lng: number;
}

function aggregate() {
  const byState = new Map<string, StateAgg>();
  const originCount = new Map<string, number>();
  let total = 0;
  let unplottable = 0;

  for (const s of accrualRun.shipmentEstimates) {
    total += s.total;
    const o = `${s.origin.city}, ${s.origin.state}`;
    originCount.set(o, (originCount.get(o) ?? 0) + 1);

    const st = s.destination.state;
    const centroid = STATE_CENTROID[st];
    if (!centroid) {
      unplottable++;
      continue;
    }
    const cur =
      byState.get(st) ??
      { state: st, count: 0, accrual: 0, carrier: s.carrier, lat: centroid[0], lng: centroid[1] };
    cur.count++;
    cur.accrual += s.total;
    cur.carrier = s.carrier;
    byState.set(st, cur);
  }

  const states = [...byState.values()].sort((a, b) => b.accrual - a.accrual);
  const origins = [...originCount.entries()].sort((a, b) => b[1] - a[1]);
  return { states, origins, total, unplottable };
}

export function ShipmentMap() {
  const { states, origins, total, unplottable } = aggregate();
  const maxAccrual = Math.max(...states.map((s) => s.accrual), 1);
  const totalShipments = states.reduce((a, s) => a + s.count, 0) + unplottable;

  // --- projection (undistorted equirectangular, auto-fit) -------------------
  const W = 760;
  const H = 440;
  const pad = 46;
  const originPts = origins
    .map(([name]) => ORIGIN_CENTROID[name])
    .filter((p): p is [number, number] => Boolean(p));
  const pts: [number, number][] = [...states.map((s) => [s.lat, s.lng] as [number, number]), ...originPts];
  const midLat = pts.reduce((a, p) => a + p[0], 0) / Math.max(pts.length, 1);
  const k = Math.cos((midLat * Math.PI) / 180); // longitude compression at this latitude
  const wx = (lng: number) => lng * k;
  const wy = (lat: number) => -lat;
  const xsW = pts.map((p) => wx(p[1]));
  const ysW = pts.map((p) => wy(p[0]));
  let minX = Math.min(...xsW), maxX = Math.max(...xsW), minY = Math.min(...ysW), maxY = Math.max(...ysW);
  const padX = (maxX - minX) * 0.1 || 1;
  const padY = (maxY - minY) * 0.1 || 1;
  minX -= padX; maxX += padX; minY -= padY; maxY += padY;
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const scale = Math.min((W - 2 * pad) / spanX, (H - 2 * pad) / spanY);
  const offX = (W - scale * spanX) / 2;
  const offY = (H - scale * spanY) / 2;
  const X = (lng: number) => offX + (wx(lng) - minX) * scale;
  const Y = (lat: number) => offY + (wy(lat) - minY) * scale;
  const radius = (accrual: number) => 7 + 25 * Math.sqrt(accrual / maxAccrual);

  const primaryOrigin = origins[0]?.[0] ?? "Denver, CO";
  const primaryPt = ORIGIN_CENTROID[primaryOrigin];

  return (
    <div className="space-y-6">
      <Card
        title="Shipment map — where the freight ships"
        subtitle={`${fmtNum(totalShipments)} priced shipments across ${states.length} destination states, plotted by destination. Bubble area = priced shipment value; color = carrier. Lanes radiate from the ${primaryOrigin.split(",")[0]} HQ.`}
        right={
          <div className="flex flex-wrap items-center gap-2">
            {(["peak", "heartland", "coastal"] as Carrier[]).map((c) => (
              <span key={c} className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: carrierHex[c] }} />
                {carrierName[c]}
              </span>
            ))}
          </div>
        }
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Map of shipments by destination state">
          <rect x={2} y={2} width={W - 4} height={H - 4} rx={12} fill="#faf6ec" stroke="#e6dcc1" />

          {/* freight lanes from the primary origin to each destination */}
          {primaryPt &&
            states.map((s) => (
              <line
                key={`lane-${s.state}`}
                x1={X(primaryPt[1])}
                y1={Y(primaryPt[0])}
                x2={X(s.lng)}
                y2={Y(s.lat)}
                stroke={carrierHex[s.carrier]}
                strokeWidth={1}
                strokeOpacity={0.22}
              />
            ))}

          {/* destination bubbles */}
          {states.map((s) => {
            const r = radius(s.accrual);
            return (
              <g key={s.state}>
                <title>{`${s.state} — ${carrierName[s.carrier]} · ${s.count} shipments · ${fmtUsd(s.accrual)}`}</title>
                <circle cx={X(s.lng)} cy={Y(s.lat)} r={r} fill={carrierHex[s.carrier]} fillOpacity={0.82} stroke="#fff" strokeWidth={1.5} />
                <text x={X(s.lng)} y={Y(s.lat)} textAnchor="middle" dominantBaseline="central" fontSize={r >= 13 ? 11 : 9} fontWeight={700} fill="#fff">
                  {s.state}
                </text>
              </g>
            );
          })}

          {/* origin pins */}
          {origins.map(([name, count], i) => {
            const p = ORIGIN_CENTROID[name];
            if (!p) return null;
            const isPrimary = i === 0;
            const cx = X(p[1]);
            const cy = Y(p[0]);
            const d = isPrimary ? 9 : 6;
            return (
              <g key={`origin-${name}`}>
                <title>{`${name} — origin of ${count} shipments`}</title>
                <rect x={cx - d} y={cy - d} width={d * 2} height={d * 2} transform={`rotate(45 ${cx} ${cy})`} fill="#0e1116" stroke="#faf6ec" strokeWidth={1.5} />
                <text x={cx} y={cy - d - 6} textAnchor="middle" fontSize={11} fontWeight={700} fill="#0e1116">
                  {name.split(",")[0]} {isPrimary ? "HQ" : ""} ({count})
                </text>
              </g>
            );
          })}
        </svg>

        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-slate-500">
          <span>◆ origin · ● destination (area ∝ accrual)</span>
          <span>
            <span className="font-medium text-slate-700">Origin split:</span>{" "}
            {origins.map(([name, count]) => `${name.split(",")[0]} ${count}`).join(" · ")} — invoice history does not
            separate origins, so non-{primaryOrigin.split(",")[0]} lanes are priced on the {primaryOrigin.split(",")[0]}-primary
            calibrated mileage and flagged (see Rates → Peak mileage table).
          </span>
          {unplottable > 0 && <span>{unplottable} shipment(s) without a mappable state — counted in totals, not plotted.</span>}
        </div>
      </Card>

      <Card title="By destination state" subtitle="The priced freight by state — every dollar ties back to the shipment backup.">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3 font-medium">State</th>
                <th className="py-2 px-3 font-medium">Carrier</th>
                <th className="py-2 px-3 text-right font-medium">Shipments</th>
                <th className="py-2 px-3 text-right font-medium">Accrual</th>
                <th className="py-2 pl-3 font-medium">Share of total</th>
              </tr>
            </thead>
            <tbody>
              {states.map((s) => (
                <tr key={s.state} className="border-b border-slate-100">
                  <td className="py-2 pr-3 font-semibold text-slate-800">{s.state}</td>
                  <td className="py-2 px-3">
                    <Badge className={carrierAccent[s.carrier]}>{carrierName[s.carrier]}</Badge>
                  </td>
                  <td className="tnum py-2 px-3 text-right text-slate-600">{s.count}</td>
                  <td className="tnum py-2 px-3 text-right font-medium text-slate-800">{fmtUsd(s.accrual)}</td>
                  <td className="py-2 pl-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full" style={{ width: `${(s.accrual / maxAccrual) * 100}%`, background: carrierHex[s.carrier] }} />
                      </div>
                      <span className="tnum text-xs text-slate-500">{((s.accrual / total) * 100).toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 font-semibold text-slate-900">
                <td className="py-2 pr-3">Total</td>
                <td className="py-2 px-3 text-xs font-normal text-slate-500">{states.length} states</td>
                <td className="tnum py-2 px-3 text-right">{fmtNum(totalShipments)}</td>
                <td className="tnum py-2 px-3 text-right">{fmtUsd(total)}</td>
                <td className="py-2 pl-3" />
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          Σ priced shipments {fmtUsd(accrualRun.totalSubtotal)} {fmtUsd(accrualRun.totalCreditReserve)} portfolio credit
          reserve = booked accrual <span className="font-medium text-slate-700">{fmtUsd(accrualRun.totalAccrual)}</span>.
          The reserve (historical net invoice adjustments, ~−0.3%) is a portfolio-level contra, not attributable to any
          one destination, so it is booked once on the journal entry rather than plotted here.
        </p>
      </Card>
    </div>
  );
}
