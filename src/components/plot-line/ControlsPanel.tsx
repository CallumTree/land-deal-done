"use client";

import type { HouseTypeId } from "@/engine/types";
import type { MarketBand } from "@/rules/jurisdictions/types";

// Pro-view labels for the real engine types this dev control panel
// exposes directly today. The user-facing simplified Small/Medium/Large/
// XL + bungalow-toggle control (src/engine/sizeTiers.ts) isn't wired into
// this panel yet — deferred until a visual style is picked.
const HOUSE_TYPE_LABEL: Record<HouseTypeId, string> = {
  "2-bed-terrace": "2-bed terrace",
  "2-bed-semi": "2-bed semi",
  "2-bed-detached": "2-bed detached",
  "3-bed-terrace": "3-bed terrace",
  "3-bed-semi": "3-bed semi",
  "3-bed-detached": "3-bed detached",
  "3-bed-bungalow": "3-bed bungalow",
  "4-bed-terrace": "4-bed terrace",
  "4-bed-semi": "4-bed semi",
  "4-bed-detached": "4-bed detached",
  "5-bed-detached": "5-bed detached",
};

export type DesignStandard = "ndss" | "generous";

export interface LocalAuthorityOption {
  id: string;
  label: string;
}

export function ControlsPanel({
  mix,
  onMixChange,
  standard,
  onStandardChange,
  localAuthorityOptions,
  localAuthority,
  onLocalAuthorityChange,
  marketBand,
  onMarketBandChange,
  marketBandSalesPrice,
}: {
  mix: Record<HouseTypeId, number>;
  onMixChange: (type: HouseTypeId, weight: number) => void;
  standard: DesignStandard;
  onStandardChange: (s: DesignStandard) => void;
  localAuthorityOptions: LocalAuthorityOption[];
  localAuthority: string;
  onLocalAuthorityChange: (id: string) => void;
  marketBand: MarketBand;
  onMarketBandChange: (b: MarketBand) => void;
  marketBandSalesPrice: (b: MarketBand) => number | null;
}) {
  return (
    <div className="space-y-5">
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">House mix</h3>
        <div className="space-y-2">
          {(Object.keys(HOUSE_TYPE_LABEL) as HouseTypeId[]).map((type) => (
            <label key={type} className="flex items-center gap-2 text-xs">
              <span className="w-28 shrink-0 text-zinc-600 dark:text-zinc-400">{HOUSE_TYPE_LABEL[type]}</span>
              <input
                type="range"
                min={0}
                max={5}
                step={1}
                value={mix[type] ?? 0}
                onChange={(e) => onMixChange(type, Number(e.target.value))}
                className="flex-1 accent-sky-500"
              />
              <span className="w-4 text-right text-zinc-700 dark:text-zinc-300">{mix[type] ?? 0}</span>
            </label>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Space standard</h3>
        <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 text-xs dark:bg-zinc-800">
          <button
            type="button"
            onClick={() => onStandardChange("ndss")}
            className={`flex-1 rounded-md px-2 py-1 font-medium transition ${
              standard === "ndss" ? "bg-white shadow-sm dark:bg-zinc-700" : "text-zinc-500"
            }`}
          >
            NDSS minimum
          </button>
          <button
            type="button"
            onClick={() => onStandardChange("generous")}
            className={`flex-1 rounded-md px-2 py-1 font-medium transition ${
              standard === "generous" ? "bg-white shadow-sm dark:bg-zinc-700" : "text-zinc-500"
            }`}
          >
            Generous (+20%)
          </button>
        </div>
        <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
          Scales every house type&apos;s minimum GIA by +20% — a modelling convenience, not a
          second officially-sourced standard.
        </p>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Local authority</h3>
        <select
          value={localAuthority}
          onChange={(e) => onLocalAuthorityChange(e.target.value)}
          className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
        >
          {localAuthorityOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Market band</h3>
        <div className="grid grid-cols-4 gap-1">
          {([1, 2, 3, 4] as MarketBand[]).map((b) => {
            const price = marketBandSalesPrice(b);
            return (
              <button
                key={b}
                type="button"
                onClick={() => onMarketBandChange(b)}
                className={`rounded-md border px-1 py-1.5 text-center text-[11px] transition ${
                  marketBand === b
                    ? "border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
                    : "border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
                }`}
              >
                <div className="font-semibold">Band {b}</div>
                <div>{price ? `£${price.toLocaleString()}/m²` : "—"}</div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
