import { describe, it, expect } from 'vitest';
import { createMaterialLibrary } from './library';
import { DEFAULT_MATERIAL, defineMaterial } from './material';

describe('createMaterialLibrary', () => {
  it('returns the default material for unknown ids', () => {
    const lib = createMaterialLibrary();
    expect(lib.has('glass')).toBe(false);
    expect(lib.get('glass')).toBe(DEFAULT_MATERIAL);
    expect(lib.defaultMaterial).toBe(DEFAULT_MATERIAL);
  });

  it('registers and looks up materials by id', () => {
    const lib = createMaterialLibrary();
    const glass = defineMaterial('glass', { toughness: 5, brittleness: 0.9 });
    lib.register(glass);
    expect(lib.has('glass')).toBe(true);
    expect(lib.get('glass')).toBe(glass);
  });

  it('seeds materials from options', () => {
    const steel = defineMaterial('steel', { density: 7850 });
    const lib = createMaterialLibrary({ materials: [steel] });
    expect(lib.get('steel')).toBe(steel);
  });

  it('replaces a material when re-registered with the same id', () => {
    const lib = createMaterialLibrary();
    lib.register(defineMaterial('ice', { restitution: 0.1 }));
    lib.register(defineMaterial('ice', { restitution: 0.4 }));
    expect(lib.get('ice').restitution).toBe(0.4);
  });

  it('supports a custom default material', () => {
    const fallback = defineMaterial('fallback', { friction: 0.9 });
    const lib = createMaterialLibrary({ defaultMaterial: fallback });
    expect(lib.get('missing')).toBe(fallback);
  });
});
