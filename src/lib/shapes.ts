import * as THREE from "three";
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
 * Single smooth pear curve — round near the bottom, continuous taper, soft tip.
 * No keyframes (those caused the horizontal ridges).
 */
function blenderRadius(u: number) {
  const t = THREE.MathUtils.clamp(u, 0, 1);
  // Classic smooth pear/teardrop of revolution.
  // sqrt-ish start ⇒ round bottom; (1-t)^p ⇒ gentle upper taper.
  const belly = Math.pow(t, 0.52) * Math.pow(1 - t, 0.78);
  const tip = 0.036 * Math.pow(t, 2.8); // softly blunt tip, never needle-sharp
  return 1.62 * belly + tip;
}

/**
 * Makeup beauty blender — lathed from a smooth 2D silhouette (no bumpy rings).
 */
export function createStarterGeometry(shape: StarterShape): THREE.BufferGeometry {
  const height = 1.7;
  const segments = 96; // profile samples
  const radial = 128; // smooth around

  const profile: THREE.Vector2[] = [];
  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    profile.push(new THREE.Vector2(blenderRadius(u), u * height));
  }

  // Lathe = clean surface of revolution (indexed, smooth).
  let geo: THREE.BufferGeometry = new THREE.LatheGeometry(profile, radial);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();

  // Optional light face/body hints (keep subtle so the sponge stays blender-shaped).
  if (shape !== "blank") {
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      if (shape === "face") {
        let push = 0;
        push += softBlob(v, new THREE.Vector3(0.2, 1.05, 0.3), 0.26, 0.04);
        push += softBlob(v, new THREE.Vector3(-0.2, 1.05, 0.3), 0.26, 0.04);
        push -= softBlob(v, new THREE.Vector3(0.12, 1.12, 0.36), 0.09, 0.018);
        push -= softBlob(v, new THREE.Vector3(-0.12, 1.12, 0.36), 0.09, 0.018);
        push += softBlob(v, new THREE.Vector3(0, 0.9, 0.38), 0.12, 0.022);
        v.z += push;
      } else {
        const waist = softBlob(v, new THREE.Vector3(0, 0.85, 0), 0.42, 1);
        v.x *= 1 - waist * 0.06;
        v.z *= 1 - waist * 0.04;
        const legs = softBlob(v, new THREE.Vector3(0, 0.25, 0.12), 0.38, 1);
        if (Math.abs(v.x) < 0.12) {
          v.z -= legs * 0.028;
          v.x *= 1 + legs * 0.08;
        }
        const shoulders = softBlob(v, new THREE.Vector3(0, 1.15, 0), 0.38, 1);
        v.x *= 1 + shoulders * 0.035;
      }
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    pos.needsUpdate = true;
  }

  // Fit in frame.
  geo.computeBoundingBox();
  const box = geo.boundingBox!;
  const center = new THREE.Vector3();
  box.getCenter(center);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const fit = 1.65 / maxDim;

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    v.sub(center).multiplyScalar(fit);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;

  // Stable UVs for the foam texture.
  const uvs = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = v.clone().normalize();
    uvs[i * 2] = 0.5 + Math.atan2(n.z, n.x) / (Math.PI * 2);
    uvs[i * 2 + 1] =
      0.5 + Math.asin(THREE.MathUtils.clamp(n.y, -1, 1)) / Math.PI;
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));

  geo.computeVertexNormals();
  // No micro-displacement relief — that was adding extra bumpy noise.
  geo.computeBoundingSphere();
  return geo;
}
