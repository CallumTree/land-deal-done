"use client";

// Audit: this used to export ProvenanceRow — every single appraisal/
// planning figure got its own always-visible colour badge (sourced/
// approximated/unsourced) plus its own individual tap-to-reveal-citation,
// ~19 rows of repeated badges for a first-time developer to scan, each
// requiring its own tap to actually see the citation. ProvenanceSummary
// (below) replaces that per-line pattern with ONE confidence line
// covering every entry passed in, plus a SINGLE one-tap detail panel
// that lists every entry's label/value/citation together (no per-row
// badge or toggle — the one tap on the summary already said "show me
// the detail"). ProvenanceRow is deleted outright, not kept unused —
// nothing else referenced it once page.tsx switched over.

import { useState } from "react";
import type { ProvenanceEntry } from "@/rules/jurisdictions/provenance";

const CONFIDENCE_DOT: Record<"sourced" | "approximated" | "unsourced", string> = {
  sourced: "bg-emerald-500",
  approximated: "bg-amber-500",
  unsourced: "bg-zinc-400",
};

/** One line summarising every entry's provenance, colour-coded by the WORST classification present (unsourced > approximated > sourced) — plus a single one-tap panel listing every entry's label/value/citation. Replaces showing a badge on every individual line (see module comment above). */
export function ProvenanceSummary({ entries }: { entries: ProvenanceEntry[] }) {
  const [open, setOpen] = useState(false);
  const counts = { sourced: 0, approximated: 0, unsourced: 0 };
  for (const e of entries) counts[e.classification]++;

  const worst: "sourced" | "approximated" | "unsourced" = counts.unsourced > 0 ? "unsourced" : counts.approximated > 0 ? "approximated" : "sourced";

  const parts: string[] = [];
  if (counts.sourced > 0) parts.push(`${counts.sourced} sourced`);
  if (counts.approximated > 0) parts.push(`${counts.approximated} approximated`);
  if (counts.unsourced > 0) parts.push(`${counts.unsourced} unsourced default`);
  const summary = `${entries.length} planning & appraisal figure${entries.length === 1 ? "" : "s"}: ${parts.join(", ")}.`;

  return (
    <div>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-2 text-left text-xs">
        <span className={`h-2 w-2 shrink-0 rounded-full ${CONFIDENCE_DOT[worst]}`} aria-hidden />
        <span className="text-zinc-600 dark:text-zinc-400">{summary}</span>
        <span className="ml-auto shrink-0 text-[11px] font-medium text-zinc-400 dark:text-zinc-500">{open ? "Hide" : "Show"} sources</span>
      </button>
      {open && (
        <ul className="mt-2 space-y-1.5 border-t border-zinc-100 pt-2 dark:border-zinc-800">
          {entries.map((e) => (
            <li key={e.id} className="text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-zinc-600 dark:text-zinc-400">{e.label}</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{e.valueDisplay}</span>
              </div>
              <p className="text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">{e.source}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
