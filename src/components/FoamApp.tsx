"use client";

import { useState } from "react";
import { FoamCanvas } from "./FoamCanvas";
import { Toolbar } from "./Toolbar";
import type { SculptMode, StarterShape } from "@/lib/types";

export function FoamApp() {
  const [mode, setMode] = useState<SculptMode>("cinch");
  const [shape, setShape] = useState<StarterShape>("figure");
  const [shapeVersion, setShapeVersion] = useState(0);
  const [brushRadius, setBrushRadius] = useState(0.38);
  const [brushStrength, setBrushStrength] = useState(0.55);

  return (
    <div className="foam-app">
      <FoamCanvas
        mode={mode}
        shape={shape}
        shapeVersion={shapeVersion}
        brushRadius={brushRadius}
        brushStrength={brushStrength}
      />
      <Toolbar
        mode={mode}
        shape={shape}
        brushRadius={brushRadius}
        brushStrength={brushStrength}
        onMode={setMode}
        onShape={(next) => {
          setShape(next);
          setShapeVersion((v) => v + 1);
        }}
        onBrushRadius={setBrushRadius}
        onBrushStrength={setBrushStrength}
        onReset={() => setShapeVersion((v) => v + 1)}
      />
    </div>
  );
}
