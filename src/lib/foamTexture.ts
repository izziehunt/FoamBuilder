/** Procedural porous foam albedo + matching bump (matte open-cell sponge). */
export function createFoamTextures(size = 512): {
  albedo: HTMLCanvasElement;
  bump: HTMLCanvasElement;
} {
  const albedo = document.createElement("canvas");
  albedo.width = size;
  albedo.height = size;
  const actx = albedo.getContext("2d")!;

  // Warm sponge base — like upholstery foam.
  actx.fillStyle = "#e8dcc8";
  actx.fillRect(0, 0, size, size);

  const image = actx.getImageData(0, 0, size, size);
  const data = image.data;
  const bumpData = new Uint8ClampedArray(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const n1 = hash2(x * 0.07, y * 0.07);
      const n2 = hash2(x * 0.19 + 40, y * 0.19 + 11);
      const n3 = hash2(x * 0.48 + 7, y * 0.48 + 19);
      const n4 = hash2(x * 1.1 + 3, y * 1.1 + 9);
      const pore = Math.pow(n1 * 0.4 + n2 * 0.3 + n3 * 0.2 + n4 * 0.1, 1.25);

      // Soft cell variation — avoid harsh white speckles that look like cracks.
      const shade = (pore - 0.5) * 28;
      data[i] = clamp(232 + shade - pore * 18);
      data[i + 1] = clamp(220 + shade * 0.9 - pore * 14);
      data[i + 2] = clamp(200 + shade * 0.65 - pore * 10);
      data[i + 3] = 255;

      const b = clamp(140 + pore * 90);
      bumpData[i] = b;
      bumpData[i + 1] = b;
      bumpData[i + 2] = b;
      bumpData[i + 3] = 255;
    }
  }

  actx.putImageData(image, 0, 0);

  // Soft larger open cells (subtle pits, not speckles).
  for (let k = 0; k < 900; k++) {
    const px = Math.random() * size;
    const py = Math.random() * size;
    const r = 1.2 + Math.random() * 3.5;
    const g = actx.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, "rgba(110, 90, 70, 0.14)");
    g.addColorStop(1, "rgba(110, 90, 70, 0)");
    actx.fillStyle = g;
    actx.beginPath();
    actx.arc(px, py, r, 0, Math.PI * 2);
    actx.fill();
  }

  const bump = document.createElement("canvas");
  bump.width = size;
  bump.height = size;
  const bctx = bump.getContext("2d")!;
  bctx.putImageData(new ImageData(bumpData, size, size), 0, 0);

  // Soften bump pits.
  for (let k = 0; k < 700; k++) {
    const px = Math.random() * size;
    const py = Math.random() * size;
    const r = 1 + Math.random() * 3;
    const g = bctx.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, "rgba(40, 40, 40, 0.35)");
    g.addColorStop(1, "rgba(40, 40, 40, 0)");
    bctx.fillStyle = g;
    bctx.beginPath();
    bctx.arc(px, py, r, 0, Math.PI * 2);
    bctx.fill();
  }

  return { albedo, bump };
}

function hash2(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function clamp(v: number) {
  return Math.max(0, Math.min(255, v | 0));
}
