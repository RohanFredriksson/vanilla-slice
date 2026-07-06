import { describe, it, expect } from 'vitest';
import { DEFAULT_MATERIAL, defineMaterial } from '@vanilla-slice/materials';
import { exceedsFractureThreshold } from './evaluate';

describe('exceedsFractureThreshold', () => {
  it('is true when energy exceeds toughness × size', () => {
    const glass = defineMaterial('glass', { toughness: 5 });
    // threshold = 5 × 2 = 10
    expect(exceedsFractureThreshold(glass, 11, 2)).toBe(true);
    expect(exceedsFractureThreshold(glass, 9, 2)).toBe(false);
    expect(exceedsFractureThreshold(glass, 10, 2)).toBe(false);
  });

  it('never triggers for an unbreakable (infinite-toughness) material', () => {
    expect(exceedsFractureThreshold(DEFAULT_MATERIAL, 1e9, 1)).toBe(false);
  });
});
