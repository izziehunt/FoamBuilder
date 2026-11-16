/** Procedural porous foam albedo (matte sponge look). */
export function createFoamAlbedoTexture(size = 512): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // Base foam — warm matte sponge, not pure white.
  ctx.fillStyle = "#efe6d8";
  ctx.fillRect(0, 0, size, size);

  const image = ctx.getImageData(0, 0, size, size);
  const data = image.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // Layered value noise for open-cell pores.
      const n1 = hash2(x * 0.08, y * 0.08);
      const n2 = hash2(x * 0.22 + 40, y * 0.22 + 11);
      const n3 = hash2(x * 0.55 + 7, y * 0.55 + 19);
      const pore = Math.pow(n1 * 0.55 + n2 * 0.3 + n3 * 0.15, 1.35);

      const shade = (pore - 0.45) * 38;
      data[i] = clamp(data[i] + shade * 0.85 - pore * 12);
      data[i + 1] = clamp(data[i + 1] + shade * 0.75 - pore * 10);
      data[i + 2] = clamp(data[i + 2] + shade * 0.55 - pore * 8);
    }
  }

  ctx.putImageData(image, 0, 0);

  // Soft larger cell pits.
  for (let k = 0; k < 1400; k++) {
    const px = Math.random() * size;
    const py = Math.random() * size;
    const r = 0.6 + Math.random() * 2.8;
    const g = ctx.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, "rgba(120, 100, 80, 0.18)");
    g.addColorStop(1, "rgba(120, 100, 80, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas;
}

function hash2(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function clamp(v: number) {
  return Math.max(0, Math.min(255, v | 0));
}
