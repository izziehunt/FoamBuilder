import * as THREE from "three";

const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _offset = new THREE.Vector3();
const _tangent = new THREE.Vector3();
const _across = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _avg = new THREE.Vector3();

function falloff(t: number) {
  // Quartic — softer center than cubic, so folds stay round.
  const x = 1 - THREE.MathUtils.clamp(t, 0, 1);
  return x * x * x * x;
}

function midBulge(t: number) {
  // Peak around the brush mid-ring — foam lips beside a crease.
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return Math.sin(Math.PI * x);
}

/** Build vertex adjacency from an indexed mesh (once per geometry). */
export function buildAdjacency(geometry: THREE.BufferGeometry): number[][] {
  const posCount = geometry.getAttribute("position").count;
  const sets = Array.from({ length: posCount }, () => new Set<number>());
  const index = geometry.getIndex();

  if (index) {
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
  }

  return sets.map((s) => Array.from(s));
}

/**
 * Light Laplacian relaxation — kills spikes / shattered triangles
 * while keeping the overall fold.
 */
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
    if (dist > radius * 1.15) {
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

    const w = falloff(dist / (radius * 1.15)) * amount;
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
 * Soft sponge cinch: compress toward a crease, sink a rounded valley,
 * and push foam lips outward — not a collapse toward one point.
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
  const s = strength * 0.22; // keep per-frame moves tiny (pointer fires fast)
  const hasDrag = dragDeltaLocal.lengthSq() > 1e-10;

  // Crease direction: along the stroke when dragging, else world-up projected.
  if (hasDrag) {
    _across.copy(dragDeltaLocal).normalize();
  } else {
    _across.set(0, 1, 0);
  }

  for (let i = 0; i < positions.count; i++) {
    _v.fromBufferAttribute(positions, i);
    const dist = _v.distanceTo(hitLocal);
    if (dist > radius) continue;

    const t = dist / radius;
    const w = falloff(t) * s;
    const lips = midBulge(t) * s;
    _n.fromBufferAttribute(normals, i);

    // Offset from brush center in the local tangent plane.
    _offset.subVectors(_v, hitLocal);
    const alongN = _offset.dot(_n);
    _tangent.copy(_offset).addScaledVector(_n, -alongN);

    // 1) Compress sideways toward the crease axis (not toward a single point).
    //    Keep a minimum spacing so triangles never star-collapse.
    const tangentialLen = _tangent.length();
    if (tangentialLen > radius * 0.04) {
      const compress = Math.min(tangentialLen * 0.12, radius * 0.035) * w;
      _v.addScaledVector(_tangent.normalize(), -compress);
    }

    // 2) Sink a soft valley (rounded crease depth).
    _v.addScaledVector(_n, -w * 0.055);

    // 3) Foam lips: mid-ring bulges outward like bunched sponge.
    _v.addScaledVector(_n, lips * 0.028);

    // 4) Sweep with the stroke — gentle fold travel.
    if (hasDrag) {
      _tmp.copy(_across).addScaledVector(_n, -_across.dot(_n));
      if (_tmp.lengthSq() > 1e-8) {
        _tmp.normalize();
        const travel = Math.min(dragDeltaLocal.length(), radius * 0.08);
        _v.addScaledVector(_tmp, w * travel * 0.35);
      }
    }

    positions.setXYZ(i, _v.x, _v.y, _v.z);
  }

  positions.needsUpdate = true;
  // Relax spikes so folds stay soft and continuous.
  laplacianSmooth(positions, adjacency, hitLocal, radius, 0.35);
  laplacianSmooth(positions, adjacency, hitLocal, radius, 0.2);
}

/** Inflate: soft bloat along normals — sponge swelling. */
export function applyInflate(
  positions: THREE.BufferAttribute,
  normals: THREE.BufferAttribute,
  hitLocal: THREE.Vector3,
  radius: number,
  strength: number,
  adjacency: number[][],
) {
  const s = strength * 0.18;

  for (let i = 0; i < positions.count; i++) {
    _v.fromBufferAttribute(positions, i);
    const dist = _v.distanceTo(hitLocal);
    if (dist > radius) continue;

    const w = falloff(dist / radius) * s;
    _n.fromBufferAttribute(normals, i);
    _v.addScaledVector(_n, w * 0.07);
    positions.setXYZ(i, _v.x, _v.y, _v.z);
  }

  positions.needsUpdate = true;
  laplacianSmooth(positions, adjacency, hitLocal, radius, 0.25);
}
