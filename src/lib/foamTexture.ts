/** Soft open-cell foam albedo + gentle bump (no crack-like speckles). */
export function createFoamTextures(size = 512): {
  albedo: HTMLCanvasElement;
  bump: HTMLCanvasElement;
} {
  const albedo = document.createElement("canvas");
  albedo.width = size;
  albedo.height = size;
  const ctx = albedo.getContext("2d")!;

  // Upholstery-foam base.
  const base = ctx.createLinearGradient(0, 0, size, size);
  base.addColorStop(0, "#efe4d4");
  base.addColorStop(1, "#e2d3be");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  const img = ctx.getImageData(0, 0, size, size);
  const data = img.data;
  const bumpPixels = new Uint8ClampedArray(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // Low-contrast cell noise — reads as pores, not cracks.
      const a = fbm(x * 0.045, y * 0.045);
      const b = fbm(x * 0.11 + 8, y * 0.11 + 3);
      const pore = a * 0.65 + b * 0.35;

      const shade = (pore - 0.5) * 16;
      data[i] = clamp(236 + shade);
      data[i + 1] = clamp(226 + shade * 0.92);
      data[i + 2] = clamp(208 + shade * 0.7);
      data[i + 3] = 255;

      const h = clamp(155 + pore * 55);
      bumpPixels[i] = h;
      bumpPixels[i + 1] = h;
      bumpPixels[i + 2] = h;
      bumpPixels[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Soft cell pits.
  for (let k = 0; k < 700; k++) {
    const px = Math.random() * size;
    const py = Math.random() * size;
    const r = 1.4 + Math.random() * 4;
    const g = ctx.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, "rgba(120, 100, 78, 0.1)");
    g.addColorStop(1, "rgba(120, 100, 78, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const bump = document.createElement("canvas");
  bump.width = size;
  bump.height = size;
  const bctx = bump.getContext("2d")!;
  bctx.putImageData(new ImageData(bumpPixels, size, size), 0, 0);
  bctx.filter = "blur(0.6px)";
  bctx.drawImage(bump, 0, 0);

  return { albedo, bump };
}

function hash2(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function valueNoise(x: number, y: number) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0);
  const b = hash2(x0 + 1, y0);
  const c = hash2(x0, y0 + 1);
  const d = hash2(x0 + 1, y0 + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(x: number, y: number) {
  let v = 0;
  let a = 0.5;
  let f = 1;
  for (let i = 0; i < 4; i++) {
    v += a * valueNoise(x * f, y * f);
    a *= 0.5;
    f *= 2;
  }
  return v;
}

function clamp(v: number) {
  return Math.max(0, Math.min(255, v | 0));
}
