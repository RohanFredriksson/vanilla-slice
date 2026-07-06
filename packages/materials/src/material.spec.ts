import { describe, it, expect } from 'vitest';
import {
  DEFAULT_MATERIAL,
  defineMaterial,
  massFromDensity,
  fractureThreshold,
} from './material';

describe('material', () => {
  it('provides a neutral, effectively unbreakable default', () => {
    expect(DEFAULT_MATERIAL.id).toBe('default');
    expect(DEFAULT_MATERIAL.density).toBe(1);
    expect(DEFAULT_MATERIAL.restitution).toBe(0);
    expect(DEFAULT_MATERIAL.toughness).toBe(Infinity);
    expect(DEFAULT_MATERIAL.brittleness).toBe(0);
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
});
