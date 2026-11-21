import type { BufferAttribute } from "three";

/**
 * Procedural open-cell foam maps matched to beauty-blender / upholstery references:
 * light membrane webbing around darker recessed pores, fine grain, soft AO.
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
  const cellField = new Float32Array(size * size);
  const edgeField = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const idx = y * size + x;

      // Organic warp so cells aren't a grid.
      const warpX = (fbm(u * 5.5 + 1.7, v * 5.5) - 0.5) * 0.055;
      const warpY = (fbm(u * 5.5, v * 5.5 + 3.1) - 0.5) * 0.055;
      const wu = u + warpX;
      const wv = v + warpY;

      // Primary open cells (visible pore bowls) + finer secondary foam.
      const cell = worley(wu * 92, wv * 92);
      const edge = worleyEdge(wu * 92, wv * 92);
      const mid = worley(wu * 168 + 11, wv * 168 + 4);
      const midEdge = worleyEdge(wu * 168 + 11, wv * 168 + 4);
      const fine = worley(wu * 310 + 23, wv * 310 + 13);
      const micro = worley(wu * 520 + 47, wv * 520 + 9);
      const macro = fbm(u * 2.8, v * 2.8);

      cellField[idx] = cell;
      edgeField[idx] = edge;

      // Deep rounded pits with raised latex membranes between them.
      const pit = Math.pow(cell, 0.88);
      const midPit = Math.pow(mid, 1.05);
      const finePit = Math.pow(fine, 1.25);
      const microPit = Math.pow(micro, 1.45);

      let h = 0.82 + macro * 0.04;
      h -= pit * 0.48;
      h -= midPit * 0.18;
      h -= finePit * 0.1;
      h -= microPit * 0.055;
      // Bright webbing / cell walls (the light ridges in the reference).
      h += edge * 0.14;
      h += midEdge * 0.05;
      // Soft lip around each pore bowl.
      h += Math.pow(Math.max(0, 0.38 - cell), 1.8) * 0.09;

      height[idx] = clamp01(h);
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

  // Neutral luminance — material.color supplies the sponge hue.
  // Strong wall/pore contrast like the reference open-cell foam.
  const wallLum = 250;
  const baseLum = 232;
  const poreLum = 148;
  const deepLum = 112;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const idx = y * size + x;
      const h = height[idx];
      const cell = cellField[idx];
      const edge = edgeField[idx];
      const u = x / size;
      const v = y / size;
      const grain = hash2(x * 0.37, y * 0.41);
      const speck = hash2(x * 2.1 + 3, y * 2.7 + 8);

      const poreMix = smoothstep(0.28, 0.78, 1 - h);
      const deepMix = smoothstep(0.5, 0.9, 1 - h) * 0.7;
      const wallMix = smoothstep(0.55, 0.96, h) * (0.35 + edge * 0.85);

      let lum = lerp(baseLum, poreLum, poreMix * 0.95);
      lum = lerp(lum, deepLum, deepMix);
      lum = lerp(lum, wallLum, wallMix * 0.7);

      // Pore-well AO — darker bowls like the reference.
      const ao = 1 - smoothstep(0.2, 0.72, 1 - h) * 0.34;
      // Extra darkening near cell centers.
      const centerDark = 1 - Math.pow(Math.max(0, 0.55 - cell), 1.4) * 0.2;
      lum *= ao * centerDark;

      // Fine sand-like grain across the latex.
      const gAmt = (grain - 0.5) * 8;
      lum = clamp(lum + gAmt);
      if (speck > 0.982) lum = clamp(lum * 0.86);

      const soft = (fbm(u * 3.2 + 1, v * 3.2) - 0.5) * 5;
      lum = clamp(lum + soft);

      aImg.data[i] = lum;
      aImg.data[i + 1] = lum;
      aImg.data[i + 2] = lum;
      aImg.data[i + 3] = 255;

      // Dead matte; walls tiny bit rougher, deep pores slightly less.
      const rough = clamp(242 + edge * 10 - poreMix * 10 + h * 6);
      rImg.data[i] = rough;
      rImg.data[i + 1] = rough;
      rImg.data[i + 2] = rough;
      rImg.data[i + 3] = 255;
    }
  }

  actx.putImageData(aImg, 0, 0);
  rctx.putImageData(rImg, 0, 0);

  // Stronger normals so pores read as recessed open cells, not flat noise.
  const normal = heightToNormalCanvas(height, size, 5.2);

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
  return clamp01((f2 - f1) * 2.4);
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

function smoothstep(min: number, max: number, x: number) {
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
