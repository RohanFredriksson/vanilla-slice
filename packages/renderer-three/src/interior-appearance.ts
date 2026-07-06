import { MeshStandardMaterial, type Material } from 'three';
import type { MaterialId } from '@vanilla-slice/core';

/**
 * The subset of Three's `onBeforeCompile` shader parameter this module mutates.
 * Declared structurally so it stays compatible across `three` versions (which
 * have renamed the concrete parameter type).
 */
interface InjectableShader {
  uniforms: Record<string, { value: unknown }>;
  vertexShader: string;
  fragmentShader: string;
}

/**
 * Built-in interior surface looks for newly-exposed cut/fracture faces
 * (ADR 0010). Each samples the mesh's rest-pose `tex3` coordinate in a solid
 * (3D) fashion, so the pattern is welded to the material and stays continuous
 * and cut-direction-correct as fragments move.
 */
export type InteriorPattern = 'wood' | 'marble' | 'stone' | 'flesh';

/** Configuration for a procedural interior material. */
export interface InteriorAppearanceOptions {
  /** Procedural pattern to sample in `tex3` (model) space. */
  pattern: InteriorPattern;
  /** Primary colour (hex, e.g. `0x9c6b3f`). */
  colorA?: number;
  /** Secondary colour blended by the pattern (hex). */
  colorB?: number;
  /** Spatial frequency of the pattern in `tex3` units. */
  frequency?: number;
  /** Growth-ring / grain axis for the `wood` pattern (model space). */
  axis?: [number, number, number];
  /** PBR roughness of the interior surface (defaults to 0.85). */
  roughness?: number;
  /** PBR metalness of the interior surface (defaults to 0). */
  metalness?: number;
  /**
   * Strength of the procedural surface relief (tangent-free normal perturbation)
   * derived from the pattern's height field. `0` disables it; defaults to 0.6.
   */
  normalStrength?: number;
}

const PATTERN_ID: Record<InteriorPattern, number> = {
  wood: 0,
  marble: 1,
  stone: 2,
  flesh: 3,
};

const DEFAULTS: Record<
  InteriorPattern,
  { colorA: number; colorB: number; frequency: number }
> = {
  wood: { colorA: 0xb07a44, colorB: 0x5c3a1e, frequency: 8 },
  marble: { colorA: 0xf2f0ea, colorB: 0x7d7a72, frequency: 3 },
  stone: { colorA: 0x8a8a8a, colorB: 0x4c4c4c, frequency: 6 },
  flesh: { colorA: 0xe23b52, colorB: 0xf4a9a0, frequency: 1.2 },
};

/** Convert a hex colour to a linear-ish `vec3` literal for GLSL. */
function hexToVec3(hex: number): [number, number, number] {
  return [
    ((hex >> 16) & 0xff) / 255,
    ((hex >> 8) & 0xff) / 255,
    (hex & 0xff) / 255,
  ];
}

const FRAGMENT_HELPERS = /* glsl */ `
uniform int uPattern;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uFrequency;
uniform vec3 uAxis;
uniform float uNormalStrength;
varying vec3 vTex3;

float interiorHash(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
}

float interiorNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float n000 = interiorHash(i + vec3(0.0, 0.0, 0.0));
  float n100 = interiorHash(i + vec3(1.0, 0.0, 0.0));
  float n010 = interiorHash(i + vec3(0.0, 1.0, 0.0));
  float n110 = interiorHash(i + vec3(1.0, 1.0, 0.0));
  float n001 = interiorHash(i + vec3(0.0, 0.0, 1.0));
  float n101 = interiorHash(i + vec3(1.0, 0.0, 1.0));
  float n011 = interiorHash(i + vec3(0.0, 1.0, 1.0));
  float n111 = interiorHash(i + vec3(1.0, 1.0, 1.0));
  float nx00 = mix(n000, n100, u.x);
  float nx10 = mix(n010, n110, u.x);
  float nx01 = mix(n001, n101, u.x);
  float nx11 = mix(n011, n111, u.x);
  float nxy0 = mix(nx00, nx10, u.y);
  float nxy1 = mix(nx01, nx11, u.y);
  return mix(nxy0, nxy1, u.z);
}

float interiorFbm(vec3 p) {
  float amp = 0.5;
  float sum = 0.0;
  for (int k = 0; k < 4; k++) {
    sum += amp * interiorNoise(p);
    p *= 2.02;
    amp *= 0.5;
  }
  return sum;
}

vec3 interiorColor() {
  vec3 p = vTex3 * uFrequency;
  if (uPattern == 0) {
    // Wood: growth rings around uAxis + directional grain streaks.
    vec3 ax = normalize(uAxis);
    vec3 radial = vTex3 - ax * dot(vTex3, ax);
    float r = length(radial) * uFrequency;
    float rings = 0.5 + 0.5 * sin(r * 6.2831853 + interiorFbm(vTex3 * uFrequency * 0.5) * 4.0);
    float grain = interiorFbm(vTex3 * uFrequency * vec3(1.0, 1.0, 8.0));
    float t = clamp(rings * 0.7 + grain * 0.3, 0.0, 1.0);
    return mix(uColorA, uColorB, t);
  } else if (uPattern == 1) {
    // Marble: turbulent veins.
    float v = interiorFbm(p * 0.5);
    float veins = 0.5 + 0.5 * sin((p.x + p.y + p.z) + v * 6.0);
    return mix(uColorA, uColorB, smoothstep(0.35, 0.55, veins));
  } else if (uPattern == 2) {
    // Stone: speckled value noise.
    float n = interiorFbm(p);
    return mix(uColorA, uColorB, smoothstep(0.3, 0.7, n));
  }
  // Flesh: radial gradient from the core out to the rind, with seed speckles.
  float rad = length(vTex3) * uFrequency;
  vec3 base = mix(uColorA, uColorB, clamp(rad, 0.0, 1.0));
  float speck = step(0.93, interiorHash(floor(p * 4.0)));
  return mix(base, vec3(0.02, 0.05, 0.02), speck);
}

// A scalar height field per pattern, reused for tangent-free relief. Higher
// values read as raised grain/veins/speckle.
float interiorHeight(vec3 tp) {
  vec3 p = tp * uFrequency;
  if (uPattern == 0) {
    vec3 ax = normalize(uAxis);
    vec3 radial = tp - ax * dot(tp, ax);
    float r = length(radial) * uFrequency;
    float rings = 0.5 + 0.5 * sin(r * 6.2831853 + interiorFbm(tp * uFrequency * 0.5) * 4.0);
    float grain = interiorFbm(tp * uFrequency * vec3(1.0, 1.0, 8.0));
    return rings * 0.7 + grain * 0.3;
  } else if (uPattern == 1) {
    float v = interiorFbm(p * 0.5);
    return 0.5 + 0.5 * sin((p.x + p.y + p.z) + v * 6.0);
  } else if (uPattern == 2) {
    return interiorFbm(p);
  }
  return interiorFbm(p * 2.0);
}
`;

