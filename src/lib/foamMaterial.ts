import * as THREE from "three";
import { createFoamTextures } from "@/lib/foamTexture";

/** Simple, stable foam material (no custom GLSL — avoids invisible-mesh shader failures). */
export function createFoamMaterial(): THREE.MeshPhysicalMaterial {
  const maps = createFoamTextures(1024);

  const map = new THREE.CanvasTexture(maps.albedo);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(5.5, 5.5);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;

  const normalMap = new THREE.CanvasTexture(maps.normal);
  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.repeat.set(5.5, 5.5);
  normalMap.anisotropy = 8;

  const roughnessMap = new THREE.CanvasTexture(maps.roughness);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(5.5, 5.5);

  return new THREE.MeshPhysicalMaterial({
    map,
    normalMap,
    normalScale: new THREE.Vector2(0.28, 0.28),
    roughnessMap,
    color: new THREE.Color("#f4d7c8"),
    roughness: 0.92,
    metalness: 0,
    sheen: 0.28,
    sheenRoughness: 0.85,
    sheenColor: new THREE.Color("#f7ddd0"),
    clearcoat: 0,
    envMapIntensity: 0.12,
    flatShading: false,
  });
}
