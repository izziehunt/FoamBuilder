import * as THREE from "three";
import { createFoamTextures } from "@/lib/foamTexture";

/** Matte open-cell foam — color tints a neutral pore map. */
export function createFoamMaterial(
  foamColor = "#e8c4a8",
): THREE.MeshPhysicalMaterial {
  const maps = createFoamTextures(1024);

  const map = new THREE.CanvasTexture(maps.albedo);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  // Fine tip-like scale everywhere (UVs already equalize belly stretch).
  map.repeat.set(3.4, 3.4);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;

  const normalMap = new THREE.CanvasTexture(maps.normal);
  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.repeat.set(3.4, 3.4);
  normalMap.anisotropy = 8;

  const roughnessMap = new THREE.CanvasTexture(maps.roughness);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(3.4, 3.4);

  const color = new THREE.Color(foamColor);

  return new THREE.MeshPhysicalMaterial({
    map,
    normalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap,
    color,
    roughness: 1,
    metalness: 0,
    sheen: 0.08,
    sheenRoughness: 1,
    sheenColor: color.clone().lerp(new THREE.Color("#ffffff"), 0.25),
    clearcoat: 0,
    envMapIntensity: 0.04,
    flatShading: false,
    side: THREE.DoubleSide,
  });
}
