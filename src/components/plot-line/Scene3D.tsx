"use client";

// 3D view (v0): consumes the engine's existing output (BNG-metre
// polygons, same EngineOutput SiteCanvas/2D already renders) — nothing
// in src/engine is touched. Mounted/unmounted by the parent's 2D/3D
// toggle; while mounted, this Canvas stays up and only its geometry
// props update reactively as the live layout changes (drag, mix
// change), so switching candidates never flickers or re-homes the
// camera.
//
// No @react-three/drei: OrbitControls is imported directly from
// three/addons (shipped inside the `three` package itself, not a
// separate dependency) via a ~30-line wrapper below — simplest tool
// that works, per CLAUDE.md, for the one drei feature this view needs.

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { BNGPoint, BNGPolygon, LayoutResult } from "@/engine/types";
import { buildSceneGeometry } from "./scene3d/buildSceneGeometry";
import { captureGroundTexture } from "./scene3d/captureGroundTexture";
import { bngToScene, extentCenter, polygonExtent, type Extent, type SceneOrigin } from "./scene3d/coords";
import { GRID_CYAN, GRID_GREEN } from "./gridColors";

export interface Scene3DProps {
  boundary: BNGPolygon;
  entrance: BNGPoint | null;
  layout: LayoutResult | null;
  tightPlotIds: ReadonlySet<string>;
  /** Mirrors the 2D map's Dark/Light toggle — see mapFilter.ts. */
  dark: boolean;
}

interface CameraFrame {
  position: THREE.Vector3;
  target: THREE.Vector3;
  minDistance: number;
  maxDistance: number;
}

/**
 * What the camera should frame: the BUILT layout's own extent (every
 * plot's plotBng — driveway+footprint+garden, not just the house — plus
 * road rectangles) when one exists, not the raw drawn boundary. A site
 * boundary routinely has a lot of dead buffer space around a single
 * narrow development strip (boundary offsets, an odd site shape); a
 * camera framed to fit the WHOLE boundary would shrink the actual
 * houses to an imperceptible sliver on exactly that kind of site —
 * caught via a real-browser screenshot that showed nothing but a thin
 * line where the houses should have been visible as 3D massing. Falls
 * back to the boundary itself only when there's genuinely nothing built
 * yet (output not computed, or every candidate was infeasible).
 */
function layoutFocusExtent(layout: LayoutResult | null, boundary: BNGPolygon): Extent {
  const points: [number, number][] = [];
  for (const plot of layout?.plots ?? []) points.push(...plot.plotBng);
  for (const road of layout?.roads ?? []) points.push(...road.centerlineBng);
  if (points.length === 0) return polygonExtent(boundary);
  return polygonExtent(points);
}

function computeDefaultFrame(layout: LayoutResult | null, boundary: BNGPolygon, origin: SceneOrigin): CameraFrame {
  const focus = layoutFocusExtent(layout, boundary);
  const spanX = focus.maxX - focus.minX;
  const spanY = focus.maxY - focus.minY;
  const span = Math.max(spanX, spanY, 20);
  const distance = span * 1.3; // a bit more headroom than the ground-texture capture's padding, since the camera also needs room for roof height, not just plan footprint
  const elevation = THREE.MathUtils.degToRad(45); // "sensible default angle (about 45 degrees)" per the brief
  const [targetX, targetZ] = bngToScene([(focus.minX + focus.maxX) / 2, (focus.minY + focus.maxY) / 2], origin);
  const target = new THREE.Vector3(targetX, 0, targetZ);

  // Azimuth: look ACROSS the development's long axis, not along it — a
  // single straight road (v0's engine only ever builds one) running
  // the full length of a long, narrow site collapses to an
  // imperceptible sliver if the camera looks straight down its length.
  // This picks whichever of the two cardinal offsets (east/west vs
  // north/south of the target) is perpendicular to the longer BNG span,
  // which is a good v0 approximation for a roughly axis-aligned site —
  // not a general "face the actual road direction" solve (the engine's
  // road can run at any angle on a rotated boundary), flagged as a
  // refinement worth adding if a rotated site ever looks wrong the same
  // way. Caught the original bug via a real-browser screenshot showing
  // nothing but a thin line on a long north-south test site.
  const horizontalOffset = spanY > spanX ? new THREE.Vector3(distance * Math.cos(elevation), 0, 0) : new THREE.Vector3(0, 0, distance * Math.cos(elevation));

  return {
    position: target.clone().add(horizontalOffset).add(new THREE.Vector3(0, distance * Math.sin(elevation), 0)),
    target,
    minDistance: distance * 0.25,
    maxDistance: Math.max(distance * 4, polygonExtent(boundary).maxX - polygonExtent(boundary).minX), // never clamp zoom-out tighter than the full boundary, so the user can still pull back and see the whole site
  };
}

