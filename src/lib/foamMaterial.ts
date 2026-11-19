import * as THREE from "three";
import { createFoamTextures } from "@/lib/foamTexture";

/** Simple, stable foam material (no custom GLSL — avoids invisible-mesh shader failures). */
export function createFoamMaterial(): THREE.MeshPhysicalMaterial {
  const maps = createFoamTextures(1024);

  const map = new THREE.CanvasTexture(maps.albedo);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3.6, 3.6);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;

  const normalMap = new THREE.CanvasTexture(maps.normal);
  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.repeat.set(3.6, 3.6);
  normalMap.anisotropy = 8;

  const roughnessMap = new THREE.CanvasTexture(maps.roughness);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(3.6, 3.6);

  return new THREE.MeshPhysicalMaterial({
    map,
    normalMap,
    normalScale: new THREE.Vector2(0.62, 0.62),
    roughnessMap,
    color: new THREE.Color("#f3d0c2"),
    roughness: 0.94,
    metalness: 0,
    sheen: 0.2,
    sheenRoughness: 0.92,
    sheenColor: new THREE.Color("#f7dcd0"),
    clearcoat: 0,
    envMapIntensity: 0.08,
    flatShading: false,
    // So the rounded belly/underside always receives brush raycasts.
    side: THREE.DoubleSide,
  });
}
