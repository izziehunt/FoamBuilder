import * as THREE from "three";

const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _offset = new THREE.Vector3();
const _tangent = new THREE.Vector3();
const _across = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _avg = new THREE.Vector3();
const _drag = new THREE.Vector3();

/** Reused across strokes — avoid per-frame GC. */
let scratch = new Float32Array(0);
const affected: number[] = [];

function ensureScratch(count: number) {
  if (scratch.length < count * 3) {
    scratch = new Float32Array(count * 3);
  }
}

function falloff(t: number) {
  const x = 1 - THREE.MathUtils.clamp(t, 0, 1);
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

/** Laplacian only on verts already gathered in `affected`. */
function laplacianSmoothLocal(
  positions: THREE.BufferAttribute,
  adjacency: number[][],
  hitLocal: THREE.Vector3,
  radius: number,
  amount: number,
) {
  const r = radius * 1.25;
  const rSq = r * r;
  ensureScratch(affected.length);

  for (let k = 0; k < affected.length; k++) {
    const i = affected[k];
    _v.fromBufferAttribute(positions, i);
    const distSq = _v.distanceToSquared(hitLocal);
    if (distSq > rSq) {
      scratch[k * 3] = _v.x;
      scratch[k * 3 + 1] = _v.y;
      scratch[k * 3 + 2] = _v.z;
      continue;
    }

    const neighbors = adjacency[i];
    if (!neighbors.length) {
      scratch[k * 3] = _v.x;
      scratch[k * 3 + 1] = _v.y;
      scratch[k * 3 + 2] = _v.z;
      continue;
    }

    _avg.set(0, 0, 0);
    for (let n = 0; n < neighbors.length; n++) {
      const j = neighbors[n];
      _avg.x += positions.getX(j);
      _avg.y += positions.getY(j);
      _avg.z += positions.getZ(j);
    }
    _avg.multiplyScalar(1 / neighbors.length);

    const dist = Math.sqrt(distSq);
    const w = falloff(dist / r) * amount;
    _tmp.copy(_v).lerp(_avg, w);
    scratch[k * 3] = _tmp.x;
    scratch[k * 3 + 1] = _tmp.y;
    scratch[k * 3 + 2] = _tmp.z;
  }

  for (let k = 0; k < affected.length; k++) {
    const i = affected[k];
    positions.setXYZ(i, scratch[k * 3], scratch[k * 3 + 1], scratch[k * 3 + 2]);
  }
}

function gatherAffected(
  positions: THREE.BufferAttribute,
  hitLocal: THREE.Vector3,
  radius: number,
) {
  affected.length = 0;
  const rSq = radius * radius * 1.5625; // (1.25r)^2 for smooth halo
  for (let i = 0; i < positions.count; i++) {
    _v.fromBufferAttribute(positions, i);
    if (_v.distanceToSquared(hitLocal) <= rSq) affected.push(i);
  }
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

  const rSq = radius * radius;
  gatherAffected(positions, hitLocal, radius);

  for (let k = 0; k < affected.length; k++) {
    const i = affected[k];
    _v.fromBufferAttribute(positions, i);
    const distSq = _v.distanceToSquared(hitLocal);
    if (distSq > rSq) continue;

    const dist = Math.sqrt(distSq);
    const t = dist / radius;
    const w = falloff(t) * s;
    const lips = lipCurve(t) * s;
    _n.fromBufferAttribute(normals, i);

    _offset.subVectors(_v, hitLocal);
    const alongN = _offset.dot(_n);
    _tangent.copy(_offset).addScaledVector(_n, -alongN);
    const tangentialLen = _tangent.length();

    if (tangentialLen > radius * 0.06) {
      const compress = Math.min(tangentialLen * 0.08, radius * 0.02) * w;
      _v.addScaledVector(_tangent.normalize(), -compress);
    }

    _v.addScaledVector(_n, -w * 0.07);
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
  // One strong smooth pass (was two full-mesh passes — main lag source).
  laplacianSmoothLocal(positions, adjacency, hitLocal, radius, 0.55);
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
  const rSq = radius * radius;
  gatherAffected(positions, hitLocal, radius);

  for (let k = 0; k < affected.length; k++) {
    const i = affected[k];
    _v.fromBufferAttribute(positions, i);
    const distSq = _v.distanceToSquared(hitLocal);
    if (distSq > rSq) continue;

    const w = falloff(Math.sqrt(distSq) / radius) * s;
    _n.fromBufferAttribute(normals, i);
    _v.addScaledVector(_n, w * 0.085);
    positions.setXYZ(i, _v.x, _v.y, _v.z);
  }

  positions.needsUpdate = true;
  laplacianSmoothLocal(positions, adjacency, hitLocal, radius, 0.35);
}

/** Avoid allocating Vector3 on every cinch drag. */
export function copyDragDelta(
  out: THREE.Vector3,
  hit: THREE.Vector3,
  last: THREE.Vector3,
  isDrag: boolean,
) {
  if (!isDrag) {
    out.set(0, 0, 0);
    return out;
  }
  return out.copy(hit).sub(last);
}

export { _drag as dragScratch };
