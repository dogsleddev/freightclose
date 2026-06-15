"use client";

// Grouped left-pane navigation. Tabs are organized into four purpose-groups
// (close workflow → backup → accuracy/proof → reference) instead of one flat
// bar. Renders icon-only when the sidebar is collapsed.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icons";

type Tab = { href: string; label: string; icon: string };
type Group = { label: string; tabs: Tab[] };

const GROUPS: Group[] = [
  {
    label: "Month-end close",
    tabs: [
      { href: "/", label: "Overview", icon: "home" },
      { href: "/close", label: "Run a close", icon: "close" },
      { href: "/exceptions", label: "Exceptions", icon: "exceptions" },
      { href: "/je", label: "Journal entries", icon: "je" },
      { href: "/approval", label: "Approval", icon: "approval" },
    ],
  },
  {
    label: "Backup",
    tabs: [
      { href: "/shipments", label: "Shipment backup", icon: "shipments" },
      { href: "/map", label: "Shipment map", icon: "map" },
      { href: "/rates", label: "Rates", icon: "rates" },
    ],
  },
  {
    label: "Accuracy & proof",
    tabs: [
      { href: "/backtest", label: "Accuracy", icon: "backtest" },
      { href: "/closed", label: "Closed periods", icon: "closed" },
      { href: "/may", label: "May scenario", icon: "may" },
      { href: "/denise", label: "vs. Denise", icon: "denise" },
    ],
  },
  {
    label: "Reference",
    tabs: [
      { href: "/method", label: "Method & sensitivity", icon: "method" },
      { href: "/steps-use", label: "User guide", icon: "stepsUse" },
      { href: "/deck", label: "Slide deck", icon: "deck" },
    ],
  },
];

export function Nav({ collapsed = false }: { collapsed?: boolean }) {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-5">
      {GROUPS.map((g) => (
        <div key={g.label} className="flex flex-col gap-0.5">
          {collapsed ? (
            <div className="mx-auto mb-1 h-px w-6 bg-parchment/15" aria-hidden="true" />
          ) : (
            <div className="px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wide text-parchment/40">
              {g.label}
            </div>
          )}
          {g.tabs.map((t) => {
            const active = path === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                title={collapsed ? t.label : undefined}
                aria-label={collapsed ? t.label : undefined}
                className={`inline-flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition ${
                  collapsed ? "justify-center" : ""
                } ${
                  active
                    ? "bg-trail text-ink"
                    : "text-parchment/70 hover:bg-white/10 hover:text-parchment"
                }`}
              >
                <Icon name={t.icon} className={active ? "text-ink" : "text-parchment/60"} />
                {!collapsed && <span className="truncate">{t.label}</span>}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
