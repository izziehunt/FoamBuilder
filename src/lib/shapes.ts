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
 * Makeup beauty blender — lathed from one convex Bézier silhouette.
 * Convex control points ⇒ no overshoot ⇒ no horizontal ridges.
 */
export function createStarterGeometry(shape: StarterShape): THREE.BufferGeometry {
  const height = 1.7;
  const segments = 128;
  const radial = 160;

  // (radius, height) — round bottom, full belly, soft tip. All y increasing.
  const silhouette = new THREE.CubicBezierCurve(
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(1.18, 0.06),
    new THREE.Vector2(0.92, 0.58),
    new THREE.Vector2(0.05, 1.0),
  );

  const profile: THREE.Vector2[] = [];
  for (let i = 0; i <= segments; i++) {
    const p = silhouette.getPoint(i / segments);
    profile.push(new THREE.Vector2(Math.max(p.x, 0), p.y * height));
  }

  let geo: THREE.BufferGeometry = new THREE.LatheGeometry(profile, radial);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();

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
  geo.computeBoundingSphere();
  return geo;
}
