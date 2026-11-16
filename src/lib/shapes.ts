import * as THREE from "three";
import type { StarterShape } from "@/lib/types";

function smoothStep(edge0: number, edge1: number, x: number) {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

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

/** Build a high-res foam starter mesh as a BufferGeometry. */
export function createStarterGeometry(shape: StarterShape): THREE.BufferGeometry {
  const detail = 5;
  const geo = new THREE.IcosahedronGeometry(1, detail);

  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    n.copy(v).normalize();

    if (shape === "blank") {
      // Soft irregular sponge — barely uneven, no figure hint.
      const wobble =
        0.04 * Math.sin(v.x * 3.1 + v.y * 2.4) +
        0.03 * Math.cos(v.z * 2.7 - v.x * 1.8) +
        0.02 * Math.sin(v.y * 4.2 + v.z * 3.3);
      v.copy(n).multiplyScalar(1 + wobble);
    } else if (shape === "face") {
      // Round foam head with soft cheek / brow / jaw suggestions.
      let r = 1.05;
      r += softBlob(v, new THREE.Vector3(0.32, 0.12, 0.72), 0.42, 0.14);
      r += softBlob(v, new THREE.Vector3(-0.32, 0.12, 0.72), 0.42, 0.14);
      r += softBlob(v, new THREE.Vector3(0, 0.42, 0.68), 0.5, 0.08);
      r -= softBlob(v, new THREE.Vector3(0.22, 0.22, 0.9), 0.18, 0.06);
      r -= softBlob(v, new THREE.Vector3(-0.22, 0.22, 0.9), 0.18, 0.06);
      r += softBlob(v, new THREE.Vector3(0, -0.05, 0.95), 0.16, 0.05);
      r += softBlob(v, new THREE.Vector3(0, -0.55, 0.55), 0.45, 0.1);
      r *= 1 + 0.02 * Math.sin(v.x * 5 + v.y * 3);
      v.copy(n).multiplyScalar(r);
    } else {
      // Hinted figure: soft head + torso + stubby limbs, still one foam piece.
      const y = v.y;
      let r = 0.72;

      // Torso core
      const torso = smoothStep(-0.55, 0.15, y) * smoothStep(0.85, 0.25, y);
      r += torso * 0.28;
      r += softBlob(v, new THREE.Vector3(0, 0.05, 0.15), 0.7, 0.18);

      // Head
      r += softBlob(v, new THREE.Vector3(0, 0.95, 0.05), 0.42, 0.38);

      // Shoulders / hips
      r += softBlob(v, new THREE.Vector3(0.45, 0.35, 0), 0.35, 0.16);
      r += softBlob(v, new THREE.Vector3(-0.45, 0.35, 0), 0.35, 0.16);
      r += softBlob(v, new THREE.Vector3(0.28, -0.35, 0.05), 0.32, 0.12);
      r += softBlob(v, new THREE.Vector3(-0.28, -0.35, 0.05), 0.32, 0.12);

      // Arm stubs
      r += softBlob(v, new THREE.Vector3(0.7, 0.15, 0), 0.28, 0.2);
      r += softBlob(v, new THREE.Vector3(-0.7, 0.15, 0), 0.28, 0.2);

      // Leg stubs
      r += softBlob(v, new THREE.Vector3(0.22, -0.85, 0.05), 0.32, 0.22);
      r += softBlob(v, new THREE.Vector3(-0.22, -0.85, 0.05), 0.32, 0.22);

      // Belly hint
      r += softBlob(v, new THREE.Vector3(0, -0.05, 0.35), 0.4, 0.1);

      r *= 1 + 0.015 * Math.sin(v.x * 4.2 + v.z * 3.1);
      v.copy(n).multiplyScalar(r);
    }

    pos.setXYZ(i, v.x, v.y, v.z);
  }

  geo.computeVertexNormals();
  // Center and normalize scale a bit so all starters fill the frame similarly.
  geo.computeBoundingBox();
  const box = geo.boundingBox!;
  const center = new THREE.Vector3();
  box.getCenter(center);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = 1.55 / maxDim;

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    v.sub(center).multiplyScalar(scale);
    pos.setXYZ(i, v.x, v.y, v.z);
  }

  pos.needsUpdate = true;

  // Spherical UVs so the porous foam map wraps the blob.
  const uvs = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    uvs[i * 2] = 0.5 + Math.atan2(v.z, v.x) / (Math.PI * 2);
    uvs[i * 2 + 1] = 0.5 + Math.asin(THREE.MathUtils.clamp(v.y, -1, 1)) / Math.PI;
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));

  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}
