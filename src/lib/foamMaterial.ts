import * as THREE from "three";
import { createFoamTextures } from "@/lib/foamTexture";

/**
 * Foam material with triplanar mapping so front, sides, and top
 * all get the same porous texture (no stretched side streaks).
 */
export function createFoamMaterial(): THREE.MeshPhysicalMaterial {
  const maps = createFoamTextures(1024);

  const map = new THREE.CanvasTexture(maps.albedo);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;

  const normalMap = new THREE.CanvasTexture(maps.normal);
  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.anisotropy = 8;

  const roughnessMap = new THREE.CanvasTexture(maps.roughness);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;

  const mat = new THREE.MeshPhysicalMaterial({
    map,
    normalMap,
    normalScale: new THREE.Vector2(0.55, 0.55),
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

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.foamScale = { value: 2.4 };

    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      /* glsl */ `
      #include <common>
      varying vec3 vFoamPos;
      varying vec3 vFoamNormal;
      `,
    );

    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      /* glsl */ `
      #include <begin_vertex>
      vFoamPos = position;
      vFoamNormal = objectNormal;
      `,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      /* glsl */ `
      #include <common>
      varying vec3 vFoamPos;
      varying vec3 vFoamNormal;
      uniform float foamScale;

      vec3 foamBlendWeights(vec3 n) {
        vec3 b = pow(abs(normalize(n)), vec3(4.0));
        return b / (b.x + b.y + b.z + 1e-5);
      }

      vec4 foamTriplanarSample(sampler2D tex, vec3 pos, vec3 n, float scale) {
        vec3 b = foamBlendWeights(n);
        vec4 x = texture2D(tex, pos.zy * scale + 0.5);
        vec4 y = texture2D(tex, pos.xz * scale + 0.5);
        vec4 z = texture2D(tex, pos.xy * scale + 0.5);
        return x * b.x + y * b.y + z * b.z;
      }
      `,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      /* glsl */ `
      #ifdef USE_MAP
        vec4 sampledDiffuseColor = foamTriplanarSample(map, vFoamPos, vFoamNormal, foamScale);
        diffuseColor *= sampledDiffuseColor;
        float poreLuma = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        diffuseColor.rgb = mix(
          diffuseColor.rgb * 0.9,
          diffuseColor.rgb,
          smoothstep(0.42, 0.7, poreLuma)
        );
      #endif
      `,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <roughnessmap_fragment>",
      /* glsl */ `
      float roughnessFactor = roughness;
      #ifdef USE_ROUGHNESSMAP
        vec4 texelRoughness = foamTriplanarSample(roughnessMap, vFoamPos, vFoamNormal, foamScale);
        roughnessFactor *= texelRoughness.g;
      #endif
      `,
    );

    // Soften tangent-space normal map contribution on sides by also
    // blending a light object-space read — keeps pores without streaks.
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_maps>",
      /* glsl */ `
      #ifdef USE_NORMALMAP_TANGENTSPACE
        vec3 foamN = normalize(vFoamNormal);
        vec3 foamB = foamBlendWeights(foamN);
        vec3 nX = texture2D(normalMap, vFoamPos.zy * foamScale + 0.5).xyz * 2.0 - 1.0;
        vec3 nY = texture2D(normalMap, vFoamPos.xz * foamScale + 0.5).xyz * 2.0 - 1.0;
        vec3 nZ = texture2D(normalMap, vFoamPos.xy * foamScale + 0.5).xyz * 2.0 - 1.0;
        vec3 mapN = normalize(nX * foamB.x + nY * foamB.y + nZ * foamB.z);
        normal = normalize(normalMatrix * normalize(foamN + mapN * normalScale.x * 0.65));
      #elif defined( USE_NORMALMAP_OBJECTSPACE )
        normal = foamTriplanarSample(normalMap, vFoamPos, vFoamNormal, foamScale).xyz * 2.0 - 1.0;
        normal = normalize(normalMatrix * normal);
      #endif
      `,
    );
  };

  mat.customProgramCacheKey = () => "foam-triplanar-v2";
  return mat;
}
