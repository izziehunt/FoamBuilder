"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { createStarterGeometry } from "@/lib/shapes";
import {
  applyCinch,
  applyInflate,
  buildAdjacency,
  copyDragDelta,
  dragScratch,
} from "@/lib/sculpt";
import { createFoamMaterial } from "@/lib/foamMaterial";
import type { SculptMode, StarterShape } from "@/lib/types";

type FoamMeshProps = {
  mode: SculptMode;
  shape: StarterShape;
  shapeVersion: number;
  brushRadius: number;
  brushStrength: number;
};

export function FoamMesh({
  mode,
  shape,
  shapeVersion,
  brushRadius,
  brushStrength,
}: FoamMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const sculpting = useRef(false);
  const lastHit = useRef(new THREE.Vector3());
  const hitLocal = useRef(new THREE.Vector3());
  const worldHit = useRef(new THREE.Vector3());
  const invMatrix = useRef(new THREE.Matrix4());
  const raycaster = useRef(new THREE.Raycaster());
  const pointerNdc = useRef(new THREE.Vector2());
  const lastSculptMs = useRef(0);
  const normalStroke = useRef(0);
  const pendingPointer = useRef<{ x: number; y: number; isDrag: boolean } | null>(
    null,
  );
  const rafId = useRef(0);
  const modeRef = useRef(mode);
  const brushRadiusRef = useRef(brushRadius);
  const brushStrengthRef = useRef(brushStrength);
  modeRef.current = mode;
  brushRadiusRef.current = brushRadius;
  brushStrengthRef.current = brushStrength;

  const { camera, gl } = useThree();

  const geometry = useMemo(
    () => createStarterGeometry(shape),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shape, shapeVersion],
  );

  const adjacency = useMemo(() => buildAdjacency(geometry), [geometry]);
  const adjacencyRef = useRef(adjacency);
  adjacencyRef.current = adjacency;

  const material = useMemo(() => createFoamMaterial(), []);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(
    () => () => {
      material.map?.dispose();
      material.normalMap?.dispose();
      material.roughnessMap?.dispose();
      material.dispose();
    },
    [material],
  );

  const recomputeNormals = useCallback((full = true) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.geometry.computeVertexNormals();
    mesh.geometry.getAttribute("normal").needsUpdate = true;
    if (full) mesh.geometry.computeBoundingSphere();
  }, []);

  const sculptAtPointer = useCallback(
    (clientX: number, clientY: number, isDrag: boolean) => {
      const mesh = meshRef.current;
      const currentMode = modeRef.current;
      if (!mesh || currentMode === "orbit") return false;

      const now = performance.now();
      // ~30Hz brush — normals are the expensive bit; coalesce below.
      if (isDrag && now - lastSculptMs.current < 32) return true;
      lastSculptMs.current = now;

      const rect = gl.domElement.getBoundingClientRect();
      pointerNdc.current.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.current.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.current.setFromCamera(pointerNdc.current, camera);
      const hits = raycaster.current.intersectObject(mesh, false);
      if (!hits.length) return false;

      worldHit.current.copy(hits[0].point);
      invMatrix.current.copy(mesh.matrixWorld).invert();
      hitLocal.current.copy(worldHit.current).applyMatrix4(invMatrix.current);

      const pos = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
      const nrm = mesh.geometry.getAttribute("normal") as THREE.BufferAttribute;
      const radius = brushRadiusRef.current;
      const strength = brushStrengthRef.current;
      const adj = adjacencyRef.current;

      if (currentMode === "cinch") {
        applyCinch(
          pos,
          nrm,
          hitLocal.current,
          copyDragDelta(dragScratch, hitLocal.current, lastHit.current, isDrag),
          radius,
          strength,
          adj,
        );
      } else if (currentMode === "inflate") {
        applyInflate(pos, nrm, hitLocal.current, radius, strength, adj);
      }

      lastHit.current.copy(hitLocal.current);

      // Full normals every 3rd stroke while dragging; always on press.
      normalStroke.current += 1;
      if (!isDrag || normalStroke.current % 3 === 0) {
        recomputeNormals(false);
      }
      return true;
    },
    [camera, gl.domElement, recomputeNormals],
  );

  const flushPending = useCallback(() => {
    rafId.current = 0;
    const p = pendingPointer.current;
    if (!p) return;
    pendingPointer.current = null;
    sculptAtPointer(p.x, p.y, p.isDrag);
  }, [sculptAtPointer]);

  const queueSculpt = useCallback(
    (clientX: number, clientY: number, isDrag: boolean) => {
      pendingPointer.current = { x: clientX, y: clientY, isDrag };
      if (rafId.current) return;
      rafId.current = requestAnimationFrame(flushPending);
    },
    [flushPending],
  );

  useEffect(() => {
    const el = gl.domElement;

    const onDown = (e: PointerEvent) => {
      if (modeRef.current === "orbit" || e.button !== 0) return;
      lastSculptMs.current = 0;
      normalStroke.current = 0;
      // Immediate first hit (no rAF delay on press).
      const hit = sculptAtPointer(e.clientX, e.clientY, false);
      if (!hit) return;
      sculpting.current = true;
      el.setPointerCapture(e.pointerId);
    };

    const onMove = (e: PointerEvent) => {
      if (!sculpting.current || modeRef.current === "orbit") return;
      queueSculpt(e.clientX, e.clientY, true);
    };

    const onUp = (e: PointerEvent) => {
      if (!sculpting.current) return;
      sculpting.current = false;
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
        rafId.current = 0;
      }
      pendingPointer.current = null;
      // Final normals + bounds after the stroke.
      recomputeNormals(true);
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [gl.domElement, queueSculpt, recomputeNormals, sculptAtPointer]);

  useFrame((_, dt) => {
    const mesh = meshRef.current;
    if (!mesh || sculpting.current || mode !== "orbit") return;
    mesh.rotation.y += dt * 0.04;
  });

  const ringRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const ring = ringRef.current;
    if (!ring) return;
    ring.visible = mode !== "orbit" && sculpting.current;
    if (!ring.visible) return;
    ring.position.copy(lastHit.current);
    ring.scale.setScalar(brushRadius);
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      castShadow
      receiveShadow
    >
      <mesh
        ref={ringRef}
        visible={false}
        renderOrder={10}
        raycast={() => null}
      >
        <ringGeometry args={[0.92, 1, 48]} />
        <meshBasicMaterial
          color="#5c4a3a"
          transparent
          opacity={0.28}
          side={THREE.DoubleSide}
          depthTest={false}
        />
      </mesh>
    </mesh>
  );
}
