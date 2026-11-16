import type { ComplianceCheck } from "@/engine/types";
import { getComplianceCopy } from "@/copy/labels";

const DOT: Record<ComplianceCheck["status"], string> = {
  pass: "bg-emerald-500",
  warn: "bg-amber-500",
  fail: "bg-red-500",
};

/** Default view: colour + plain-English title/detail (src/copy/labels.ts), never the raw engine label/detail on their own — see CLAUDE.md "Compliance is shown as colour, not paragraphs of text." Pass `proView` to show the engine's own exact label/detail instead, one click away. */
export function ComplianceList({ checks, proView = false }: { checks: ComplianceCheck[]; proView?: boolean }) {
  return (
    <ul className="space-y-1.5">
      {checks.map((c) => {
        const copy = proView ? { title: c.label, detail: c.detail } : getComplianceCopy(c);
        return (
          <li key={c.id} className="flex items-start gap-2 text-xs">
            <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${DOT[c.status]}`} aria-hidden />
            <span>
              <span className="font-medium text-zinc-800 dark:text-zinc-200">{copy.title}</span>
              <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">{copy.detail}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
