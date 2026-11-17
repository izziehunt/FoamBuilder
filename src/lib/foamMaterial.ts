import * as THREE from "three";
import { createFoamTextures } from "@/lib/foamTexture";

/** Simple, stable foam material (no custom GLSL — avoids invisible-mesh shader failures). */
export function createFoamMaterial(): THREE.MeshPhysicalMaterial {
  const maps = createFoamTextures(1024);

  const map = new THREE.CanvasTexture(maps.albedo);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3.2, 3.2);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;

  const normalMap = new THREE.CanvasTexture(maps.normal);
  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.repeat.set(3.2, 3.2);
  normalMap.anisotropy = 8;

  const roughnessMap = new THREE.CanvasTexture(maps.roughness);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(3.2, 3.2);

  return new THREE.MeshPhysicalMaterial({
    map,
    normalMap,
    normalScale: new THREE.Vector2(0.22, 0.22),
    roughnessMap,
    color: new THREE.Color("#f3e6c8"),
    roughness: 0.98,
    metalness: 0,
    sheen: 0.18,
    sheenRoughness: 1,
    sheenColor: new THREE.Color("#f0dfb8"),
    clearcoat: 0,
    envMapIntensity: 0.15,
    flatShading: false,
  });
}
