import * as THREE from "three";
import { createFoamTextures } from "@/lib/foamTexture";

/** Simple, stable foam material (no custom GLSL — avoids invisible-mesh shader failures). */
export function createFoamMaterial(): THREE.MeshPhysicalMaterial {
  const maps = createFoamTextures(1024);

  const map = new THREE.CanvasTexture(maps.albedo);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(4.2, 4.2);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;

  const normalMap = new THREE.CanvasTexture(maps.normal);
  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.repeat.set(4.2, 4.2);
  normalMap.anisotropy = 8;

  const roughnessMap = new THREE.CanvasTexture(maps.roughness);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(4.2, 4.2);

  return new THREE.MeshPhysicalMaterial({
    map,
    normalMap,
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughnessMap,
    color: new THREE.Color("#f2d2c4"),
    roughness: 0.96,
    metalness: 0,
    sheen: 0.22,
    sheenRoughness: 0.95,
    sheenColor: new THREE.Color("#f6dcd0"),
    clearcoat: 0,
    envMapIntensity: 0.1,
    flatShading: false,
  });
}
