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
      gl={{ antialias: true, toneMappingExposure: 1.12 }}
      dpr={[1, 2]}
      style={{ touchAction: "none" }}
    >
      <color attach="background" args={["#d9cfc2"]} />
      <fog attach="fog" args={["#d9cfc2", 10, 22]} />

      {/* Soft wrap lighting so foam reads round, not faceted. */}
      <hemisphereLight args={["#fffaf2", "#c4b49a", 1.05]} />
      <directionalLight
        castShadow
        position={[2.8, 5.5, 3.2]}
        intensity={1.05}
        color="#fff6ea"
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={0.5}
        shadow-camera-far={20}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
      />
      <directionalLight position={[-3, 2.2, -1.5]} intensity={0.55} color="#ffe8d2" />
      <directionalLight position={[0, -2, 2]} intensity={0.2} color="#d9cfc2" />

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
