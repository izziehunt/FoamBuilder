"use client";

import dynamic from "next/dynamic";
import type { SculptMode, StarterShape } from "@/lib/types";

const FoamScene = dynamic(
  () => import("./FoamScene").then((m) => m.FoamScene),
  {
    ssr: false,
    loading: () => (
      <div className="foam-loading">
        <span>Warming the foam…</span>
      </div>
    ),
  },
);

type FoamCanvasProps = {
  mode: SculptMode;
  shape: StarterShape;
  shapeVersion: number;
  brushRadius: number;
  brushStrength: number;
};

export function FoamCanvas(props: FoamCanvasProps) {
  return (
    <div className="foam-canvas">
      <FoamScene {...props} />
    </div>
  );
}
