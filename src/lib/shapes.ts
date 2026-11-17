import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { applyFoamMicroRelief } from "@/lib/foamTexture";
import type { StarterShape } from "@/lib/types";

function softBlob(
  p: THREE.Vector3,
  center: THREE.Vector3,
  radius: number,
  amount: number,
) {
  const d = p.distanceTo(center) / radius;
  if (d >= 1) return 0;
  const falloff = 1 - d * d * (3 - 2 * d);
  return falloff * amount;
}

/**
 * Remap a sharp-box vertex onto a soft rounded foam block.
 */
function roundBoxVertex(
  p: THREE.Vector3,
  half: THREE.Vector3,
  radius: number,
  target: THREE.Vector3,
) {
  const ax = Math.abs(p.x);
  const ay = Math.abs(p.y);
  const az = Math.abs(p.z);
  const hx = half.x - radius;
  const hy = half.y - radius;
  const hz = half.z - radius;

  let nx = 0;
  let ny = 0;
  let nz = 0;
  if (ax > hx) nx = ax - hx;
  if (ay > hy) ny = ay - hy;
  if (az > hz) nz = az - hz;

  const len = Math.hypot(nx, ny, nz);
  if (len > 1e-8) {
    const s = radius / len;
    target.set(
      Math.sign(p.x || 1) * (Math.min(ax, hx) + nx * s),
      Math.sign(p.y || 1) * (Math.min(ay, hy) + ny * s),
      Math.sign(p.z || 1) * (Math.min(az, hz) + nz * s),
    );
  } else {
    target.copy(p);
  }
  return target;
}

/**
 * Vertical rectangular foam sponge — one solid welded mesh (no face cracks).
 */
export function createStarterGeometry(shape: StarterShape): THREE.BufferGeometry {
  const width = 1.05;
  const height = 2.05;
  const depth = 0.62;
  const half = new THREE.Vector3(width / 2, height / 2, depth / 2);
  const cornerRadius = 0.09;

  let geo: THREE.BufferGeometry = new THREE.BoxGeometry(
    width,
    height,
    depth,
    56,
    110,
    36,
  );

  // CRITICAL: BoxGeometry stores separate verts per face (different UVs/normals).
  // mergeVertices only welds when *all* attributes match, so strip UVs/normals
  // first or edge seams stay open and look like cracks when sculpting.
  geo.deleteAttribute("normal");
  geo.deleteAttribute("uv");
  geo = mergeVertices(geo, 1e-3);

  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const rounded = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    roundBoxVertex(v, half, cornerRadius, rounded);

    // Tiny cut-foam irregularity (same for shared verts — no splitting).
    const wobble =
      0.006 * Math.sin(rounded.x * 7.2 + rounded.y * 3.1) +
      0.005 * Math.cos(rounded.z * 6.4 - rounded.x * 2.2);
    const len = rounded.length() || 1;
    rounded.multiplyScalar(1 + wobble / len);

    if (shape === "face") {
      let push = 0;
      push += softBlob(rounded, new THREE.Vector3(0.22, 0.55, half.z), 0.28, 0.045);
      push += softBlob(rounded, new THREE.Vector3(-0.22, 0.55, half.z), 0.28, 0.045);
      push -= softBlob(rounded, new THREE.Vector3(0.16, 0.62, half.z), 0.1, 0.02);
      push -= softBlob(rounded, new THREE.Vector3(-0.16, 0.62, half.z), 0.1, 0.02);
      push += softBlob(rounded, new THREE.Vector3(0, 0.35, half.z), 0.14, 0.025);
      push += softBlob(rounded, new THREE.Vector3(0, 0.15, half.z * 0.9), 0.35, 0.02);
      rounded.z += push;
    } else if (shape === "figure") {
      const waist = softBlob(rounded, new THREE.Vector3(0, 0.05, 0), 0.55, 1);
      rounded.x *= 1 - waist * 0.06;
      rounded.z *= 1 - waist * 0.04;
      const legs = softBlob(rounded, new THREE.Vector3(0, -0.7, half.z * 0.3), 0.45, 1);
      if (Math.abs(rounded.x) < 0.12) {
        rounded.z -= legs * 0.04;
        rounded.x *= 1 + legs * 0.08;
      }
      const shoulders = softBlob(rounded, new THREE.Vector3(0, 0.55, 0), 0.5, 1);
      rounded.x *= 1 + shoulders * 0.035;
    }

    pos.setXYZ(i, rounded.x, rounded.y, rounded.z);
  }
  pos.needsUpdate = true;

  // Fit in frame.
  geo.computeBoundingBox();
  const box = geo.boundingBox!;
  const center = new THREE.Vector3();
  box.getCenter(center);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = 1.7 / maxDim;

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    v.sub(center).multiplyScalar(scale);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;

  // Continuous planar UVs — no hard face switches that read as cracks in the normal map.
  const uvs = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    uvs[i * 2] = v.x * 0.72 + 0.5;
    uvs[i * 2 + 1] = v.y * 0.72 + 0.5;
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));

  geo.computeVertexNormals();
  applyFoamMicroRelief(
    geo.getAttribute("position") as THREE.BufferAttribute,
    geo.getAttribute("normal") as THREE.BufferAttribute,
    0.008,
  );
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}
