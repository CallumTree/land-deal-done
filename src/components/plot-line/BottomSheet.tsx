"use client";

// "Grid Runner" draggable bottom sheet — peek/half/full on phone,
// becoming a static floating left panel at the 768px+ breakpoint per the
// brief. The breakpoint switch is tracked via matchMedia (a real resize
// listener), not a CSS-only media query, because the drag gesture below
// sets an explicit inline pixel height that a CSS override couldn't take
// back control of once dragging has run on this mount.
//
// Bug this version fixes: the sheet could trap the user at half/full
// with no way back to the map. The ONLY draggable element used to be
// the thin handle bar — dragging or scrolling the CONTENT below it did
// nothing to the sheet's height, so a user whose instinct was to swipe
// the content down (standard bottom-sheet behaviour everywhere else)
// found nothing happened. Two independent ways back to the map now
// exist, on top of the handle:
// 1. Dragging the CONTENT down from its own scroll top collapses the
//    sheet (handleContentPointerMove below) — ordinary scrolling is
//    left completely alone once content.scrollTop > 0.
// 2. Tapping the map itself (SiteCanvas's onMapInteraction, wired in
//    page.tsx, not this file) drops the sheet to peek regardless of
//    where it was.
// The handle's tap gesture was also simplified from a 3-way cycle to a
// peek<->half toggle — tapping from "full" now goes straight to
// "peek" in one tap, instead of one more tap than from "half".

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
  const contentRef = useRef<HTMLDivElement>(null);
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

  const beginDrag = useCallback(
    (clientY: number) => {
      dragRef.current = {
        startY: clientY,
        startHeight: sheetRef.current?.getBoundingClientRect().height ?? snapHeightPx(snap),
      };
    },
    [snap, snapHeightPx]
  );

  const updateDrag = useCallback(
    (clientY: number) => {
      if (!dragRef.current) return;
      const delta = dragRef.current.startY - clientY;
      const min = snapHeightPx("peek");
      const max = snapHeightPx("full");
      setDragHeight(Math.min(max, Math.max(min, dragRef.current.startHeight + delta)));
    },
    [snapHeightPx]
  );

  const endDrag = useCallback(() => {
    if (!dragRef.current) return;
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

  // --- Handle/header bar: always draggable in either direction, no
  // matter the current snap or scroll state — this is the one element
  // that's never gated on anything. ---
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (isDesktop) return;
      beginDrag(e.clientY);
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    [isDesktop, beginDrag]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      updateDrag(e.clientY);
    },
    [updateDrag]
  );

  const handlePointerUp = useCallback(() => {
    endDrag();
  }, [endDrag]);

  const cycleSnap = useCallback(() => {
    // A real drag (pointerup fired dragRef) already called onSnapChange
    // above — this only fires for a plain tap, where no drag happened.
    if (dragRef.current !== null) return;
    // peek<->half, and "full" also collapses straight to peek — so a
    // single tap on the handle always gets the map back, regardless of
    // which of the three states the sheet is currently in.
    onSnapChange(snap === "peek" ? "half" : "peek");
  }, [snap, onSnapChange]);

  // --- Content area: standard mobile bottom-sheet drag-to-collapse,
  // driven entirely by hand rather than relying on preventDefault() to
  // suppress the browser's own scroll. That's deliberate, found the
  // hard way via real touch-emulation testing: preventDefault() on a
  // *pointermove* event does not reliably cancel the touch's own
  // default scrolling action in Chromium (only preventDefault on the
  // underlying *touchmove* does, per how the two event models relate) —
  // so a first version of this that called e.preventDefault() inside a
  // React onPointerMove handler would arm correctly on the first move
  // event but then stop receiving further move events for that same
  // gesture entirely, leaving the sheet stuck mid-drag. Native
  // addEventListener with {passive:false}, plus `touch-action: none`
  // on the element (set via the touch-none class below) so the browser
  // never starts its own scroll for this element in the first place,
  // sidesteps that whole class of problem: every scroll pixel is this
  // code manually setting `content.scrollTop`, so there's nothing for
  // the browser's own gesture recognizer to compete with.
  const contentDragRef = useRef<{ lastY: number; mode: "undecided" | "scroll" | "resize" } | null>(null);

  useEffect(() => {
    const content = contentRef.current;
    if (!content || isDesktop) return;

    function onDown(e: PointerEvent) {
      contentDragRef.current = { lastY: e.clientY, mode: "undecided" };
    }

    function onMove(e: PointerEvent) {
      const cd = contentDragRef.current;
      if (!cd || !content) return;
      const deltaY = e.clientY - cd.lastY; // > 0: finger moved down since the last event
      cd.lastY = e.clientY;
      if (deltaY === 0) return;

      if (cd.mode === "undecided") {
        // Decided once, for the whole gesture, the moment direction is
        // known — not re-armed mid-gesture (e.g. scroll-then-reverse),
        // which keeps this simple and matches the brief's two plain
        // cases: scrolled to the top + dragging down collapses it;
        // anything else scrolls.
        if (deltaY < 0 || content.scrollTop > 0) {
          cd.mode = "scroll";
        } else {
          cd.mode = "resize";
          beginDrag(e.clientY);
          content.setPointerCapture?.(e.pointerId);
        }
      }

      if (cd.mode === "scroll") {
        content.scrollTop -= deltaY;
      } else {
        e.preventDefault();
        updateDrag(e.clientY);
      }
    }

    function onUp() {
      const wasResizing = contentDragRef.current?.mode === "resize";
      contentDragRef.current = null;
      if (wasResizing) endDrag();
    }

    content.addEventListener("pointerdown", onDown, { passive: true });
    content.addEventListener("pointermove", onMove, { passive: false });
    content.addEventListener("pointerup", onUp, { passive: true });
    content.addEventListener("pointercancel", onUp, { passive: true });
    return () => {
      content.removeEventListener("pointerdown", onDown);
      content.removeEventListener("pointermove", onMove);
      content.removeEventListener("pointerup", onUp);
      content.removeEventListener("pointercancel", onUp);
    };
  }, [isDesktop, beginDrag, updateDrag, endDrag]);

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
        aria-label={`Bottom sheet, currently ${snap}. Tap to toggle peek and half, or drag to resize.`}
        className="flex min-h-11 w-full shrink-0 touch-none items-center justify-center py-3"
      >
        <span className="h-1.5 w-10 rounded-full bg-grid-border" aria-hidden />
      </button>
      <div
        ref={contentRef}
        // touch-none (touch-action: none): the browser never starts its
        // own native scroll on this element — see the effect above for
        // why. overscroll-contain: belt-and-suspenders for the
        // manually-driven scrollTop assignment above — a drag/scroll
        // that reaches the content's own top or bottom edge stops there
        // instead of chaining to the map behind it or the browser's
        // pull-to-refresh, exactly the "fighting" the brief calls out.
        className="flex-1 touch-none overflow-y-auto overscroll-contain px-5 pb-6"
      >
        {children}
      </div>
    </div>
  );
}
