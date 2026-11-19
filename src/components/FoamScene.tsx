"use client";

import { Canvas } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  OrbitControls,
} from "@react-three/drei";
import { Suspense, useLayoutEffect, useRef } from "react";
import type { Group } from "three";
import { FoamMesh } from "./FoamMesh";
import type { SculptMode } from "@/lib/types";

/** Contact shadow plane must not eat pointer hits on the sponge bottom. */
function StudioShadows() {
  const ref = useRef<Group>(null);
  useLayoutEffect(() => {
    ref.current?.traverse((obj) => {
      obj.raycast = () => {};
    });
  }, []);
  return (
    <ContactShadows
      ref={ref}
      position={[0, -1.35, 0]}
      opacity={0.28}
      scale={12}
      blur={3.4}
      far={5}
      color="#8a847c"
    />
  );
}

type FoamSceneProps = {
  mode: SculptMode;
  shapeVersion: number;
  brushRadius: number;
  brushStrength: number;
  foamColor: string;
  bgColor: string;
};

export function FoamScene({
  mode,
  shapeVersion,
  brushRadius,
  brushStrength,
  foamColor,
  bgColor,
}: FoamSceneProps) {
  return (
    <Canvas
      shadows
      camera={{ position: [0.95, 0.25, 2.7], fov: 38, near: 0.1, far: 50 }}
      gl={{
        antialias: true,
        toneMappingExposure: 1.15,
        preserveDrawingBuffer: true,
      }}
      dpr={[1, 2]}
      style={{ touchAction: "none" }}
    >
      <color attach="background" args={[bgColor]} />

      <ambientLight intensity={0.55} color="#ffffff" />
      <hemisphereLight args={["#ffffff", "#e8e4de", 0.65]} />
      <directionalLight
        castShadow
        position={[4, 7, 3]}
        intensity={1.35}
        color="#ffffff"
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0002}
        shadow-camera-near={0.5}
        shadow-camera-far={20}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
      />
      <directionalLight position={[-3.5, 3, -2]} intensity={0.4} color="#f5f2ec" />
      <directionalLight position={[0, 2, 4]} intensity={0.35} color="#ffffff" />

      <FoamMesh
        mode={mode}
        shapeVersion={shapeVersion}
        brushRadius={brushRadius}
        brushStrength={brushStrength}
        foamColor={foamColor}
      />
      <StudioShadows />
      <Suspense fallback={null}>
        <Environment preset="studio" environmentIntensity={0.28} />
      </Suspense>

      <OrbitControls
        makeDefault
        enabled={mode === "orbit"}
        enablePan={false}
        minDistance={2}
        maxDistance={6}
        maxPolarAngle={Math.PI * 0.92}
        target={[0, 0.05, 0]}
      />
    </Canvas>
  );
}