/** Thin R3F wrapper around three's own OrbitControls (orbit/pan/pinch-zoom all come for free from it on touch + mouse) — not a drei dependency. `resetSignal` re-applies `frame` on demand (the Reset button); `frame` itself is only read once, at mount, for initial position/limits. */
function Controls({ frame, resetSignal }: { frame: CameraFrame; resetSignal: number }) {
  const { camera, gl } = useThree();
  const controlsRef = useRef<OrbitControls | null>(null);

  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minPolarAngle = THREE.MathUtils.degToRad(8);
    controls.maxPolarAngle = THREE.MathUtils.degToRad(87); // stop just short of the horizon rather than letting the camera dip below ground
    controls.minDistance = frame.minDistance;
    controls.maxDistance = frame.maxDistance;
    camera.position.copy(frame.position);
    controls.target.copy(frame.target);
    controls.update();
    controlsRef.current = controls;
    return () => controls.dispose();
    // frame is read once here, at mount, as the initial camera pose —
    // the Reset button (resetSignal, handled below) is the deliberate,
    // explicit way back to it, not an automatic re-frame on every
    // boundary edit (which would yank the view out from under a user
    // mid-orbit). Same "read once at mount" pattern as OsMapBasemap's
    // centerBng/resolution.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, gl]);

  useEffect(() => {
    if (resetSignal === 0 || !controlsRef.current) return;
    camera.position.copy(frame.position);
    controlsRef.current.target.copy(frame.target);
    controlsRef.current.update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  useFrame(() => controlsRef.current?.update());
  return null;
}

function GroundPlane({ boundary, dark }: { boundary: BNGPolygon; dark: boolean }) {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  const [halfExtent, setHalfExtent] = useState<number>(50);

  useEffect(() => {
    let cancelled = false;
    // Deliberately does NOT reset texture to null first — the OLD
    // texture (if any) stays visible while the new one is fetched, so
    // re-drawing the boundary never flashes back to the untextured
    // fallback. The cleanup effect below disposes it at the exact
    // moment setTexture below swaps it out, not eagerly here.
    captureGroundTexture(boundary, dark).then((result) => {
      if (cancelled || !result) return;
      setHalfExtent(result.halfWidth);
      if (result.canvas) {
        const tex = new THREE.CanvasTexture(result.canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
        setTexture(tex);
      }
    });
    return () => {
      cancelled = true;
    };
    // Re-captures when the drawn site's shape changes (length + first
    // point as a cheap, good-enough signal — not on every live-layout
    // recompute while dragging/tweaking the mix) OR when the Dark/Light
    // toggle flips, since the baked-in filter needs redoing either way.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundary.length, boundary[0]?.[0], boundary[0]?.[1], dark]);

  // Disposes exactly the texture that was current for the PREVIOUS
  // render, right as it's replaced — ordinary effect-cleanup-on-change,
  // not a ref, so it doesn't trip the "no refs during render" rule
  // SceneContents' geometry disposal had to work around above.
  useEffect(() => () => texture?.dispose(), [texture]);

  const size = halfExtent * 2;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
      <planeGeometry args={[size, size]} />
      {texture ? (
        <meshBasicMaterial map={texture} color={dark ? "#9fb3c8" : "#ffffff"} />
      ) : (
        // No real key available locally (this session always runs with
        // a dummy key) or every tile failed to load — a plain theme-
        // matched slab rather than a blank/broken-looking floor.
        <meshBasicMaterial color={dark ? "#0c1130" : "#e9ecf2"} />
      )}
    </mesh>
  );
}

function SceneContents({ boundary, entrance, layout, tightPlotIds, origin, dark }: Scene3DProps & { origin: SceneOrigin }) {
  const sceneGeo = useMemo(
    () => buildSceneGeometry(layout, boundary, entrance, tightPlotIds, origin),
    [layout, boundary, entrance, tightPlotIds, origin]
  );

  // Ordinary effect-cleanup-on-change: this closure captures the
  // CURRENT sceneGeo: when a NEW one is computed above, React commits
  // the render that swaps every <mesh geometry={...}> over to it, then
  // runs this cleanup for the OLD sceneGeo — safely unreferenced by
  // then, never yanked out from under something still on screen.
  useEffect(() => {
    return () => {
      sceneGeo.homes?.dispose();
      sceneGeo.roads?.dispose();
      sceneGeo.gardens?.dispose();
    };
  }, [sceneGeo]);

  const homesMaterial = useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }), []);
  const roadsMaterial = useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }), []);
  const gardensMaterial = useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }), []);
  useEffect(
    () => () => {
      homesMaterial.dispose();
      roadsMaterial.dispose();
      gardensMaterial.dispose();
    },
    [homesMaterial, roadsMaterial, gardensMaterial]
  );

  const boundaryGeometry = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints(sceneGeo.boundaryPoints);
    return g;
  }, [sceneGeo.boundaryPoints]);
  useEffect(() => () => boundaryGeometry.dispose(), [boundaryGeometry]);

  const boundaryMaterial = useMemo(() => new THREE.LineBasicMaterial({ color: GRID_CYAN }), []);
  useEffect(() => () => boundaryMaterial.dispose(), [boundaryMaterial]);

  return (
    <>
      <GroundPlane boundary={boundary} dark={dark} />
      {sceneGeo.roads && <mesh geometry={sceneGeo.roads} material={roadsMaterial} />}
      {sceneGeo.gardens && <mesh geometry={sceneGeo.gardens} material={gardensMaterial} />}
      {sceneGeo.homes && <mesh geometry={sceneGeo.homes} material={homesMaterial} />}
      {sceneGeo.boundaryPoints.length > 0 && <primitive object={new THREE.Line(boundaryGeometry, boundaryMaterial)} />}
      {sceneGeo.entrancePosition && (
        <mesh position={sceneGeo.entrancePosition}>
          <sphereGeometry args={[1.2, 12, 12]} />
          <meshBasicMaterial color={GRID_GREEN} />
        </mesh>
      )}
    </>
  );
}

