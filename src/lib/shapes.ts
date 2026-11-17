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

/** Smoothstep for silhouette interpolation. */
function smoother(t: number) {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

/**
 * Beauty-blender side profile: height u∈[0,1] (bottom→tip) → radius.
 * Tuned to the classic sponge photo — round belly, continuous taper, soft tip.
 */
function blenderSilhouette(u: number) {
  // Keyframes: [height fraction, radius] matching a real beauty blender outline.
  const keys: [number, number][] = [
    [0.0, 0.0],
    [0.06, 0.3],
    [0.14, 0.46],
    [0.24, 0.54], // widest — low on the body
    [0.36, 0.53],
    [0.48, 0.47],
    [0.6, 0.38],
    [0.72, 0.27],
    [0.84, 0.16],
    [0.93, 0.08],
    [1.0, 0.035], // softly blunt tip
  ];

  const t = THREE.MathUtils.clamp(u, 0, 1);
  for (let i = 0; i < keys.length - 1; i++) {
    const [u0, r0] = keys[i];
    const [u1, r1] = keys[i + 1];
    if (t <= u1 || i === keys.length - 2) {
      const s = smoother((t - u0) / (u1 - u0 || 1));
      return THREE.MathUtils.lerp(r0, r1, s);
    }
  }
  return keys[keys.length - 1][1];
}

/**
 * Makeup beauty blender — one continuous teardrop of revolution.
 */
export function createStarterGeometry(shape: StarterShape): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, 96, 128);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const out = new THREE.Vector3();

  const height = 1.72;

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const lat = THREE.MathUtils.clamp(v.y, -1, 1);
    const xz = Math.hypot(v.x, v.z);
    // 0 at bottom pole → 1 at tip
    const u = (lat + 1) * 0.5;

    const Y = u * height;
    const R = blenderSilhouette(u);

    if (xz < 1e-6) {
      out.set(0, Y, 0);
    } else {
      out.set((v.x / xz) * R, Y, (v.z / xz) * R);
    }

    // Very subtle foam irregularity — keep the silhouette clean.
    const wobble =
      0.004 * Math.sin(out.x * 6.2 + out.y * 2.8) +
      0.003 * Math.cos(out.z * 5.5 - out.x * 2.1);
    const len = out.length() || 1;
    out.multiplyScalar(1 + wobble / len);

    if (shape === "face") {
      let push = 0;
      push += softBlob(out, new THREE.Vector3(0.2, 1.05, 0.32), 0.26, 0.045);
      push += softBlob(out, new THREE.Vector3(-0.2, 1.05, 0.32), 0.26, 0.045);
      push -= softBlob(out, new THREE.Vector3(0.12, 1.12, 0.38), 0.09, 0.02);
      push -= softBlob(out, new THREE.Vector3(-0.12, 1.12, 0.38), 0.09, 0.02);
      push += softBlob(out, new THREE.Vector3(0, 0.9, 0.4), 0.12, 0.025);
      out.z += push;
    } else if (shape === "figure") {
      const waist = softBlob(out, new THREE.Vector3(0, 0.85, 0), 0.42, 1);
      out.x *= 1 - waist * 0.07;
      out.z *= 1 - waist * 0.05;
      const legs = softBlob(out, new THREE.Vector3(0, 0.25, 0.12), 0.38, 1);
      if (Math.abs(out.x) < 0.12) {
        out.z -= legs * 0.03;
        out.x *= 1 + legs * 0.1;
      }
      const shoulders = softBlob(out, new THREE.Vector3(0, 1.15, 0), 0.38, 1);
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
    0.005,
  );
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}
