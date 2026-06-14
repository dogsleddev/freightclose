// Import points for the multi-period engine artifacts (emitted by engine/run.ts
// → engine/reconcile.ts). The UI renders these; it never recomputes. Kept
// separate from accrual.ts so the April hero accessor stays untouched.
import closedPeriodsData from "@/app/_generated/closedPeriods.json";
import periodsIndexData from "@/app/_generated/periodsIndex.json";
import mayScenarioData from "@/app/_generated/mayScenario.json";
import type { ClosedPeriodReconciliation, PeriodsIndexEntry, MayScenario } from "@/engine/types";

export const closedPeriods = closedPeriodsData as unknown as ClosedPeriodReconciliation[];
export const periodsIndex = periodsIndexData as unknown as PeriodsIndexEntry[];
export const mayScenario = mayScenarioData as unknown as MayScenario;

export const getClosedPeriod = (id: string): ClosedPeriodReconciliation | undefined =>
  closedPeriods.find((p) => p.periodId === id);
