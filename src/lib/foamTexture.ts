import type { BufferAttribute } from "three";

/**
 * Procedural beauty-blender foam — dense organic latex pores with soft AO.
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

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;

      // Domain warp so cells feel organic, not a regular grid.
      const warpX = (fbm(u * 6.5 + 2.1, v * 6.5) - 0.5) * 0.045;
      const warpY = (fbm(u * 6.5, v * 6.5 + 4.7) - 0.5) * 0.045;
      const wu = u + warpX;
      const wv = v + warpY;

      // Open-cell latex: large bowls + mid cells + micro pits.
      const cell = worley(wu * 78, wv * 78);
      const mid = worley(wu * 140 + 9, wv * 140 + 3);
      const fine = worley(wu * 260 + 21, wv * 260 + 11);
      const micro = worley(wu * 420 + 41, wv * 420 + 7);
      const macro = fbm(u * 3.2, v * 3.2);

      // F2-F1 edge accent for soft cell walls (foam membrane look).
      const edge = worleyEdge(wu * 78, wv * 78);

      const pit = Math.pow(cell, 0.95);
      const midPit = Math.pow(mid, 1.15);
      const finePit = Math.pow(fine, 1.3);
      const microPit = Math.pow(micro, 1.5);

      let h = 0.8 + macro * 0.05;
      h -= pit * 0.38;
      h -= midPit * 0.14;
      h -= finePit * 0.09;
      h -= microPit * 0.05;
      // Soft raised membranes between pores.
      h += edge * 0.07;
      h += Math.pow(Math.max(0, 0.42 - cell), 2.1) * 0.06;

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

  // Classic nude beauty-blender latex — warm peach with cooler pore wells.
  const baseR = 246;
  const baseG = 210;
  const baseB = 192;
  const poreR = 186;
  const poreG = 138;
  const poreB = 124;
  const wallR = 252;
  const wallG = 228;
  const wallB = 214;
  const deepR = 168;
  const deepG = 118;
  const deepB = 108;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const h = height[y * size + x];
      const u = x / size;
      const v = y / size;
      const warpX = (fbm(u * 6.5 + 2.1, v * 6.5) - 0.5) * 0.045;
      const warpY = (fbm(u * 6.5, v * 6.5 + 4.7) - 0.5) * 0.045;
      const cell = worley((u + warpX) * 78, (v + warpY) * 78);
      const edge = worleyEdge((u + warpX) * 78, (v + warpY) * 78);
      const grain = hash2(x * 0.37, y * 0.41);
      const speck = hash2(x * 1.9 + 3, y * 2.3 + 8);

      const poreMix = THREE_Math_smoothstep(0.32, 0.82, 1 - h) * 0.9;
      const deepMix = THREE_Math_smoothstep(0.55, 0.92, 1 - h) * 0.45;
      const wallMix =
        THREE_Math_smoothstep(0.58, 0.95, h) * (0.25 + edge * 0.55) * 0.5;

      let r = lerp(baseR, poreR, poreMix);
      let g = lerp(baseG, poreG, poreMix);
      let b = lerp(baseB, poreB, poreMix);
      r = lerp(r, deepR, deepMix);
      g = lerp(g, deepG, deepMix);
      b = lerp(b, deepB, deepMix);
      r = lerp(r, wallR, wallMix);
      g = lerp(g, wallG, wallMix);
      b = lerp(b, wallB, wallMix);

      // Soft AO in pore bowls.
      const ao = 1 - THREE_Math_smoothstep(0.25, 0.75, 1 - h) * 0.22;
      r *= ao;
      g *= ao;
      b *= ao;

      // Fine latex grain + sparse darker speckles (real sponge flecks).
      const gAmt = (grain - 0.5) * 6.5;
      r = clamp(r + gAmt);
      g = clamp(g + gAmt * 0.88);
      b = clamp(b + gAmt * 0.78);
      if (speck > 0.985) {
        r = clamp(r * 0.88);
        g = clamp(g * 0.86);
        b = clamp(b * 0.84);
      }

      // Slight warmth variation across the surface.
      const warmth = (fbm(u * 2.5 + 1, v * 2.5) - 0.5) * 5;
      r = clamp(r + warmth);
      g = clamp(g + warmth * 0.35);
      b = clamp(b - warmth * 0.15);

      aImg.data[i] = r;
      aImg.data[i + 1] = g;
      aImg.data[i + 2] = b;
      aImg.data[i + 3] = 255;

      // Matte latex; pore wells slightly smoother / darker roughness.
      const rough = clamp(228 + h * 22 - poreMix * 18 + edge * 8);
      rImg.data[i] = rough;
      rImg.data[i + 1] = rough;
      rImg.data[i + 2] = rough;
      rImg.data[i + 3] = 255;
    }
  }

  actx.putImageData(aImg, 0, 0);
  rctx.putImageData(rImg, 0, 0);

  const normal = heightToNormalCanvas(height, size, 4.0);

  return { albedo, normal, roughness, height, size };
}

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

/** F2 − F1 — bright on cell walls, dark in centers. */
function worleyEdge(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let f1 = 2;
  let f2 = 2;
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const cx = xi + ox;
      const cy = yi + oy;
      const fx = cx + hash2(cx * 1.1, cy * 2.3);
      const fy = cy + hash2(cx * 3.7, cy * 1.9);
      const d = Math.hypot(fx - x, fy - y);
      if (d < f1) {
        f2 = f1;
        f1 = d;
      } else if (d < f2) {
        f2 = d;
      }
    }
  }
  return clamp01((f2 - f1) * 2.2);
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