/**
 * Tangent-free surface-gradient normal perturbation (after Mikkelsen). Uses the
 * screen-space derivatives of the view position and the pattern height to bend
 * the view-space `normal`, so cut faces of any orientation get correct relief
 * with no per-vertex tangents (ADR 0010 P6).
 */
const INTERIOR_NORMAL = /* glsl */ `
{
  float h = interiorHeight(vTex3);
  float dHdx = dFdx(h);
  float dHdy = dFdy(h);
  vec3 sigmaX = dFdx(-vViewPosition);
  vec3 sigmaY = dFdy(-vViewPosition);
  vec3 vN = normal;
  vec3 R1 = cross(sigmaY, vN);
  vec3 R2 = cross(vN, sigmaX);
  float fDet = dot(sigmaX, R1);
  vec3 surfGrad = sign(fDet) * (dHdx * R1 + dHdy * R2);
  normal = normalize(abs(fDet) * vN - uNormalStrength * surfGrad);
}
`;

/**
 * Build a procedural interior material for cut/fracture faces. It extends a
 * `MeshStandardMaterial` (keeping PBR lighting) and injects a solid pattern
 * sampled from the custom `tex3` attribute uploaded by
 * {@link meshToBufferGeometry}. Assign it to material slot 1 of a mesh whose
 * geometry carries `tex3` and groups.
 */
export function createInteriorMaterial(
  options: InteriorAppearanceOptions,
): Material {
  const preset = DEFAULTS[options.pattern];
  const colorA = hexToVec3(options.colorA ?? preset.colorA);
  const colorB = hexToVec3(options.colorB ?? preset.colorB);
  const frequency = options.frequency ?? preset.frequency;
  const axis = options.axis ?? [0, 1, 0];
  const normalStrength = options.normalStrength ?? 0.6;
  const patternId = PATTERN_ID[options.pattern];

  const material = new MeshStandardMaterial({
    roughness: options.roughness ?? 0.85,
    metalness: options.metalness ?? 0,
  });

  material.onBeforeCompile = (shader: InjectableShader) => {
    shader.uniforms.uPattern = { value: patternId };
    shader.uniforms.uColorA = { value: colorA };
    shader.uniforms.uColorB = { value: colorB };
    shader.uniforms.uFrequency = { value: frequency };
    shader.uniforms.uAxis = { value: axis };
    shader.uniforms.uNormalStrength = { value: normalStrength };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute vec3 tex3;\nvarying vec3 vTex3;',
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvTex3 = tex3;',
      );

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAGMENT_HELPERS}`)
      .replace(
        '#include <map_fragment>',
        '#include <map_fragment>\ndiffuseColor.rgb = interiorColor();',
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>\n${INTERIOR_NORMAL}`,
      );
  };

  // Distinct cache key per pattern so Three does not share compiled programs
  // across different interior looks.
  material.customProgramCacheKey = () => `vanilla-slice-interior-${patternId}`;

  return material;
}

/**
 * Maps an entity's material id to an interior (cut-surface) material. The engine
 * `Material` is physics-only (ADR 0009); this renderer-side registry owns how a
 * material *looks* inside. Instances are created lazily and cached per id, so the
 * registry owns their lifecycle — call {@link dispose} to free them. The
 * `ThreeRenderer` never disposes registry-owned materials.
 */
export class InteriorAppearanceRegistry {
  private readonly factories = new Map<MaterialId, () => Material>();
  private readonly cache = new Map<MaterialId, Material>();

  /** Register a custom interior material factory for `materialId`. */
  register(materialId: MaterialId, factory: () => Material): this {
    this.factories.set(materialId, factory);
    return this;
  }

  /** Register a built-in procedural interior preset for `materialId`. */
  registerPreset(
    materialId: MaterialId,
    options: InteriorAppearanceOptions,
  ): this {
    return this.register(materialId, () => createInteriorMaterial(options));
  }

  /** Resolve (and cache) the interior material for `materialId`, if registered. */
  resolve(materialId: MaterialId | undefined): Material | undefined {
    if (materialId === undefined) {
      return undefined;
    }
    const cached = this.cache.get(materialId);
    if (cached) {
      return cached;
    }
    const factory = this.factories.get(materialId);
    if (!factory) {
      return undefined;
    }
    const material = factory();
    this.cache.set(materialId, material);
    return material;
  }

  /** Dispose every cached interior material and clear the cache. */
  dispose(): void {
    for (const material of this.cache.values()) {
      material.dispose();
    }
    this.cache.clear();
  }
}
