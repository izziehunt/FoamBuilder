"use client";

import { useState } from "react";
import { FoamCanvas } from "./FoamCanvas";
import { Toolbar } from "./Toolbar";
import type { SculptMode } from "@/lib/types";

export function FoamApp() {
  const [mode, setMode] = useState<SculptMode>("cinch");
  const [shapeVersion, setShapeVersion] = useState(0);
  const [brushRadius, setBrushRadius] = useState(0.52);
  const [brushStrength, setBrushStrength] = useState(0.45);
  const [foamColor, setFoamColor] = useState("#f3d0c2");
  const [bgColor, setBgColor] = useState("#ffffff");

  return (
    <div className="foam-app" style={{ ["--foam-studio" as string]: bgColor }}>
      <FoamCanvas
        mode={mode}
        shapeVersion={shapeVersion}
        brushRadius={brushRadius}
        brushStrength={brushStrength}
        foamColor={foamColor}
        bgColor={bgColor}
      />
      <Toolbar
        mode={mode}
        brushRadius={brushRadius}
        brushStrength={brushStrength}
        foamColor={foamColor}
        bgColor={bgColor}
        onMode={setMode}
        onBrushRadius={setBrushRadius}
        onBrushStrength={setBrushStrength}
        onFoamColor={setFoamColor}
        onBgColor={setBgColor}
        onReset={() => setShapeVersion((v) => v + 1)}
      />
    </div>
  );
}
