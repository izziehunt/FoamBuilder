export type SculptMode = "orbit" | "cinch" | "inflate";

export type StarterShape = "blank" | "figure" | "face";

export type ToolState = {
  mode: SculptMode;
  shape: StarterShape;
  brushRadius: number;
  brushStrength: number;
  shapeVersion: number;
};
