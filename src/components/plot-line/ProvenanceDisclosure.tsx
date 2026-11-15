"use client";

import { useState } from "react";
import type { ProvenanceEntry } from "@/rules/jurisdictions/provenance";

const BADGE: Record<ProvenanceEntry["classification"], { label: string; className: string }> = {
  sourced: { label: "sourced", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  approximated: { label: "approximated", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  unsourced: { label: "unsourced default", className: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300" },
};

/** One appraisal/planning figure: label + value + a provenance badge. Click to reveal the exact source citation underneath. */
export function ProvenanceRow({ entry }: { entry: ProvenanceEntry }) {
  const [open, setOpen] = useState(false);
  const badge = BADGE[entry.classification];

  return (
    <div className="border-b border-zinc-100 py-1.5 last:border-0 dark:border-zinc-800">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left text-xs"
        aria-expanded={open}
      >
        <span className="text-zinc-600 dark:text-zinc-400">{entry.label}</span>
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="font-medium text-zinc-900 dark:text-zinc-100">{entry.valueDisplay}</span>
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${badge.className}`}>{badge.label}</span>
        </span>
      </button>
      {open && <p className="mt-1 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">{entry.source}</p>}
    </div>
  );
}
