export const fmtUsd = (n: number, dp = 0): string =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: dp, maximumFractionDigits: dp });

export const fmtUsd2 = (n: number): string => fmtUsd(n, 2);

export const fmtPct = (n: number, dp = 1): string => `${(n * 100).toFixed(dp)}%`;

export const fmtSignedPct = (n: number, dp = 1): string => `${n >= 0 ? "+" : ""}${(n * 100).toFixed(dp)}%`;

export const fmtNum = (n: number, dp = 0): string =>
  n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });

export const carrierName: Record<string, string> = {
  peak: "Peak Logistics",
  heartland: "Heartland Freight",
  coastal: "Coastal Express",
};

export const carrierAccent: Record<string, string> = {
  peak: "bg-amber-100 text-amber-800 ring-amber-200",
  heartland: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  coastal: "bg-sky-100 text-sky-800 ring-sky-200",
};

export const severityStyle: Record<string, string> = {
  info: "bg-slate-100 text-slate-700 ring-slate-200",
  warn: "bg-amber-100 text-amber-800 ring-amber-200",
  error: "bg-red-100 text-red-800 ring-red-200",
};