export function Scene3D({ boundary, entrance, layout, tightPlotIds, dark }: Scene3DProps) {
  const [resetSignal, setResetSignal] = useState(0);
  const hasSite = boundary.length >= 3;

  // Stable regardless of what the camera is doing — the coordinate
  // origin every geometry builder (homes/roads/gardens, the ground
  // plane, the camera frame below) converts BNG into scene-space
  // relative to. Always the DRAWN BOUNDARY's own centre, even though
  // the camera's look-at target can differ (see computeDefaultFrame) —
  // origin only needs to be a stable, sensible coordinate reference.
  const origin = useMemo<SceneOrigin>(() => extentCenter(polygonExtent(boundary)), [boundary]);

  // Only read once per MOUNT (the frame the camera starts at / the
  // frame "Reset" returns to) — see Controls' own comment for why this
  // deliberately doesn't track every boundary edit live.
  const initialFrame = useMemo(() => computeDefaultFrame(layout, boundary, origin), []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!hasSite) {
    return (
      <div
        className={`flex h-full w-full items-center justify-center px-6 text-center text-sm ${dark ? "bg-ink text-grid-muted" : "bg-[#e9ecf2] text-zinc-600"}`}
      >
        Draw a site boundary in 2D first, then switch back to 3D.
      </div>
    );
  }

  return (
    <div className={`relative h-full w-full touch-none ${dark ? "bg-ink" : "bg-[#e9ecf2]"}`}>
      {/*
        Mobile-first perf levers, applied up front rather than only as a
        reaction to a bad measurement: dpr capped at 1.5 (not the
        default device pixel ratio, which is 3 on many phones — fragment
        cost scales with pixel count, so an uncapped DPR is the single
        biggest avoidable cost here) and antialiasing off (meaningful
        fill-rate cost for a flat, low-poly, already-jaggy-by-design
        neon look that doesn't need smoothed edges to read well).
      */}
      <Canvas camera={{ fov: 50, near: 0.5, far: 5000 }} dpr={[1, 1.5]} gl={{ antialias: false }}>
        <Controls frame={initialFrame} resetSignal={resetSignal} />
        <SceneContents boundary={boundary} entrance={entrance} layout={layout} tightPlotIds={tightPlotIds} origin={origin} dark={dark} />
      </Canvas>
      <button
        type="button"
        onClick={() => setResetSignal((n) => n + 1)}
        className="absolute bottom-3 right-3 z-10 rounded-full border border-grid-border bg-sheet px-3 py-1.5 text-xs font-medium text-grid-text shadow-[0_0_16px_rgba(25,246,255,0.15)]"
      >
        Reset view
      </button>
    </div>
  );
}
