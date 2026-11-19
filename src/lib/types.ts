export type SculptMode = "orbit" | "cinch" | "inflate";

export type ToolState = {
  mode: SculptMode;
  brushRadius: number;
  brushStrength: number;
  shapeVersion: number;
  foamColor: string;
  bgColor: string;
};
