"use client";

// Suggests an entrance (src/engine/autoEntrance.ts) on the worker
// whenever a real boundary exists and the user hasn't set one of their
// own — see page.tsx for how a user drag/tap overrides this outright.
//
// Deliberately does NOT re-search on every frame of an active boundary
// drag, unlike useLiveLayout's own isDragging-gated draft/full split.
// A single draft-quality search here costs roughly 8-24x one plain
// draft generateLayout() call (it runs that many candidates) — cheap
// enough for a one-off "boundary just settled" search, but repeating it
// on every RAF-throttled drag frame would queue up far faster than the
// single-threaded worker could drain them, the exact pile-up
// useLiveLayout's own header comment dismisses as a non-issue only
// because ITS per-frame cost is a single cheap call. Instead: skip
// entirely while isDragging is true (the last suggestion just stays put,
// visually stable mid-drag — a reasonable, predictable UX on its own
// terms), then run a two-stage draft-then-full search once the boundary
// settles, mirroring the draft-now/full-shortly-after handover pattern
// already used elsewhere in this app (page.tsx's own pendingRefineRef).
import { useEffect, useRef, useState } from "react";
import type { BNGPolygon, EngineInputs } from "@/engine/types";
import type { EntranceSuggestion } from "@/engine/autoEntrance";
import type { UseEngineWorkerResult } from "./useEngineWorker";

export interface UseAutoEntranceOptions {
  /** Only searches while true — the caller decides this means "boundary has >=3 points and the user hasn't set their own entrance yet." */
  enabled: boolean;
  isDragging?: boolean;
}

export interface UseAutoEntranceResult {
  suggestion: EntranceSuggestion | null;
  /** true from the moment a search starts until the full-quality stage lands (or fails) — lets the UI show "working it out…" instead of nothing while the first draft result is still in flight. */
  isSuggesting: boolean;
}

export function useAutoEntrance(
  worker: UseEngineWorkerResult,
  boundary: BNGPolygon,
  inputs: Omit<EngineInputs, "quality">,
  opts: UseAutoEntranceOptions
): UseAutoEntranceResult {
  const { enabled, isDragging = false } = opts;
  const [suggestion, setSuggestion] = useState<EntranceSuggestion | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const seqRef = useRef(0);

  useEffect(() => {
    if (!enabled || isDragging) return;

    const seq = ++seqRef.current;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsSuggesting(true);

    worker
      .requestSuggestEntrance(boundary, { ...inputs, quality: "draft" })
      .then((draftResult) => {
        if (seq !== seqRef.current) return null; // superseded — discard, and skip the full-quality follow-up below
        setSuggestion(draftResult);
        return worker.requestSuggestEntrance(boundary, { ...inputs, quality: "full" });
      })
      .then((fullResult) => {
        if (!fullResult || seq !== seqRef.current) return;
        setSuggestion(fullResult);
        setIsSuggesting(false);
      })
      .catch(() => {
        if (seq === seqRef.current) setIsSuggesting(false);
      });
  }, [enabled, isDragging, boundary, inputs, worker]);

  return { suggestion: enabled ? suggestion : null, isSuggesting: enabled && isSuggesting };
}
