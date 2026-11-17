import type { BufferAttribute } from "three";

/**
 * Procedural beauty-blender foam maps — fine latex pores, soft matte nude.
 */

export type FoamMaps = {
  albedo: HTMLCanvasElement;
  normal: HTMLCanvasElement;
  roughness: HTMLCanvasElement;
  height: Float32Array;
  size: number;
};

export function createFoamTextures(size = 1024): FoamMaps {
  const height = new Float32Array(size * size);

  // Dense, fine open cells like latex makeup sponge (not coarse upholstery foam).
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;

      const cell = worley(u * 96, v * 96);
      const fine = worley(u * 210 + 17, v * 210 + 9);
      const soft = worley(u * 48 + 3, v * 48 + 11);
      const macro = fbm(u * 3.5, v * 3.5);

      // Shallow rounded pits — velvety, not cracked walls.
      const pit = Math.pow(cell, 1.15);
      const micro = Math.pow(fine, 1.45);
      const mid = Math.pow(soft, 1.25);
      let h = 0.72 + macro * 0.045;
      h -= pit * 0.22;
      h -= mid * 0.08;
      h -= micro * 0.07;
      // Soft pore lips instead of sharp voronoi ridges.
      h += Math.pow(1 - cell, 2.2) * 0.03;

      height[y * size + x] = clamp01(h);
    }
  }

  const albedo = document.createElement("canvas");
  albedo.width = size;
  albedo.height = size;
  const actx = albedo.getContext("2d")!;
  const aImg = actx.createImageData(size, size);

  const roughness = document.createElement("canvas");
  roughness.width = size;
  roughness.height = size;
  const rctx = roughness.getContext("2d")!;
  const rImg = rctx.createImageData(size, size);

  // Classic beauty-blender nude — soft peachy cream latex.
  const baseR = 242;
  const baseG = 214;
  const baseB = 196;
  const poreR = 220;
  const poreG = 178;
  const poreB = 158;
  const wallR = 248;
  const wallG = 226;
  const wallB = 210;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const h = height[y * size + x];
      const cell = worley((x / size) * 96, (y / size) * 96);
      const grain = hash2(x * 0.37, y * 0.41);

      const poreMix = THREE_Math_smoothstep(0.48, 0.88, 1 - h) * 0.55;
      const wallMix = THREE_Math_smoothstep(0.7, 0.98, h) * (1 - cell) * 0.22;

      let r = lerp(baseR, poreR, poreMix);
      let g = lerp(baseG, poreG, poreMix);
      let b = lerp(baseB, poreB, poreMix);
      r = lerp(r, wallR, wallMix);
      g = lerp(g, wallG, wallMix);
      b = lerp(b, wallB, wallMix);

      // Fine latex grain — very low contrast.
      const gAmt = (grain - 0.5) * 5.5;
      r = clamp(r + gAmt);
      g = clamp(g + gAmt * 0.9);
      b = clamp(b + gAmt * 0.82);

      aImg.data[i] = r;
      aImg.data[i + 1] = g;
      aImg.data[i + 2] = b;
      aImg.data[i + 3] = 255;

      // Evenly matte sponge; pores only a touch smoother.
      const rough = clamp(238 + h * 12 - poreMix * 8);
      rImg.data[i] = rough;
      rImg.data[i + 1] = rough;
      rImg.data[i + 2] = rough;
      rImg.data[i + 3] = 255;
    }
  }

  actx.putImageData(aImg, 0, 0);
  rctx.putImageData(rImg, 0, 0);

  // Gentle normals so pores read soft, not cracked.
  const normal = heightToNormalCanvas(height, size, 2.4);

  return { albedo, normal, roughness, height, size };
}

/** Optional: bake micro pore relief into mesh normals via slight position jitter. */
export function applyFoamMicroRelief(
  positions: BufferAttribute,
  normals: BufferAttribute,
  amount = 0.012,
) {
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    const nx = normals.getX(i);
    const ny = normals.getY(i);
    const nz = normals.getZ(i);
    const n =
      worley3(x * 9.5, y * 9.5, z * 9.5) * 0.65 +
      worley3(x * 22 + 4, y * 22, z * 22 + 2) * 0.35;
    const displace = (0.55 - n) * amount;
    positions.setXYZ(i, x + nx * displace, y + ny * displace, z + nz * displace);
  }
  positions.needsUpdate = true;
}

function heightToNormalCanvas(
  height: Float32Array,
  size: number,
  strength: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(size, size);

  const at = (x: number, y: number) => {
    const xx = ((x % size) + size) % size;
    const yy = ((y % size) + size) % size;
    return height[yy * size + xx];
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      let nx = -dx;
      let ny = -dy;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;

      const i = (y * size + x) * 4;
      img.data[i] = clamp((nx * 0.5 + 0.5) * 255);
      img.data[i + 1] = clamp((ny * 0.5 + 0.5) * 255);
      img.data[i + 2] = clamp((nz * 0.5 + 0.5) * 255);
      img.data[i + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  return canvas;
}

// --- noise helpers ---

function hash2(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function hash3(x: number, y: number, z: number) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
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
  for (let i = 0; i < 5; i++) {
    v += a * valueNoise(x * f, y * f);
    a *= 0.5;
    f *= 2;
  }
  return v;
}

function worley(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let minD = 1;
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const cx = xi + ox;
      const cy = yi + oy;
      const fx = cx + hash2(cx * 1.1, cy * 2.3);
      const fy = cy + hash2(cx * 3.7, cy * 1.9);
      const d = Math.hypot(fx - x, fy - y);
      if (d < minD) minD = d;
    }
  }
  return clamp01(minD);
}

function worley3(x: number, y: number, z: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  let minD = 1;
  for (let oz = -1; oz <= 1; oz++) {
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const cx = xi + ox;
        const cy = yi + oy;
        const cz = zi + oz;
        const fx = cx + hash3(cx, cy, cz);
        const fy = cy + hash3(cx + 19, cy + 3, cz + 7);
        const fz = cz + hash3(cx + 5, cy + 11, cz + 23);
        const d = Math.hypot(fx - x, fy - y, fz - z);
        if (d < minD) minD = d;
      }
    }
  }
  return clamp01(minD);
}

function THREE_Math_smoothstep(min: number, max: number, x: number) {
  const t = clamp01((x - min) / (max - min));
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function clamp(v: number) {
  return Math.max(0, Math.min(255, v | 0));
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}
