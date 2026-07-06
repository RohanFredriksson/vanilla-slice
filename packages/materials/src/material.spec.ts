import { describe, it, expect } from 'vitest';
import {
  DEFAULT_MATERIAL,
  defineMaterial,
  massFromDensity,
  fractureThreshold,
  fractureFragmentCount,
  MAX_FRACTURE_FRAGMENTS,
} from './material';

describe('material', () => {
  it('provides a neutral, effectively unbreakable default', () => {
    expect(DEFAULT_MATERIAL.id).toBe('default');
    expect(DEFAULT_MATERIAL.density).toBe(1);
    expect(DEFAULT_MATERIAL.restitution).toBe(0);
    expect(DEFAULT_MATERIAL.toughness).toBe(Infinity);
    expect(DEFAULT_MATERIAL.brittleness).toBe(0);
    expect(DEFAULT_MATERIAL.fracturePropagationFactor).toBe(0);
  });

  it('fills unspecified properties from the default', () => {
    const glass = defineMaterial('glass', {
      restitution: 0.1,
      toughness: 5,
      brittleness: 0.9,
    });
    expect(glass.id).toBe('glass');
    expect(glass.toughness).toBe(5);
    expect(glass.brittleness).toBe(0.9);
    // Untouched properties fall back to the default.
    expect(glass.density).toBe(DEFAULT_MATERIAL.density);
    expect(glass.friction).toBe(DEFAULT_MATERIAL.friction);
  });

  it('does not let overrides set the id', () => {
    // @ts-expect-error id is excluded from the overrides type.
    const m = defineMaterial('steel', { id: 'hacked', toughness: 100 });
    expect(m.id).toBe('steel');
  });

  it('derives mass from density and volume', () => {
    expect(massFromDensity(2, 3)).toBe(6);
    expect(massFromDensity(DEFAULT_MATERIAL.density, 10)).toBe(10);
  });

  it('scales the fracture threshold by object size', () => {
    const glass = defineMaterial('glass', { toughness: 5 });
    expect(fractureThreshold(glass, 2)).toBe(10);
    expect(fractureThreshold(glass, 0)).toBe(0);
  });

  it('treats an infinite-toughness material as unbreakable at any size', () => {
    expect(fractureThreshold(DEFAULT_MATERIAL, 0)).toBe(Infinity);
    expect(fractureThreshold(DEFAULT_MATERIAL, 100)).toBe(Infinity);
  });

  describe('fractureFragmentCount', () => {
    it('derives a base count from brittleness (2..6) without energy', () => {
      expect(fractureFragmentCount(defineMaterial('a', { brittleness: 0 }), 1)).toBe(2);
      expect(fractureFragmentCount(defineMaterial('a', { brittleness: 0.5 }), 1)).toBe(4);
      expect(fractureFragmentCount(defineMaterial('a', { brittleness: 1 }), 1)).toBe(6);
    });

    it('ignores impact energy when propagation is zero', () => {
      const m = defineMaterial('glass', { toughness: 1, brittleness: 0.5, fracturePropagationFactor: 0 });
      // Huge energy, but no propagation → base count only.
      expect(fractureFragmentCount(m, 1, 1000)).toBe(4);
    });

    it('amplifies the count with excess energy when propagation is high', () => {
      const m = defineMaterial('glass', { toughness: 1, brittleness: 0.5, fracturePropagationFactor: 1 });
      // threshold = 1×1 = 1; energy 3 → excess 2 → amplify 3 → 4×3 = 12.
      expect(fractureFragmentCount(m, 1, 3)).toBe(12);
    });

    it('caps the fragment count', () => {
      const m = defineMaterial('glass', { toughness: 1, brittleness: 1, fracturePropagationFactor: 1 });
      expect(fractureFragmentCount(m, 1, 1e6)).toBe(MAX_FRACTURE_FRAGMENTS);
    });

    it('never returns fewer than two fragments', () => {
      expect(fractureFragmentCount(defineMaterial('a', { brittleness: 0 }), 1, 0)).toBe(2);
    });
  });
});
