import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  title,
  subtitle,
  right,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {(title || right) && (
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-3">
          <div>
            {title && <h2 className="text-sm font-semibold text-slate-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {right}
        </header>
      )}
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

export function Badge({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}>
      {children}
    </span>
  );
}

export function Stat({
  label,
  value,
  sub,
  accent = "text-slate-900",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: string;
}) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`tnum mt-1 text-2xl font-bold ${accent}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export function PageHeader({ title, lead }: { title: string; lead?: string }) {
  return (
    <div className="mb-5">
      <h1 className="font-serif text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
      {lead && <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-600">{lead}</p>}
    </div>
  );
}
