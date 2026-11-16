import * as THREE from "three";

const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _toHit = new THREE.Vector3();
const _pull = new THREE.Vector3();
const _tangent = new THREE.Vector3();

function falloff(t: number) {
  // Smooth cubic falloff: 1 at center, 0 at edge.
  const x = 1 - THREE.MathUtils.clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

/**
 * Cinch: gather vertices toward the brush hit, and slightly inward,
 * so hold+drag creates soft folds like pinching foam.
 */
export function applyCinch(
  positions: THREE.BufferAttribute,
  normals: THREE.BufferAttribute,
  hitLocal: THREE.Vector3,
  dragDeltaLocal: THREE.Vector3,
  radius: number,
  strength: number,
) {
  const hasDrag = dragDeltaLocal.lengthSq() > 1e-8;
  const dragDir = hasDrag
    ? dragDeltaLocal.clone().normalize()
    : new THREE.Vector3();

  for (let i = 0; i < positions.count; i++) {
    _v.fromBufferAttribute(positions, i);
    const dist = _v.distanceTo(hitLocal);
    if (dist > radius) continue;

    const w = falloff(dist / radius) * strength;
    _n.fromBufferAttribute(normals, i);

    // Pull toward brush center (gather / cinch).
    _toHit.subVectors(hitLocal, _v);
    const gather = Math.min(_toHit.length(), radius * 0.35);
    if (gather > 1e-6) {
      _pull.copy(_toHit).normalize().multiplyScalar(gather * w * 0.55);
      _v.add(_pull);
    }

    // Fold depth: nudge slightly inward along normal for crease.
    _v.addScaledVector(_n, -w * 0.04);

    // Follow drag so stroke "sweeps" a cinch fold.
    if (hasDrag) {
      _tangent.copy(dragDir).addScaledVector(_n, -dragDir.dot(_n));
      if (_tangent.lengthSq() > 1e-8) {
        _tangent.normalize();
        _v.addScaledVector(_tangent, w * dragDeltaLocal.length() * 0.85);
      }
    }

    positions.setXYZ(i, _v.x, _v.y, _v.z);
  }

  positions.needsUpdate = true;
}

/** Inflate: push vertices outward along normals under the brush. */
export function applyInflate(
  positions: THREE.BufferAttribute,
  normals: THREE.BufferAttribute,
  hitLocal: THREE.Vector3,
  radius: number,
  strength: number,
) {
  for (let i = 0; i < positions.count; i++) {
    _v.fromBufferAttribute(positions, i);
    const dist = _v.distanceTo(hitLocal);
    if (dist > radius) continue;

    const w = falloff(dist / radius) * strength;
    _n.fromBufferAttribute(normals, i);
    _v.addScaledVector(_n, w * 0.08);
    positions.setXYZ(i, _v.x, _v.y, _v.z);
  }

  positions.needsUpdate = true;
}
