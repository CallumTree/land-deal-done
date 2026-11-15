import type { Metrics } from "@/engine/types";

const gbp = (n: number) => `£${Math.round(n).toLocaleString()}`;

export function MetricsPanel({ metrics }: { metrics: Metrics }) {
  return (
    <div className="space-y-3">
      {metrics.affordableValueOverstated && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          <strong>⚠ Affordable value overstated.</strong> ACG (Acceptable Cost Guidance) has no
          published 2021 including-land rate for this pack, so it&apos;s approximated as equal to
          open-market value. Real social-rent transfer values are materially lower — GDV,
          developer profit and residual land value below are all overstated as a result.
        </div>
      )}

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <Metric label="Total units" value={String(metrics.totalUnits)} />
        <Metric label="Net density" value={`${metrics.netDensityDph.toFixed(1)} dph`} />
        <Metric label="Gross density" value={`${metrics.grossDensityDph.toFixed(1)} dph`} />
        <Metric label="Total GIA" value={`${metrics.totalGiaM2.toFixed(0)} m²`} />
        <Metric label="Affordable units" value={`${metrics.affordableUnits} (${metrics.affordablePercentOnSite}% on-site)`} />
        <Metric label="GDV" value={gbp(metrics.gdv)} />
        <Metric label="Build cost" value={gbp(metrics.buildCost)} />
        <Metric label="Developer profit (target)" value={gbp(metrics.developerProfit)} />
        <Metric
          label="Residual land value (indicative)"
          value={gbp(metrics.residualLandValue)}
          emphasise
        />
      </dl>

      <div className="flex flex-wrap gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
        {Object.entries(metrics.mix)
          .filter(([, n]) => n > 0)
          .map(([type, n]) => (
            <span key={type} className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
              {type}: {n}
            </span>
          ))}
      </div>
    </div>
  );
}

function Metric({ label, value, emphasise }: { label: string; value: string; emphasise?: boolean }) {
  return (
    <div>
      <dt className="text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className={emphasise ? "font-semibold text-zinc-900 dark:text-zinc-100" : "font-medium text-zinc-800 dark:text-zinc-200"}>
        {value}
      </dd>
    </div>
  );
}
