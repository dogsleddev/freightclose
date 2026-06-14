import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { ThemeToggle } from "@/components/ThemeToggle";
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
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${serif.variable}`} suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <header className="border-b border-ink-line bg-ink text-parchment">
          <div className="mx-auto max-w-6xl px-6">
            <div className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div className="flex items-baseline gap-3">
                <span className="font-serif text-xl font-semibold tracking-tight text-parchment">
                  Freight<span className="text-trail">Close</span>
                </span>
                <span className="text-sm text-parchment/55">Ridgeline Foods · {r.period}</span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-parchment/55">
                  Accrual <span className="tnum font-semibold text-parchment">{fmtUsd(r.totalAccrual)}</span>
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                    r.allTieOutsPassed
                      ? "bg-pine/15 text-pine ring-pine/30"
                      : "bg-trail/15 text-trail ring-trail/30"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${r.allTieOutsPassed ? "bg-pine" : "bg-trail"}`} />
                  {r.allTieOutsPassed ? "All tie-outs pass" : "Tie-out failure"}
                </span>
                <ThemeToggle />
              </div>
            </div>
            <div className="pb-3">
              <Nav />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-7">{children}</main>
        <footer className="mx-auto max-w-6xl px-6 pb-10 pt-4 text-xs text-slate-500">
          <p className="font-serif text-sm italic text-slate-600">Aim high. Pull hard. Leave tracks.</p>
          <p className="mt-1">
            Deterministic engine output · {r.inputs.uniqueShipments} shipments priced · {r.inputs.invoiceLines} invoice
            lines calibrated · framework {r.framework} · figures derive only from bundled data + config ·{" "}
            <span className="text-slate-400">freightclose.dogsled.dev</span>
          </p>
        </footer>
      </body>
    </html>
  );
}
