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
 * Remap a sharp-box vertex onto a soft rounded foam block
 * (like cut upholstery foam — square, but never razor-edged).
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
 * Vertical rectangular foam sponge — the greeting shape users fold into bodies.
 */
export function createStarterGeometry(shape: StarterShape): THREE.BufferGeometry {
  // Tall foam slab proportions (like a cushion foam block on end).
  const width = 1.05;
  const height = 2.05;
  const depth = 0.62;
  const half = new THREE.Vector3(width / 2, height / 2, depth / 2);
  const cornerRadius = 0.09;

  // Dense segments so cinch folds stay soft.
  let geo: THREE.BufferGeometry = new THREE.BoxGeometry(
    width,
    height,
    depth,
    56,
    110,
    36,
  );

  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const rounded = new THREE.Vector3();
  const n = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    roundBoxVertex(v, half, cornerRadius, rounded);

    // Tiny cut-foam irregularity — not a blob.
    const wobble =
      0.006 * Math.sin(rounded.x * 7.2 + rounded.y * 3.1) +
      0.005 * Math.cos(rounded.z * 6.4 - rounded.x * 2.2);
    n.copy(rounded).normalize();
    rounded.addScaledVector(n, wobble);

    if (shape === "face") {
      // Very light face suggestion on the front of the same slab.
      let push = 0;
      push += softBlob(rounded, new THREE.Vector3(0.22, 0.55, half.z), 0.28, 0.045);
      push += softBlob(rounded, new THREE.Vector3(-0.22, 0.55, half.z), 0.28, 0.045);
      push -= softBlob(rounded, new THREE.Vector3(0.16, 0.62, half.z), 0.1, 0.02);
      push -= softBlob(rounded, new THREE.Vector3(-0.16, 0.62, half.z), 0.1, 0.02);
      push += softBlob(rounded, new THREE.Vector3(0, 0.35, half.z), 0.14, 0.025);
      push += softBlob(rounded, new THREE.Vector3(0, 0.15, half.z * 0.9), 0.35, 0.02);
      rounded.z += push;
    } else if (shape === "figure") {
      // Barely-there torso fold hints — still clearly a foam block.
      const waist = softBlob(rounded, new THREE.Vector3(0, 0.05, 0), 0.55, 1);
      rounded.x *= 1 - waist * 0.06;
      rounded.z *= 1 - waist * 0.04;
      // Soft leg split suggestion at the bottom front.
      const legs = softBlob(rounded, new THREE.Vector3(0, -0.7, half.z * 0.3), 0.45, 1);
      if (Math.abs(rounded.x) < 0.12) {
        rounded.z -= legs * 0.04;
        rounded.x *= 1 + legs * 0.08;
      }
      // Shoulder width hint.
      const shoulders = softBlob(rounded, new THREE.Vector3(0, 0.55, 0), 0.5, 1);
      rounded.x *= 1 + shoulders * 0.035;
    }

    pos.setXYZ(i, rounded.x, rounded.y, rounded.z);
  }

  pos.needsUpdate = true;

  geo.deleteAttribute("normal");
  geo = mergeVertices(geo, 1e-4);

  // Fit in frame, keep vertical emphasis.
  const weldedPos = geo.attributes.position as THREE.BufferAttribute;
  geo.computeBoundingBox();
  const box = geo.boundingBox!;
  const center = new THREE.Vector3();
  box.getCenter(center);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = 1.7 / maxDim;

  for (let i = 0; i < weldedPos.count; i++) {
    v.fromBufferAttribute(weldedPos, i);
    v.sub(center).multiplyScalar(scale);
    weldedPos.setXYZ(i, v.x, v.y, v.z);
  }
  weldedPos.needsUpdate = true;

  // Box-friendly UVs (better foam tiling than spherical).
  const uvs = new Float32Array(weldedPos.count * 2);
  for (let i = 0; i < weldedPos.count; i++) {
    v.fromBufferAttribute(weldedPos, i);
    // Triplanar-ish blend for stable pores on a slab.
    const ax = Math.abs(v.x);
    const ay = Math.abs(v.y);
    const az = Math.abs(v.z);
    if (ay >= ax && ay >= az) {
      uvs[i * 2] = v.x * 0.55 + 0.5;
      uvs[i * 2 + 1] = v.z * 0.55 + 0.5;
    } else if (ax >= az) {
      uvs[i * 2] = v.z * 0.55 + 0.5;
      uvs[i * 2 + 1] = v.y * 0.55 + 0.5;
    } else {
      uvs[i * 2] = v.x * 0.55 + 0.5;
      uvs[i * 2 + 1] = v.y * 0.55 + 0.5;
    }
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
