"use client";

import { Canvas } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import { Suspense } from "react";
import { FoamMesh } from "./FoamMesh";
import type { SculptMode, StarterShape } from "@/lib/types";

type FoamSceneProps = {
  mode: SculptMode;
  shape: StarterShape;
  shapeVersion: number;
  brushRadius: number;
  brushStrength: number;
};

export function FoamScene({
  mode,
  shape,
  shapeVersion,
  brushRadius,
  brushStrength,
}: FoamSceneProps) {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 0.35, 3.4], fov: 42, near: 0.1, far: 50 }}
      gl={{ antialias: true, toneMappingExposure: 1.05 }}
      dpr={[1, 2]}
      style={{ touchAction: "none" }}
    >
      <color attach="background" args={["#d4c6b4"]} />
      <fog attach="fog" args={["#d4c6b4", 10, 22]} />

      {/* Soft studio light — reveals pore texture without plastic shine. */}
      <hemisphereLight args={["#fff5e6", "#9a8568", 0.95]} />
      <directionalLight
        castShadow
        position={[3.2, 5.8, 2.4]}
        intensity={1.2}
        color="#ffe9c8"
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={0.5}
        shadow-camera-far={20}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
      />
      <directionalLight position={[-2.8, 1.8, -2]} intensity={0.45} color="#f0d4a8" />
      <directionalLight position={[0.5, -1.5, 3]} intensity={0.25} color="#cbb896" />

      <Suspense fallback={null}>
        <FoamMesh
          mode={mode}
          shape={shape}
          shapeVersion={shapeVersion}
          brushRadius={brushRadius}
          brushStrength={brushStrength}
        />
        <ContactShadows
          position={[0, -1.35, 0]}
          opacity={0.4}
          scale={8}
          blur={2.8}
          far={3.5}
          color="#6b5a48"
        />
      </Suspense>

      <OrbitControls
        makeDefault
        enabled={mode === "orbit"}
        enablePan={false}
        minDistance={2}
        maxDistance={6}
        maxPolarAngle={Math.PI * 0.92}
        target={[0, 0, 0]}
      />
    </Canvas>
  );
}
