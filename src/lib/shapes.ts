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
 * Weld by position only so Lathe seam verts share one vertex.
 * (mergeVertices keeps UV seams open → sculpt tears the mesh.)
 */
function weldByPosition(
  geometry: THREE.BufferGeometry,
  tolerance = 1e-4,
): THREE.BufferGeometry {
  const pos = geometry.getAttribute("position") as THREE.BufferAttribute;
  const index = geometry.getIndex();
  const inv = 1 / tolerance;
  const keyToNew = new Map<string, number>();
  const newPos: number[] = [];
  const remap = new Int32Array(pos.count);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const key = `${Math.round(x * inv)},${Math.round(y * inv)},${Math.round(z * inv)}`;
    let ni = keyToNew.get(key);
    if (ni === undefined) {
      ni = newPos.length / 3;
      keyToNew.set(key, ni);
      newPos.push(x, y, z);
    }
    remap[i] = ni;
  }

  const newIndex: number[] = [];
  if (index) {
    for (let i = 0; i < index.count; i++) {
      newIndex.push(remap[index.getX(i)]);
    }
  } else {
    for (let i = 0; i < pos.count; i++) {
      newIndex.push(remap[i]);
    }
  }

  const welded = new THREE.BufferGeometry();
  welded.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(newPos, 3),
  );
  welded.setIndex(newIndex);
  geometry.dispose();
  return welded;
}

/**
 * Makeup beauty blender — one continuous lathed silhouette, welded for sculpt.
 */
export function createStarterGeometry(shape: StarterShape): THREE.BufferGeometry {
  const height = 1.7;
  const segments = 128;
  const radial = 96;

  // Single convex Bézier: round bottom → belly → cohesive soft tip (no separate cap).
  const silhouette = new THREE.CubicBezierCurve(
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(1.08, 0.06),
    new THREE.Vector2(0.5, 0.68),
    new THREE.Vector2(0.0, 1.0),
  );

  const profile: THREE.Vector2[] = [];
  for (let i = 0; i <= segments; i++) {
    const p = silhouette.getPoint(i / segments);
    profile.push(new THREE.Vector2(Math.max(p.x, 0), p.y * height));
  }

  let geo: THREE.BufferGeometry = new THREE.LatheGeometry(profile, radial);
  geo = weldByPosition(geo, 1e-4);

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
  const fit = 1.32 / maxDim;

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    v.sub(center).multiplyScalar(fit);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;

  // Spherical UVs after weld (avoid lathe UV seam fighting the weld).
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
