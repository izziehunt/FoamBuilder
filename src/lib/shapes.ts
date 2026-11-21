import * as THREE from "three";

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
export function createStarterGeometry(): THREE.BufferGeometry {
  const height = 1.7;
  const segments = 96;
  const radial = 72;

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

  // Arc-length UVs keep pore size even — spherical UVs stretched the belly open.
  const rRef = 0.42;
  const vScale = 2.4;
  const uvs = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const r = Math.hypot(v.x, v.z);
    const turn = Math.atan2(v.z, v.x) / (Math.PI * 2) + 0.5;
    uvs[i * 2] = turn * (r / rRef);
    uvs[i * 2 + 1] = v.y * vScale;
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));

  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}
