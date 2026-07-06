import { describe, it, expect } from 'vitest';
import { MeshStandardMaterial, type Material } from 'three';
import {
  createInteriorMaterial,
  InteriorAppearanceRegistry,
} from './interior-appearance';

/** A minimal Three `Shader`-shaped object exposing the injection tokens. */
function fakeShader() {
  return {
    uniforms: {} as Record<string, { value: unknown }>,
    vertexShader: '#include <common>\nvoid main(){\n#include <begin_vertex>\n}',
    fragmentShader:
      '#include <common>\nvoid main(){\n#include <map_fragment>\n#include <normal_fragment_maps>\n}',
  };
}

describe('createInteriorMaterial', () => {
  it('builds a standard material that injects tex3 sampling on compile', () => {
    const material = createInteriorMaterial({ pattern: 'wood' });
    expect(material).toBeInstanceOf(MeshStandardMaterial);
    expect(typeof material.onBeforeCompile).toBe('function');

    const shader = fakeShader();
    material.onBeforeCompile(shader as never, undefined as never);

    // Vertex shader forwards the custom tex3 attribute to a varying.
    expect(shader.vertexShader).toContain('attribute vec3 tex3;');
    expect(shader.vertexShader).toContain('vTex3 = tex3;');
    // Fragment shader overrides the albedo with the procedural interior colour.
    expect(shader.fragmentShader).toContain('interiorColor()');
    expect(shader.fragmentShader).toContain('diffuseColor.rgb = interiorColor();');
    // Pattern uniforms are supplied.
    expect(shader.uniforms.uPattern?.value).toBe(0);
    expect(shader.uniforms.uColorA).toBeDefined();
  });

  it('injects tangent-free interior normal perturbation (ADR 0010 P6)', () => {
    const material = createInteriorMaterial({ pattern: 'wood' });
    const shader = fakeShader();
    material.onBeforeCompile(shader as never, undefined as never);

    // The bump uses the pattern height and derivatives after the normal maps.
    expect(shader.fragmentShader).toContain('interiorHeight(vTex3)');
    expect(shader.fragmentShader).toContain('uNormalStrength');
    expect(shader.fragmentShader).toContain('dFdx(-vViewPosition)');
    expect(shader.uniforms.uNormalStrength?.value).toBeCloseTo(0.6, 6);
  });

  it('honours a custom normal strength', () => {
    const material = createInteriorMaterial({
      pattern: 'stone',
      normalStrength: 0,
    });
    const shader = fakeShader();
    material.onBeforeCompile(shader as never, undefined as never);
    expect(shader.uniforms.uNormalStrength?.value).toBe(0);
  });

  it('encodes the pattern in the program cache key', () => {
    const wood = createInteriorMaterial({ pattern: 'wood' });
    const stone = createInteriorMaterial({ pattern: 'stone' });
    expect(wood.customProgramCacheKey()).not.toBe(stone.customProgramCacheKey());
  });
});

describe('InteriorAppearanceRegistry', () => {
  it('resolves a registered preset and caches the instance', () => {
    const registry = new InteriorAppearanceRegistry();
    registry.registerPreset('wood', { pattern: 'wood' });

    const first = registry.resolve('wood');
    const second = registry.resolve('wood');
    expect(first).toBeInstanceOf(MeshStandardMaterial);
    expect(second).toBe(first); // cached, one instance per id
  });

  it('returns undefined for unknown or absent ids', () => {
    const registry = new InteriorAppearanceRegistry();
    expect(registry.resolve('missing')).toBeUndefined();
    expect(registry.resolve(undefined)).toBeUndefined();
  });

  it('supports custom factories and disposes cached materials', () => {
    const registry = new InteriorAppearanceRegistry();
    let disposed = false;
    const custom = new MeshStandardMaterial();
    custom.dispose = () => {
      disposed = true;
    };
    registry.register('custom', () => custom as Material);

    expect(registry.resolve('custom')).toBe(custom);
    registry.dispose();
    expect(disposed).toBe(true);
    // Cache cleared → a fresh instance would be produced next time.
    expect(registry.resolve('custom')).toBe(custom);
  });
});
