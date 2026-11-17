import * as THREE from "three";
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
 * Beauty-blender radius profile along Y (−1 bottom → +1 tip).
 * Closed teardrop of revolution: fat belly, soft pointy tip.
 */
function blenderRadius(y: number) {
  const t = THREE.MathUtils.clamp((y + 1) * 0.5, 0, 1); // 0 at bottom, 1 at tip
  // Peak width a bit below the middle — classic blender silhouette.
  return Math.sin(Math.PI * t) * (0.72 - 0.28 * t);
}

/**
 * Makeup beauty blender sponge — dense, weld-safe sphere morph.
 */
export function createStarterGeometry(shape: StarterShape): THREE.BufferGeometry {
  // High-res sphere → teardrop (already indexed, no face-crack issues).
  const geo = new THREE.SphereGeometry(1, 96, 128);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const out = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    // Sphere verts are on the unit sphere (or near poles).
    const y = THREE.MathUtils.clamp(v.y, -1, 1);
    const xz = Math.hypot(v.x, v.z);

    // Slightly elongate the tip; keep the bulb rounder.
    const Y = y >= 0 ? y * 1.12 : y * 0.92;
    const R = blenderRadius(y);

    if (xz < 1e-6) {
      out.set(0, Y, 0);
    } else {
      out.set((v.x / xz) * R, Y, (v.z / xz) * R);
    }

    // Soft foam irregularity.
    const wobble =
      0.007 * Math.sin(out.x * 6.5 + out.y * 3.2) +
      0.005 * Math.cos(out.z * 5.8 - out.x * 2.4);
    const len = out.length() || 1;
    out.multiplyScalar(1 + wobble / len);

    if (shape === "face") {
      let push = 0;
      push += softBlob(out, new THREE.Vector3(0.22, 0.25, 0.35), 0.28, 0.05);
      push += softBlob(out, new THREE.Vector3(-0.22, 0.25, 0.35), 0.28, 0.05);
      push -= softBlob(out, new THREE.Vector3(0.14, 0.32, 0.42), 0.1, 0.022);
      push -= softBlob(out, new THREE.Vector3(-0.14, 0.32, 0.42), 0.1, 0.022);
      push += softBlob(out, new THREE.Vector3(0, 0.05, 0.45), 0.14, 0.03);
      out.z += push;
    } else if (shape === "figure") {
      const waist = softBlob(out, new THREE.Vector3(0, 0.05, 0), 0.45, 1);
      out.x *= 1 - waist * 0.07;
      out.z *= 1 - waist * 0.05;
      const legs = softBlob(out, new THREE.Vector3(0, -0.55, 0.15), 0.4, 1);
      if (Math.abs(out.x) < 0.12) {
        out.z -= legs * 0.035;
        out.x *= 1 + legs * 0.1;
      }
      const shoulders = softBlob(out, new THREE.Vector3(0, 0.35, 0), 0.4, 1);
      out.x *= 1 + shoulders * 0.04;
    }

    pos.setXYZ(i, out.x, out.y, out.z);
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
  const fit = 1.65 / maxDim;

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    v.sub(center).multiplyScalar(fit);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;

  // Spherical UVs wrap a blender cleanly (no side streaking).
  const uvs = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    uvs[i * 2] = 0.5 + Math.atan2(v.z, v.x) / (Math.PI * 2);
    uvs[i * 2 + 1] =
      0.5 + Math.asin(THREE.MathUtils.clamp(v.y, -1, 1)) / Math.PI;
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));

  geo.computeVertexNormals();
  applyFoamMicroRelief(
    geo.getAttribute("position") as THREE.BufferAttribute,
    geo.getAttribute("normal") as THREE.BufferAttribute,
    0.007,
  );
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}
