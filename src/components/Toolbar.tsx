"use client";

import type { SculptMode } from "@/lib/types";

type ToolbarProps = {
  mode: SculptMode;
  brushRadius: number;
  brushStrength: number;
  foamColor: string;
  bgColor: string;
  onMode: (mode: SculptMode) => void;
  onBrushRadius: (v: number) => void;
  onBrushStrength: (v: number) => void;
  onFoamColor: (v: string) => void;
  onBgColor: (v: string) => void;
  onReset: () => void;
};

const modes: { id: SculptMode; label: string; hint: string }[] = [
  { id: "orbit", label: "Rotate", hint: "Drag to orbit" },
  { id: "cinch", label: "Cinch", hint: "Hold + drag to fold the sponge" },
  { id: "inflate", label: "Inflate", hint: "Hold to bloat the foam" },
];

export function Toolbar({
  mode,
  brushRadius,
  brushStrength,
  foamColor,
  bgColor,
  onMode,
  onBrushRadius,
  onBrushStrength,
  onFoamColor,
  onBgColor,
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

      <div className="color-row" role="group" aria-label="Colors">
        <label className="color-field">
          <span>Sponge</span>
          <input
            type="color"
            value={foamColor}
            onChange={(e) => onFoamColor(e.target.value)}
            aria-label="Beauty blender color"
          />
        </label>
        <label className="color-field">
          <span>Background</span>
          <input
            type="color"
            value={bgColor}
            onChange={(e) => onBgColor(e.target.value)}
            aria-label="Background color"
          />
        </label>
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
