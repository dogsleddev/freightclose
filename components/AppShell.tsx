"use client";

// Application shell: a frozen top header + a collapsible left-pane navigation +
// the scrolling content area. The nav collapse state persists to localStorage so
// it survives reloads. The header stays fixed (sticky) while content scrolls.

import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { ThemeToggle } from "@/components/ThemeToggle";

export interface ShellRun {
  period: string;
  accrualUsd: string;
  tieOutsPass: boolean;
  uniqueShipments: number;
  invoiceLines: number;
  framework: string;
}

export function AppShell({ run, children }: { run: ShellRun; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("fc-nav-collapsed") === "1");
    } catch {
      /* ignore */
    }
    setMounted(true);
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem("fc-nav-collapsed", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const isCollapsed = mounted && collapsed;

  return (
    <div className="flex min-h-screen flex-col">
      {/* frozen top header */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-ink-line bg-ink px-4 text-parchment">
        <div className="flex items-center gap-3">
          <button
            onClick={toggle}
            aria-label={isCollapsed ? "Expand navigation" : "Collapse navigation"}
            title={isCollapsed ? "Expand navigation" : "Collapse navigation"}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-parchment/70 transition hover:bg-white/10 hover:text-parchment"
          >
            <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <path d="M2.5 4h11M2.5 8h11M2.5 12h11" />
            </svg>
          </button>
          <span className="font-serif text-xl font-semibold tracking-tight text-parchment">
            Freight <span className="text-trail">Close</span>
          </span>
          <span className="hidden text-sm text-parchment/55 sm:inline">Ridgeline Foods · {run.period}</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="hidden text-parchment/55 md:inline">
            Accrual <span className="tnum font-semibold text-parchment">{run.accrualUsd}</span>
          </span>
          <span
            className={`hidden items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset sm:inline-flex ${
              run.tieOutsPass ? "bg-pine/15 text-pine ring-pine/30" : "bg-trail/15 text-trail ring-trail/30"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${run.tieOutsPass ? "bg-pine" : "bg-trail"}`} />
            {run.tieOutsPass ? "All tie-outs pass" : "Tie-out failure"}
          </span>
          <ThemeToggle />
        </div>
      </header>

      {/* body: sidebar + content */}
      <div className="flex flex-1">
        <aside
          className={`sticky top-14 h-[calc(100vh-3.5rem)] shrink-0 overflow-y-auto border-r border-ink-line bg-ink px-2 py-4 transition-[width] duration-200 ${
            isCollapsed ? "w-16" : "w-60"
          }`}
        >
          <Nav collapsed={isCollapsed} />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <main className="min-w-0 flex-1 px-6 py-7">
            <div className="mx-auto max-w-6xl">{children}</div>
          </main>
          <footer className="px-6 pb-10 pt-4 text-xs text-slate-500">
            <div className="mx-auto max-w-6xl">
              <p className="font-serif text-sm italic text-slate-600">Aim high. Pull hard. Leave tracks.</p>
              <p className="mt-1">
                Deterministic engine output · {run.uniqueShipments} shipments priced · {run.invoiceLines} invoice lines
                calibrated · framework {run.framework} · figures derive only from bundled data + config ·{" "}
                <span className="text-slate-400">freightclose.dogsled.dev</span>
              </p>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
