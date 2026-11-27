"use client";

// Fetches Site Layers (slope + flood) for the current boundary from
// /api/site-layers — once the boundary is finished and not mid-drag,
// debounced so dragging a corner doesn't fire a request per frame.
// Never throws: a network failure becomes the same calm "unavailable"
// state the server returns for an area it can't cover.

import { useEffect, useRef, useState } from "react";
import type { BNGPolygon } from "@/engine/types";
import { encodeBoundary, type SiteLayersResponse } from "@/lib/siteLayers/types";

export type SiteLayersState = { status: "idle" } | { status: "loading" } | SiteLayersResponse;

const DEBOUNCE_MS = 600;

/**
 * `enabled` false (still drawing, or mid-drag) pauses fetching but KEEPS
 * the last result on screen, so a corner drag doesn't blank the card and
 * the map hatch for a moment — the new result lands after release.
 */
export function useSiteLayers(boundary: BNGPolygon, enabled: boolean): SiteLayersState {
  const [state, setState] = useState<SiteLayersState>({ status: "idle" });
  const key = boundary.length >= 3 ? encodeBoundary(boundary) : null;
  // The boundary the current `state` belongs to — re-enabling with the
  // same boundary (e.g. back from drawing a keep-clear zone) is a no-op.
  const settledKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!key) {
      settledKeyRef.current = null;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ status: "idle" });
      return;
    }
    if (!enabled || key === settledKeyRef.current) return;
    setState({ status: "loading" });
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/site-layers?b=${encodeURIComponent(key)}`, { signal: controller.signal })
        .then((res) => {
          if (!res.ok) throw new Error(`site-layers ${res.status}`);
          return res.json() as Promise<SiteLayersResponse>;
        })
        .then((body) => {
          settledKeyRef.current = key;
          setState(body);
        })
        .catch(() => {
          // Not marked settled: the next enable retries a failed fetch.
          if (!controller.signal.aborted) setState({ status: "unavailable", reason: "upstream-failed" });
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, enabled]);

  return state;
}
