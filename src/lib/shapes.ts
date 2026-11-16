import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
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

/**
 * Dense indexed foam mesh. (Recent Three.js icospheres are sparse +
 * non-indexed, which made sculpting tear faces apart.)
 */
export function createStarterGeometry(shape: StarterShape): THREE.BufferGeometry {
  // ~18k triangles — smooth enough for soft folds, still interactive.
  let geo: THREE.BufferGeometry = new THREE.SphereGeometry(1, 96, 96);

  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    n.copy(v).normalize();

    if (shape === "blank") {
      const wobble =
        0.012 * Math.sin(v.x * 2.2 + v.y * 1.6) +
        0.01 * Math.cos(v.z * 1.9 - v.x * 1.3);
      v.copy(n).multiplyScalar(1 + wobble);
    } else if (shape === "face") {
      let r = 1.02;
      r += softBlob(v, new THREE.Vector3(0.34, 0.1, 0.7), 0.45, 0.12);
      r += softBlob(v, new THREE.Vector3(-0.34, 0.1, 0.7), 0.45, 0.12);
      r += softBlob(v, new THREE.Vector3(0, 0.4, 0.65), 0.5, 0.07);
      r -= softBlob(v, new THREE.Vector3(0.2, 0.2, 0.92), 0.16, 0.045);
      r -= softBlob(v, new THREE.Vector3(-0.2, 0.2, 0.92), 0.16, 0.045);
      r += softBlob(v, new THREE.Vector3(0, -0.02, 0.96), 0.14, 0.04);
      r += softBlob(v, new THREE.Vector3(0, -0.5, 0.55), 0.48, 0.09);
      v.copy(n).multiplyScalar(r);
    } else {
      let r = 0.78;
      const y = v.y;
      const torso = smoothStep(-0.55, 0.15, y) * smoothStep(0.85, 0.25, y);
      r += torso * 0.22;
      r += softBlob(v, new THREE.Vector3(0, 0.05, 0.12), 0.72, 0.16);
      r += softBlob(v, new THREE.Vector3(0, 0.95, 0.04), 0.4, 0.34);
      r += softBlob(v, new THREE.Vector3(0.48, 0.32, 0), 0.34, 0.14);
      r += softBlob(v, new THREE.Vector3(-0.48, 0.32, 0), 0.34, 0.14);
      r += softBlob(v, new THREE.Vector3(0.28, -0.35, 0.04), 0.3, 0.1);
      r += softBlob(v, new THREE.Vector3(-0.28, -0.35, 0.04), 0.3, 0.1);
      r += softBlob(v, new THREE.Vector3(0.68, 0.12, 0), 0.26, 0.16);
      r += softBlob(v, new THREE.Vector3(-0.68, 0.12, 0), 0.26, 0.16);
      r += softBlob(v, new THREE.Vector3(0.22, -0.85, 0.04), 0.3, 0.2);
      r += softBlob(v, new THREE.Vector3(-0.22, -0.85, 0.04), 0.3, 0.2);
      r += softBlob(v, new THREE.Vector3(0, -0.05, 0.35), 0.42, 0.09);
      v.copy(n).multiplyScalar(r);
    }

    pos.setXYZ(i, v.x, v.y, v.z);
  }

  pos.needsUpdate = true;

  // Weld any coincident verts and guarantee indexed topology for smooth sculpt.
  geo.deleteAttribute("normal");
  geo = mergeVertices(geo, 1e-4);

  // Fit in frame.
  const weldedPos = geo.attributes.position as THREE.BufferAttribute;
  geo.computeBoundingBox();
  const box = geo.boundingBox!;
  const center = new THREE.Vector3();
  box.getCenter(center);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = 1.55 / maxDim;

  for (let i = 0; i < weldedPos.count; i++) {
    v.fromBufferAttribute(weldedPos, i);
    v.sub(center).multiplyScalar(scale);
    weldedPos.setXYZ(i, v.x, v.y, v.z);
  }
  weldedPos.needsUpdate = true;

  // Fresh spherical UVs after weld (sphere UVs can seam after merge).
  const uvs = new Float32Array(weldedPos.count * 2);
  for (let i = 0; i < weldedPos.count; i++) {
    v.fromBufferAttribute(weldedPos, i).normalize();
    uvs[i * 2] = 0.5 + Math.atan2(v.z, v.x) / (Math.PI * 2);
    uvs[i * 2 + 1] =
      0.5 + Math.asin(THREE.MathUtils.clamp(v.y, -1, 1)) / Math.PI;
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));

  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}
