"use client";

// "Grid Runner" draggable bottom sheet — peek/half/full on phone,
// becoming a static floating left panel at the 768px+ breakpoint per the
// brief. The breakpoint switch is tracked via matchMedia (a real resize
// listener), not a CSS-only media query, because the drag gesture below
// sets an explicit inline pixel height that a CSS override couldn't take
// back control of once dragging has run on this mount.
//
// The drag handle is also a plain button that cycles peek -> half -> full
// on click/tap — not just a swipe target. That's both an accessibility
// requirement (keyboard/switch users can't swipe) and what makes the
// three states reachable for an automated screenshot test.

import { useCallback, useEffect, useRef, useState } from "react";

export type SheetSnap = "peek" | "half" | "full";

const SNAP_VH: Record<SheetSnap, number> = { peek: 0.24, half: 0.52, full: 0.9 };
const SNAP_ORDER: SheetSnap[] = ["peek", "half", "full"];

export interface BottomSheetProps {
  snap: SheetSnap;
  onSnapChange: (snap: SheetSnap) => void;
  children: React.ReactNode;
}

export function BottomSheet({ snap, onSnapChange, children }: BottomSheetProps) {
  // Must start false (matching SSR, which has no window) rather than
  // reading matchMedia in a lazy initializer — that would make the
  // CLIENT's first render disagree with the server-rendered HTML at
  // 768px+ (desktop panel markup vs server's mobile sheet markup),
  // which is a real hydration-mismatch error, not just a cosmetic
  // flash. Caught via a real browser test at tablet width. The
  // synchronous setState below (after that mismatch risk has already
  // passed — this runs post-hydration, in a later commit) is the same
  // unavoidable "effect sets initial client-only state" pattern as
  // useLiveLayout.ts's own eslint-disabled setIsComputing call.
  const [isDesktop, setIsDesktop] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const [dragHeight, setDragHeight] = useState<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Only ever called from a real pointer event handler below (never
  // during render) — safe to read the actual window.innerHeight, no SSR
  // fallback needed because this never runs server-side.
  const snapHeightPx = useCallback((s: SheetSnap) => Math.round(window.innerHeight * SNAP_VH[s]), []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (isDesktop) return;
      dragRef.current = {
        startY: e.clientY,
        startHeight: sheetRef.current?.getBoundingClientRect().height ?? snapHeightPx(snap),
      };
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    [isDesktop, snap, snapHeightPx]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!dragRef.current) return;
      const delta = dragRef.current.startY - e.clientY;
      const min = snapHeightPx("peek");
      const max = snapHeightPx("full");
      setDragHeight(Math.min(max, Math.max(min, dragRef.current.startHeight + delta)));
    },
    [snapHeightPx]
  );

  const handlePointerUp = useCallback(() => {
    if (!dragRef.current) {
      return;
    }
    const current = dragHeight ?? snapHeightPx(snap);
    let nearest: SheetSnap = "peek";
    let bestDist = Infinity;
    for (const s of SNAP_ORDER) {
      const d = Math.abs(snapHeightPx(s) - current);
      if (d < bestDist) {
        bestDist = d;
        nearest = s;
      }
    }
    dragRef.current = null;
    setDragHeight(null);
    onSnapChange(nearest);
  }, [dragHeight, snap, snapHeightPx, onSnapChange]);

  const cycleSnap = useCallback(() => {
    // A real drag (pointerup fired dragRef) already called onSnapChange
    // above — this only fires for a plain tap, where no drag happened.
    if (dragRef.current !== null) return;
    const idx = SNAP_ORDER.indexOf(snap);
    onSnapChange(SNAP_ORDER[(idx + 1) % SNAP_ORDER.length]);
  }, [snap, onSnapChange]);

  if (isDesktop) {
    return (
      <div className="pointer-events-auto absolute left-4 top-4 bottom-4 flex w-[380px] flex-col overflow-hidden rounded-[28px] border border-grid-border bg-sheet shadow-[0_0_24px_rgba(25,246,255,0.08)]">
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </div>
    );
  }

  // Idle (non-dragging) height is a plain `vh` CSS string — identical on
  // the server (no window) and the client, so it can never mismatch on
  // hydration regardless of the real device's actual viewport height.
  // Only an in-progress drag (client-only, post-mount) uses a measured
  // pixel value, via dragHeight.
  const height = dragHeight ?? `${SNAP_VH[snap] * 100}vh`;

  return (
    <div
      ref={sheetRef}
      style={{ height, transition: dragHeight === null ? "height 280ms cubic-bezier(0.32,0.72,0,1)" : "none" }}
      className="pointer-events-auto absolute inset-x-0 bottom-0 flex flex-col overflow-hidden rounded-t-[28px] border-t border-grid-border bg-sheet shadow-[0_-8px_30px_rgba(25,246,255,0.1)]"
    >
      <button
        type="button"
        onClick={cycleSnap}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        aria-label={`Bottom sheet, currently ${snap}. Tap or drag to resize.`}
        className="flex w-full shrink-0 touch-none items-center justify-center py-2.5"
      >
        <span className="h-1.5 w-10 rounded-full bg-grid-border" aria-hidden />
      </button>
      <div className="flex-1 overflow-y-auto px-5 pb-6">{children}</div>
    </div>
  );
}
