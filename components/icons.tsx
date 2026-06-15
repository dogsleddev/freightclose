// Tiny inline-SVG icon set for the tab nav (no icon library — keeps the bundle
// lean and the markup self-contained). Each entry is the inner geometry of a
// 16×16, stroke="currentColor" glyph; the <Icon> wrapper supplies the frame so
// icons inherit text color and sit inline with the label.

import type { ReactNode } from "react";

const GLYPHS: Record<string, ReactNode> = {
  home: (
    <>
      <path d="M2.5 8 8 3l5.5 5" />
      <path d="M4 7.2V13h8V7.2" />
    </>
  ),
  import: (
    <>
      <path d="M8 2.5v7" />
      <path d="M5.5 7 8 9.5 10.5 7" />
      <path d="M3 12.5h10" />
    </>
  ),
  approval: (
    <>
      <path d="M8 2.2 12.8 4v3.8c0 3-2.1 4.9-4.8 5.8C5.3 12.7 3.2 10.8 3.2 7.8V4z" />
      <path d="M6 7.8 7.4 9.2 10 6.4" />
    </>
  ),
  closed: (
    <>
      <rect x="3.5" y="7" width="9" height="6" rx="1" />
      <path d="M5.2 7V5.3a2.8 2.8 0 0 1 5.6 0V7" />
    </>
  ),
  may: (
    <>
      <path d="M6.2 2.3v3.5L3.6 11.7A1 1 0 0 0 4.5 13.2h7a1 1 0 0 0 .9-1.5L9.8 5.8V2.3" />
      <path d="M5.6 2.3h4.8" />
      <path d="M5 10h6" />
    </>
  ),
  backtest: (
    <>
      <circle cx="8" cy="8" r="5.3" />
      <circle cx="8" cy="8" r="2.3" />
      <path d="M8 8h.01" />
    </>
  ),
  denise: (
    <>
      <path d="M8 2.6v10.8" />
      <path d="M4.2 4.8h7.6" />
      <path d="M4.2 4.8 2.6 8.4h3.2z" />
      <path d="M11.8 4.8 10.2 8.4h3.2z" />
      <path d="M5.4 13.4h5.2" />
    </>
  ),
  shipments: (
    <>
      <rect x="2.6" y="4" width="10.8" height="8" rx="1" />
      <path d="M2.6 7h10.8" />
      <path d="M6 7v5" />
    </>
  ),
  map: (
    <>
      <path d="M8 13.6c2.6-2.6 4.2-4.6 4.2-7a4.2 4.2 0 1 0-8.4 0c0 2.4 1.6 4.4 4.2 7z" />
      <circle cx="8" cy="6.6" r="1.5" />
    </>
  ),
  exceptions: (
    <>
      <path d="M4.2 2.4v11.2" />
      <path d="M4.2 3.2h7.2l-1.6 2.6 1.6 2.6H4.2" />
    </>
  ),
  je: (
    <>
      <path d="M4 3h6.5a1 1 0 0 1 1 1v9H5a1 1 0 0 1-1-1V3z" />
      <path d="M6 6h3.5" />
      <path d="M6 8.4h3.5" />
    </>
  ),
  close: (
    <>
      <rect x="3" y="4" width="10" height="9" rx="1" />
      <path d="M3 6.6h10" />
      <path d="M5.5 2.8v2.2" />
      <path d="M10.5 2.8v2.2" />
      <path d="M6 9.6 7.3 11 9.9 8.2" />
    </>
  ),
  rates: (
    <>
      <path d="M8.4 2.6H3.5a1 1 0 0 0-1 1v4.9l5.6 5.6a1 1 0 0 0 1.4 0l3.9-3.9a1 1 0 0 0 0-1.4z" />
      <circle cx="5.5" cy="5.6" r="0.9" />
    </>
  ),
  method: (
    <>
      <path d="M3 5h5" />
      <path d="M10.5 5H13" />
      <path d="M3 11h2.5" />
      <path d="M8 11h5" />
      <circle cx="9" cy="5" r="1.3" />
      <circle cx="6.5" cy="11" r="1.3" />
    </>
  ),
  stepsUse: (
    <>
      <path d="M5.5 4h8" />
      <path d="M5.5 8h8" />
      <path d="M5.5 12h8" />
      <path d="M3 4h.01" />
      <path d="M3 8h.01" />
      <path d="M3 12h.01" />
    </>
  ),
  deck: (
    <>
      <rect x="2.5" y="3" width="11" height="7.5" rx="1" />
      <path d="M8 10.5V13" />
      <path d="M5.5 13h5" />
    </>
  ),
  stepsPrepare: (
    <>
      <rect x="3.6" y="3.8" width="8.8" height="9.4" rx="1" />
      <path d="M6 3.8V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v.8" />
      <path d="M5.8 9 7.2 10.4 10 7.6" />
    </>
  ),
};

export function Icon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {GLYPHS[name] ?? null}
    </svg>
  );
}
