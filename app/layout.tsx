import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { accrualRun } from "@/app/lib/accrual";
import { fmtUsd } from "@/app/lib/format";

// Pre-paint theme script: applies the saved theme before first paint (no flash).
// Default is the brand parchment light theme unless the visitor chose dark.
const THEME_SCRIPT = `(function(){try{if(localStorage.getItem('fc-theme')==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`;

const sans = Geist({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });
const serif = Fraunces({ subsets: ["latin"], variable: "--font-serif", display: "swap" });

export const metadata: Metadata = {
  title: "FreightClose — Ridgeline Foods",
  description:
    "Calibrated freight-accrual engine: prices what actually shipped using rates derived from the carriers' own invoice history, proves accuracy against six months of invoices, and produces an audit-ready accrued-freight-liability journal entry.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const r = accrualRun;
  const run = {
    period: r.period,
    accrualUsd: fmtUsd(r.totalAccrual),
    tieOutsPass: r.allTieOutsPassed,
    uniqueShipments: r.inputs.uniqueShipments,
    invoiceLines: r.inputs.invoiceLines,
    framework: r.framework,
  };
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${serif.variable}`} suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <AppShell run={run}>{children}</AppShell>
      </body>
    </html>
  );
}
