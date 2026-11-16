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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shape, shapeVersion],
  );

  const adjacency = useMemo(() => buildAdjacency(geometry), [geometry]);

  const material = useMemo(() => {
    const maps = createFoamTextures(1024);
    const repeat = new THREE.Vector2(5.5, 5.5);

    const map = new THREE.CanvasTexture(maps.albedo);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.copy(repeat);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;

    const normalMap = new THREE.CanvasTexture(maps.normal);
    normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
    normalMap.repeat.copy(repeat);
    normalMap.anisotropy = 8;

    const roughnessMap = new THREE.CanvasTexture(maps.roughness);
    roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
    roughnessMap.repeat.copy(repeat);

    const mat = new THREE.MeshPhysicalMaterial({
      map,
      normalMap,
      normalScale: new THREE.Vector2(0.75, 0.75),
      roughnessMap,
      // Pale foam tint — multiply with albedo toward the photo.
      color: new THREE.Color("#f3e6c8"),
      roughness: 0.98,
      metalness: 0,
      // Hint of soft subsurface so thick foam doesn’t look plastic.
      sheen: 0.18,
      sheenRoughness: 1,
      sheenColor: new THREE.Color("#f0dfb8"),
      clearcoat: 0,
      envMapIntensity: 0.15,
      flatShading: false,
    });

    // Gentle pore cavity shading — keep it light like the reference.
    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        /* glsl */ `
        #include <map_fragment>
        float poreLuma = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        diffuseColor.rgb = mix(
          diffuseColor.rgb * 0.9,
          diffuseColor.rgb,
          smoothstep(0.42, 0.7, poreLuma)
        );
        `,
      );
    };
    mat.customProgramCacheKey = () => "foam-photo-match-v1";

    return mat;
  }, []);

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

  const recomputeNormals = useCallback(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.geometry.computeVertexNormals();
    mesh.geometry.getAttribute("normal").needsUpdate = true;
    mesh.geometry.computeBoundingSphere();
  }, []);

  const sculptAtPointer = useCallback(
    (clientX: number, clientY: number, isDrag: boolean) => {
      const mesh = meshRef.current;
      if (!mesh || mode === "orbit") return;

      const now = performance.now();
      if (isDrag && now - lastSculptMs.current < 24) return;
      lastSculptMs.current = now;

      const rect = gl.domElement.getBoundingClientRect();
      pointerNdc.current.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.current.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.current.setFromCamera(pointerNdc.current, camera);
      const hits = raycaster.current.intersectObject(mesh, false);
      if (!hits.length) return;

      worldHit.current.copy(hits[0].point);
      invMatrix.current.copy(mesh.matrixWorld).invert();
      hitLocal.current.copy(worldHit.current).applyMatrix4(invMatrix.current);

      const pos = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
      const nrm = mesh.geometry.getAttribute("normal") as THREE.BufferAttribute;

      if (mode === "cinch") {
        dragLocal.current.copy(
          isDrag
            ? hitLocal.current.clone().sub(lastHit.current)
            : new THREE.Vector3(),
        );
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
          opacity={0.28}
          side={THREE.DoubleSide}
          depthTest={false}
        />
      </mesh>
    </mesh>
  );
}
