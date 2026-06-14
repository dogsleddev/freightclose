"use client";

// Shared CSV pick/paste/validate block — used by Run a close (/close).
// Extracted so the upload UX lives in one place.

import { useState } from "react";
import type { CsvValidation } from "@/app/lib/closeClient";

export type FilePick = { name: string; text: string } | null;

export function readFile(f: File): Promise<{ name: string; text: string }> {
  return f.text().then((text) => ({ name: f.name, text }));
}

export function UploadBlock({
  label,
  hint,
  file,
  validation,
  onPick,
}: {
  label: string;
  hint: string;
  file: FilePick;
  validation: CsvValidation | null;
  onPick: (f: File | undefined, pasted?: string) => void;
}) {
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="text-sm font-semibold text-slate-900">{label}</div>
      <div className="mt-0.5 text-xs text-slate-500">{hint}</div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
          Choose CSV…
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => onPick(e.target.files?.[0])}
          />
        </label>
        <button
          className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50"
          onClick={() => setPasteOpen((o) => !o)}
        >
          {pasteOpen ? "Hide paste box" : "Paste CSV text"}
        </button>
        {file && <span className="font-mono text-xs text-slate-500">{file.name}</span>}
        {file && (
          <button className="text-xs text-slate-400 underline" onClick={() => onPick(undefined)}>
            clear
          </button>
        )}
      </div>
      {pasteOpen && (
        <div className="mt-2">
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={5}
            placeholder="Paste CSV including the header row"
            className="w-full rounded-md border border-slate-300 p-2 font-mono text-xs"
          />
          <button
            className="mt-1 rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => onPick(undefined, pasteText)}
          >
            Use pasted text
          </button>
        </div>
      )}
      {validation && (
        <div className="mt-3 space-y-1 text-xs">
          <div className={validation.ok ? "text-emerald-700" : "text-red-700"}>
            {validation.ok
              ? `✓ schema OK — ${validation.rowCount} rows${validation.monthsFound.length ? `, months ${validation.monthsFound.join(", ")}` : ""}`
              : "✗ schema problems:"}
          </div>
          {validation.errors.map((e, i) => (
            <div key={i} className="text-red-700">
              {e}
            </div>
          ))}
          {validation.warnings.map((w, i) => (
            <div key={i} className="text-amber-700">
              {w}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
