"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { createStarterGeometry } from "@/lib/shapes";
import {
  applyCinch,
  applyInflate,
  buildAdjacency,
} from "@/lib/sculpt";
import { createFoamTextures } from "@/lib/foamTexture";
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
  const dragLocal = useRef(new THREE.Vector3());
  const worldHit = useRef(new THREE.Vector3());
  const invMatrix = useRef(new THREE.Matrix4());
  const raycaster = useRef(new THREE.Raycaster());
  const pointerNdc = useRef(new THREE.Vector2());
  const lastSculptMs = useRef(0);

  const { camera, gl } = useThree();

  const geometry = useMemo(
    () => createStarterGeometry(shape),
    // Recreate when user picks a new starter or hits Reset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shape, shapeVersion],
  );

  const adjacency = useMemo(() => buildAdjacency(geometry), [geometry]);

  const material = useMemo(() => {
    const { albedo, bump } = createFoamTextures(512);
    const map = new THREE.CanvasTexture(albedo);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(3.2, 3.2);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;

    const bumpMap = new THREE.CanvasTexture(bump);
    bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
    bumpMap.repeat.set(3.2, 3.2);
    bumpMap.anisotropy = 8;

    return new THREE.MeshPhysicalMaterial({
      map,
      bumpMap,
      bumpScale: 0.045,
      color: new THREE.Color("#f0e6d6"),
      roughness: 0.92,
      metalness: 0.0,
      sheen: 0.35,
      sheenRoughness: 0.85,
      sheenColor: new THREE.Color("#efe4d2"),
      clearcoat: 0.04,
      clearcoatRoughness: 1,
      flatShading: false,
    });
  }, []);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  useEffect(() => {
    return () => {
      material.map?.dispose();
      material.bumpMap?.dispose();
      material.dispose();
    };
  }, [material]);

  const recomputeNormals = useCallback(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const geo = mesh.geometry;
    geo.computeVertexNormals();
    const nAttr = geo.getAttribute("normal");
    if (nAttr) nAttr.needsUpdate = true;
    geo.computeBoundingSphere();
  }, []);

  const sculptAtPointer = useCallback(
    (clientX: number, clientY: number, isDrag: boolean) => {
      const mesh = meshRef.current;
      if (!mesh || mode === "orbit") return;

      // Cap sculpt rate so fast pointer events don't shatter the mesh.
      const now = performance.now();
      if (isDrag && now - lastSculptMs.current < 22) return;
      lastSculptMs.current = now;

      const rect = gl.domElement.getBoundingClientRect();
      pointerNdc.current.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.current.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.current.setFromCamera(pointerNdc.current, camera);
      const hits = raycaster.current.intersectObject(mesh, false);
      if (!hits.length) return;

      const hit = hits[0];
      worldHit.current.copy(hit.point);
      invMatrix.current.copy(mesh.matrixWorld).invert();
      hitLocal.current.copy(worldHit.current).applyMatrix4(invMatrix.current);

      const geo = mesh.geometry;
      const pos = geo.getAttribute("position") as THREE.BufferAttribute;
      const nrm = geo.getAttribute("normal") as THREE.BufferAttribute;

      if (mode === "cinch") {
        if (isDrag) {
          dragLocal.current.subVectors(hitLocal.current, lastHit.current);
        } else {
          dragLocal.current.set(0, 0, 0);
        }
        applyCinch(
          pos,
          nrm,
          hitLocal.current,
          dragLocal.current,
          brushRadius,
          brushStrength,
          adjacency,
        );
      } else if (mode === "inflate") {
        applyInflate(
          pos,
          nrm,
          hitLocal.current,
          brushRadius,
          brushStrength,
          adjacency,
        );
      }

      lastHit.current.copy(hitLocal.current);
      recomputeNormals();
    },
    [
      adjacency,
      brushRadius,
      brushStrength,
      camera,
      gl.domElement,
      mode,
      recomputeNormals,
    ],
  );

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (mode === "orbit") return;
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    sculpting.current = true;
    lastSculptMs.current = 0;
    sculptAtPointer(e.clientX, e.clientY, false);
  };

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!sculpting.current || mode === "orbit") return;
    e.stopPropagation();
    sculptAtPointer(e.clientX, e.clientY, true);
  };

  const onPointerUp = (e: ThreeEvent<PointerEvent>) => {
    sculpting.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  useFrame((_, dt) => {
    const mesh = meshRef.current;
    if (!mesh || sculpting.current || mode !== "orbit") return;
    mesh.rotation.y += dt * 0.05;
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
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <mesh ref={ringRef} visible={false} renderOrder={10}>
        <ringGeometry args={[0.92, 1, 48]} />
        <meshBasicMaterial
          color="#5c4a3a"
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
          depthTest={false}
        />
      </mesh>
    </mesh>
  );
}
