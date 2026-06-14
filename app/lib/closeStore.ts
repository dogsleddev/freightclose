// Client-side persistence for monthly closes and rate-config versions.
// IndexedDB, no dependencies. Everything stays in the browser — consistent
// with the zero-env-var, no-DB core path. The engine remains the source of
// truth: this store only holds engine inputs and engine outputs, so any close
// can be recomputed bit-for-bit from what is stored.

import type { AccrualRun, Carrier, RateSource } from "@/engine/types";
import type { RateConfigVersion } from "@/engine/configSet";

export interface StoredClose {
  periodKey: string; // "2026-05" (primary key)
  run: AccrualRun;
  inputs: {
    shipmentsCsv: string;
    invoicesCsv: string | null; // newly uploaded invoice months, if any
  };
  configVersionId: string;
  savedAt: number;
}

export interface StoredSettings {
  rateSource: Record<Carrier, RateSource>;
}

/** A CFO sign-off that locks a period + archives its run (recomputable). */
export interface PeriodApproval {
  periodKey: string; // "2026-04" (primary key)
  period: string; // "April 2026"
  approvedBy: string;
  approvedAt: number;
  totalAccrual: number;
  checklist: { label: string; ok: boolean; auto: boolean }[]; // gate snapshot at approval
  runSnapshot: AccrualRun; // archived engine output (ties to the stored CSV inputs)
}

const DB_NAME = "freightclose";
const DB_VERSION = 2;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("closes")) {
        db.createObjectStore("closes", { keyPath: "periodKey" });
      }
      if (!db.objectStoreNames.contains("configVersions")) {
        db.createObjectStore("configVersions", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings");
      }
      if (!db.objectStoreNames.contains("approvals")) {
        db.createObjectStore("approvals", { keyPath: "periodKey" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(storeName, mode);
        const req = fn(t.objectStore(storeName));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      })
  );
}

// --- closes ------------------------------------------------------------------

export async function listCloses(): Promise<StoredClose[]> {
  const all = await tx<StoredClose[]>("closes", "readonly", (s) => s.getAll() as IDBRequest<StoredClose[]>);
  return all.sort((a, b) => a.periodKey.localeCompare(b.periodKey));
}

export async function getClose(periodKey: string): Promise<StoredClose | undefined> {
  return tx<StoredClose | undefined>("closes", "readonly", (s) => s.get(periodKey) as IDBRequest<StoredClose | undefined>);
}

export async function saveClose(close: StoredClose): Promise<void> {
  await tx("closes", "readwrite", (s) => s.put(close));
}

export async function deleteClose(periodKey: string): Promise<void> {
  await tx("closes", "readwrite", (s) => s.delete(periodKey));
}

// --- config versions ----------------------------------------------------------

export interface StoredVersion extends RateConfigVersion {
  savedAt: number;
}

export async function listVersions(): Promise<StoredVersion[]> {
  const all = await tx<StoredVersion[]>("configVersions", "readonly", (s) => s.getAll() as IDBRequest<StoredVersion[]>);
  return all.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom) || a.savedAt - b.savedAt);
}

export async function saveVersion(v: StoredVersion): Promise<void> {
  await tx("configVersions", "readwrite", (s) => s.put(v));
}

export async function deleteVersion(id: string): Promise<void> {
  await tx("configVersions", "readwrite", (s) => s.delete(id));
}

// --- approvals (period lock + archive) ------------------------------------------

export async function listApprovals(): Promise<PeriodApproval[]> {
  const all = await tx<PeriodApproval[]>("approvals", "readonly", (s) => s.getAll() as IDBRequest<PeriodApproval[]>);
  return all.sort((a, b) => a.periodKey.localeCompare(b.periodKey));
}

export async function getApproval(periodKey: string): Promise<PeriodApproval | undefined> {
  return tx<PeriodApproval | undefined>("approvals", "readonly", (s) => s.get(periodKey) as IDBRequest<PeriodApproval | undefined>);
}

export async function saveApproval(approval: PeriodApproval): Promise<void> {
  await tx("approvals", "readwrite", (s) => s.put(approval));
}

/** Re-open (unlock) a locked period. */
export async function deleteApproval(periodKey: string): Promise<void> {
  await tx("approvals", "readwrite", (s) => s.delete(periodKey));
}

// --- settings ------------------------------------------------------------------

const SETTINGS_KEY = "settings";

export async function getSettings(): Promise<StoredSettings | undefined> {
  return tx<StoredSettings | undefined>("settings", "readonly", (s) => s.get(SETTINGS_KEY) as IDBRequest<StoredSettings | undefined>);
}

export async function saveSettings(v: StoredSettings): Promise<void> {
  await tx("settings", "readwrite", (s) => s.put(v, SETTINGS_KEY));
}
