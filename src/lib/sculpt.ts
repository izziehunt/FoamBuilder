import * as THREE from "three";

const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _offset = new THREE.Vector3();
const _tangent = new THREE.Vector3();
const _across = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _avg = new THREE.Vector3();

function falloff(t: number) {
  const x = 1 - THREE.MathUtils.clamp(t, 0, 1);
  // Smooth, wide soft-body falloff.
  return x * x * x * (x * (x * 6 - 15) + 10);
}

function lipCurve(t: number) {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return Math.sin(Math.PI * x);
}

/** Vertex adjacency from indexed mesh. */
export function buildAdjacency(geometry: THREE.BufferGeometry): number[][] {
  const posCount = geometry.getAttribute("position").count;
  const sets = Array.from({ length: posCount }, () => new Set<number>());
  const index = geometry.getIndex();
  if (!index) return sets.map(() => []);

  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    const b = index.getX(i + 1);
    const c = index.getX(i + 2);
    sets[a].add(b);
    sets[a].add(c);
    sets[b].add(a);
    sets[b].add(c);
    sets[c].add(a);
    sets[c].add(b);
  }
  return sets.map((s) => Array.from(s));
}

export function laplacianSmooth(
  positions: THREE.BufferAttribute,
  adjacency: number[][],
  hitLocal: THREE.Vector3,
  radius: number,
  amount: number,
) {
  const scratch = new Float32Array(positions.count * 3);

  for (let i = 0; i < positions.count; i++) {
    _v.fromBufferAttribute(positions, i);
    const dist = _v.distanceTo(hitLocal);
    if (dist > radius * 1.25) {
      scratch[i * 3] = _v.x;
      scratch[i * 3 + 1] = _v.y;
      scratch[i * 3 + 2] = _v.z;
      continue;
    }

    const neighbors = adjacency[i];
    if (!neighbors.length) {
      scratch[i * 3] = _v.x;
      scratch[i * 3 + 1] = _v.y;
      scratch[i * 3 + 2] = _v.z;
      continue;
    }

    _avg.set(0, 0, 0);
    for (const j of neighbors) {
      _avg.x += positions.getX(j);
      _avg.y += positions.getY(j);
      _avg.z += positions.getZ(j);
    }
    _avg.multiplyScalar(1 / neighbors.length);

    const w = falloff(dist / (radius * 1.25)) * amount;
    _tmp.copy(_v).lerp(_avg, w);
    scratch[i * 3] = _tmp.x;
    scratch[i * 3 + 1] = _tmp.y;
    scratch[i * 3 + 2] = _tmp.z;
  }

  for (let i = 0; i < positions.count; i++) {
    positions.setXYZ(i, scratch[i * 3], scratch[i * 3 + 1], scratch[i * 3 + 2]);
  }
  positions.needsUpdate = true;
}

/**
 * Press / gather foam into a soft rounded crease — volume bunches into lips.
 */
export function applyCinch(
  positions: THREE.BufferAttribute,
  normals: THREE.BufferAttribute,
  hitLocal: THREE.Vector3,
  dragDeltaLocal: THREE.Vector3,
  radius: number,
  strength: number,
  adjacency: number[][],
) {
  const s = strength * 0.16;
  const hasDrag = dragDeltaLocal.lengthSq() > 1e-10;
  if (hasDrag) _across.copy(dragDeltaLocal).normalize();
  else _across.set(0, 1, 0);

  for (let i = 0; i < positions.count; i++) {
    _v.fromBufferAttribute(positions, i);
    const dist = _v.distanceTo(hitLocal);
    if (dist > radius) continue;

    const t = dist / radius;
    const w = falloff(t) * s;
    const lips = lipCurve(t) * s;
    _n.fromBufferAttribute(normals, i);

    _offset.subVectors(_v, hitLocal);
    const alongN = _offset.dot(_n);
    _tangent.copy(_offset).addScaledVector(_n, -alongN);
    const tangentialLen = _tangent.length();

    // Squeeze toward crease (keep a floor so surface never tears).
    if (tangentialLen > radius * 0.06) {
      const compress = Math.min(tangentialLen * 0.08, radius * 0.02) * w;
      _v.addScaledVector(_tangent.normalize(), -compress);
    }

    // Soft valley.
    _v.addScaledVector(_n, -w * 0.07);

    // Bunched foam lips.
    _v.addScaledVector(_n, lips * 0.04);

    if (hasDrag) {
      _tmp.copy(_across).addScaledVector(_n, -_across.dot(_n));
      if (_tmp.lengthSq() > 1e-8) {
        _tmp.normalize();
        const travel = Math.min(dragDeltaLocal.length(), radius * 0.06);
        _v.addScaledVector(_tmp, w * travel * 0.4);
      }
    }

    positions.setXYZ(i, _v.x, _v.y, _v.z);
  }

  positions.needsUpdate = true;
  laplacianSmooth(positions, adjacency, hitLocal, radius, 0.45);
  laplacianSmooth(positions, adjacency, hitLocal, radius, 0.3);
}

/** Soft inflate — sponge swelling under the brush. */
export function applyInflate(
  positions: THREE.BufferAttribute,
  normals: THREE.BufferAttribute,
  hitLocal: THREE.Vector3,
  radius: number,
  strength: number,
  adjacency: number[][],
) {
  const s = strength * 0.14;

  for (let i = 0; i < positions.count; i++) {
    _v.fromBufferAttribute(positions, i);
    const dist = _v.distanceTo(hitLocal);
    if (dist > radius) continue;

    const w = falloff(dist / radius) * s;
    _n.fromBufferAttribute(normals, i);
    _v.addScaledVector(_n, w * 0.085);
    positions.setXYZ(i, _v.x, _v.y, _v.z);
  }

  positions.needsUpdate = true;
  laplacianSmooth(positions, adjacency, hitLocal, radius, 0.35);
}
