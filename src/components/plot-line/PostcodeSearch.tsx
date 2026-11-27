"use client";

// Shared postcode search box — same lookup/UI behaviour for both styles,
// just styled differently by whatever className the caller passes
// (minimal own chrome, same pattern as MixPanel).

import { useState } from "react";
import type { BNGPoint } from "@/engine/types";
import { lookupPostcode } from "@/lib/postcodeLookup";

export interface PostcodeSearchProps {
  onFound: (center: BNGPoint, postcode: string) => void;
  className?: string;
  inputClassName?: string;
  buttonClassName?: string;
}

export function PostcodeSearch({ onFound, className, inputClassName, buttonClassName }: PostcodeSearchProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || status === "loading") return;
    setStatus("loading");
    setError("");
    try {
      const result = await lookupPostcode(query);
      setStatus("idle");
      onFound(result.centerBng, result.postcode);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Lookup failed.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className={className}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Postcode (e.g. SA61 1QT)"
        className={inputClassName}
        aria-label="UK postcode"
      />
      <button type="submit" disabled={status === "loading"} className={buttonClassName}>
        {status === "loading" ? "…" : "Go"}
      </button>
      {status === "error" && <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}
