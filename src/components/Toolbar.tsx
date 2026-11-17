"use client";

import type { SculptMode, StarterShape } from "@/lib/types";

type ToolbarProps = {
  mode: SculptMode;
  shape: StarterShape;
  brushRadius: number;
  brushStrength: number;
  onMode: (mode: SculptMode) => void;
  onShape: (shape: StarterShape) => void;
  onBrushRadius: (v: number) => void;
  onBrushStrength: (v: number) => void;
  onReset: () => void;
};

const modes: { id: SculptMode; label: string; hint: string }[] = [
  { id: "orbit", label: "Rotate", hint: "Drag to orbit" },
  { id: "cinch", label: "Cinch", hint: "Hold + drag to fold the sponge" },
  { id: "inflate", label: "Inflate", hint: "Hold to bloat the foam" },
];

const shapes: { id: StarterShape; label: string }[] = [
  { id: "blank", label: "Beauty blender" },
  { id: "face", label: "Face hint" },
  { id: "figure", label: "Body hint" },
];

export function Toolbar({
  mode,
  shape,
  brushRadius,
  brushStrength,
  onMode,
  onShape,
  onBrushRadius,
  onBrushStrength,
  onReset,
}: ToolbarProps) {
  const activeHint = modes.find((m) => m.id === mode)?.hint ?? "";

  return (
    <div className="toolbar">
      <div className="toolbar-brand">
        <p className="brand-mark">FoamBuilder</p>
        <p className="brand-hint">{activeHint}</p>
      </div>

      <div className="toolbar-group" role="group" aria-label="Sculpt mode">
        {modes.map((m) => (
          <button
            key={m.id}
            type="button"
            className={mode === m.id ? "tool active" : "tool"}
            onClick={() => onMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="toolbar-group" role="group" aria-label="Starter shape">
        {shapes.map((s) => (
          <button
            key={s.id}
            type="button"
            className={shape === s.id ? "tool active" : "tool"}
            onClick={() => onShape(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <label className="slider">
        <span>Brush size</span>
        <input
          type="range"
          min={0.12}
          max={0.85}
          step={0.01}
          value={brushRadius}
          onChange={(e) => onBrushRadius(Number(e.target.value))}
        />
      </label>

      <label className="slider">
        <span>Strength</span>
        <input
          type="range"
          min={0.15}
          max={1}
          step={0.01}
          value={brushStrength}
          onChange={(e) => onBrushStrength(Number(e.target.value))}
        />
      </label>

      <button type="button" className="tool reset" onClick={onReset}>
        Reset shape
      </button>
    </div>
  );
}
