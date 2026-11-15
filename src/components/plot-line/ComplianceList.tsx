import type { ComplianceCheck } from "@/engine/types";

const DOT: Record<ComplianceCheck["status"], string> = {
  pass: "bg-emerald-500",
  warn: "bg-amber-500",
  fail: "bg-red-500",
};

export function ComplianceList({ checks }: { checks: ComplianceCheck[] }) {
  return (
    <ul className="space-y-1.5">
      {checks.map((c) => (
        <li key={c.id} className="flex items-start gap-2 text-xs">
          <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${DOT[c.status]}`} aria-hidden />
          <span>
            <span className="font-medium text-zinc-800 dark:text-zinc-200">{c.label}</span>
            <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">{c.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
