import Link from "next/link";
import { Icon } from "@/components/icons";

// Cross-link from a workflow tab to its section of the User Guide, so a reviewer
// can drill the process without the nav pane. Bidirectional: the guide links back.
export function GuideLink({ anchor, label }: { anchor: string; label: string }) {
  return (
    <Link
      href={`/steps-use#${anchor}`}
      className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-ink"
    >
      <Icon name="stepsUse" className="text-slate-400" />
      User guide — {label}
      <span aria-hidden="true">→</span>
    </Link>
  );
}
