"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/icons";

const TABS = [
  { href: "/", label: "CFO Overview", icon: "home" },
  { href: "/import", label: "Data Import", icon: "import" },
  { href: "/approval", label: "Approval", icon: "approval" },
  { href: "/closed", label: "Closed Periods", icon: "closed" },
  { href: "/may", label: "May Scenario", icon: "may" },
  { href: "/backtest", label: "Accuracy / Back-test", icon: "backtest" },
  { href: "/denise", label: "Denise Comparison", icon: "denise" },
  { href: "/shipments", label: "Shipment Backup", icon: "shipments" },
  { href: "/map", label: "Shipment Map", icon: "map" },
  { href: "/exceptions", label: "Exceptions", icon: "exceptions" },
  { href: "/je", label: "Journal Entries", icon: "je" },
  { href: "/close", label: "Monthly Close", icon: "close" },
  { href: "/rates", label: "Rates", icon: "rates" },
  { href: "/method", label: "How It Works", icon: "method" },
  { href: "/steps-use", label: "Steps to Use", icon: "stepsUse" },
  { href: "/steps-prepare", label: "Steps to Prepare", icon: "stepsPrepare" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="flex flex-wrap gap-1">
      {TABS.map((t) => {
        const active = path === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              active ? "bg-trail text-ink" : "text-parchment/70 hover:bg-white/10 hover:text-parchment"
            }`}
          >
            <Icon name={t.icon} className={active ? "text-ink" : "text-parchment/60"} />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
